/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 * See the License for the specific language governing rights and
 * limitations under the License.
 *
 * The Original Code is Bespin.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bespin Team (bespin@mozilla.com)
 *
 * ***** END LICENSE BLOCK ***** */ 

dojo.provide("bespin.plugins");

dojo.declare("bespin.plugins.Extension", null, {
    constructor: function(pluginName, meta) {
        this._pluginName = pluginName;
        dojo.mixin(this, meta);
    },
    
    load: function(callback) {
        var parts = this.pointer.split(":");
        var modname = "/file/at/" + parts[0] + ".js";
        
        // this part will actually be async
        var module = bespin.plugins.loader.modules[modname];
        
        if (!module) {
            bespin.plugins.loader.loadScript(modname, function(module) {
                if (module.activate) {
                    module.activate();
                }
                
                if (parts[1]) {
                    callback(module[parts[1]]);
                } else {
                    callback(module);
                }
            });
            return;
        }
        
        if (parts[1]) {
            callback(module[parts[1]]);
        } else {
            callback(module);
        }
    }
});

dojo.mixin(bespin.plugins, {
    metadata: {},
    
    extensionPoints: {},
    
    unregisterExtensionPoints: function(pluginName) {
        var extensionPoints = bespin.plugins.extensionPoints;
        var info = bespin.plugins.metadata[pluginName];
        if (!info) {
            return;
        }
        
        var provides = info.provides;
        
        if (!provides) {
            return;
        }
        
        for (var i = 0; i < provides.length; i++) {
            var ep = provides[i];
            var name = ep[0];
            var meta = ep[1];
            
            var extList = extensionPoints[name];
            if (!extList) {
                continue;
            }
            
            for (var j = 0; j < extList.length; j++) {
                var ext = extList[j];
                if (ext._pluginName == pluginName) {
                    extList.splice(j,1);
                    bespin.publish("extension:removed:" + name, ext);
                    j--;
                }
            }
        }
    },
    
    registerExtensionPoints: function(pluginName) {
        var extensionPoints = bespin.plugins.extensionPoints;
        var Extension = bespin.plugins.Extension;
        var info = bespin.plugins.metadata[pluginName];
        var provides = info.provides;
        
        if (!provides) {
            return;
        }
        
        for (var i = 0; i < provides.length; i++) {
            var ep = provides[i];
            var name = ep[0];
            var meta = ep[1];
            
            var extList = extensionPoints[name];
            if (!extList) {
                extList = extensionPoints[name] = [];
            }
            
            var ext = new Extension(pluginName, meta)
            extList.push(ext);
            bespin.publish("extension:loaded:" + name, ext);
        }
    },
    
    get: function(epName) {
        return bespin.plugins.extensionPoints[epName] || [];
    },
    
    remove: function(pluginName) {
        var info = bespin.plugins.metadata[pluginName];
        console.log("Removing " + pluginName);
        console.dir(info);
        if (info) {
            var oldmodule = bespin.plugins.loader.modules[info.location];
        } else {
            var oldmodule = undefined;
        }
        bespin.plugins.unregisterExtensionPoints(pluginName);
        if (oldmodule && oldmodule.deactivate) {
            oldmodule.deactivate();
        }
        delete bespin.plugins.metadata[pluginName];
        bespin.get("files").saveFile("BespinSettings",
            {
                name: "plugins.json",
                content: dojo.toJson(bespin.plugins.metadata)
            });
    },
    
    _removeLink: function(node) {
        bespin.get("commandLine").executeCommand('plugin remove "' + node.getAttribute("name") + '"');
    },
    
    reload: function(url) {
        var oldmodule = bespin.plugins.loader.modules[url];
        
        bespin.plugins.loader.loadScript(url,
            function(module) {
                if (!module.info) {
                    instruction.addError("Plugin module does not have info!");
                }
                var name = module.info.name;
                if (!name) {
                    name = filename;
                }
                bespin.plugins.unregisterExtensionPoints(name);
                if (oldmodule && oldmodule.deactivate) {
                    oldmodule.deactivate();
                }
                module.info.location = url;
                bespin.plugins.metadata[name] = module.info;
                bespin.plugins.registerExtensionPoints(name);
                if (module.activate) {
                    module.activate();
                }
                bespin.get("files").saveFile("BespinSettings",
                    {
                        name: "plugins.json",
                        content: dojo.toJson(bespin.plugins.metadata)
                    });
                
            }, true);
    },
    
    reloadByName: function(pluginName) {
        var info = bespin.plugins.metadata[pluginName];
        if (!info || !info.location) {
            return;
        }
        bespin.plugins.reload(info.location);
    },
    
    _reloadLink: function(node) {
        bespin.get("commandLine").executeCommand('plugin reload "' + node.getAttribute("name") + '"');
    }
});

bespin.plugins.commands = new bespin.command.Store(bespin.command.store, {
    name: "plugin",
    preview: "manage Bespin plugins",
    subcommanddefault: "help"
});

bespin.plugins.commands.addCommand({
    name: "install",
    takes: ["name"],
    execute: function(instruction, name) {
        var editSession = bespin.get('editSession');
        var filename = editSession.path;
        var project  = editSession.project;
        var url = "/file/at/" + project + "/" + filename;
        
        bespin.plugins.reload(url);
        instruction.addOutput("Plugin installed.");
    }
});

bespin.plugins.commands.addCommand({
    name: "list",
    execute: function(instruction) {
        var output = '<h2>Installed plugins:</h2>';
        output += '<table>';
        for (var name in bespin.plugins.metadata) {
            output += '<tr><td>' + name + 
                '</td><td><a onclick="bespin.plugins._removeLink(this)" name="' + name + '">Remove</a></td><td><a onclick="bespin.plugins._reloadLink(this)" name="' + name + '">Reload</a></td></tr>';
        }
        output += "</table>";
        instruction.addOutput(output);
    }
});

bespin.plugins.commands.addCommand({
    name: "remove",
    takes: ['name'],
    execute: function(instruction, name) {
        name = name.substring(1, name.length-1);
        bespin.plugins.remove(name);
        instruction.addOutput("Plugin removed");
    }
});

bespin.plugins.commands.addCommand({
    name: "reload",
    takes: ['name'],
    execute: function(instruction, name) {
        name = name.substring(1, name.length-1);
        bespin.plugins.reloadByName(name);
        instruction.addOutput("Plugin reloaded");
    }
});

dojo.addOnLoad(function() {
    bespin.get("files").loadContents("BespinSettings", "plugins.json",
        function(info) {
            var data = dojo.fromJson(info.content);
            bespin.plugins.metadata = data;
            for (var name in data) {
                bespin.plugins.registerExtensionPoints(name);
            }
    });
});
