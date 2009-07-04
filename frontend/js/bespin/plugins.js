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
        
        if (parts[1]) {
            callback(module[parts[1]]);
        } else {
            callback(module);
        }
    }
});

dojo.mixin(bespin.plugins, {
    metadata: {
    },
    
    extensionPoints: {
        
    },
    
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
            
            for (var i = 0; i < extList.length; i++) {
                var ext = extList[i];
                if (ext._pluginName == pluginName) {
                    extList.splice(i,1);
                    bespin.publish("extension:removed:" + name, ext);
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
            console.log("Publishing: " + "extension:loaded:" + name);
            bespin.publish("extension:loaded:" + name, ext);
        }
    },
    
    get: function(epName) {
        return bespin.plugins.extensionPoints[epName] || [];
    },
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
                bespin.plugins.metadata[name] = module.info;
                bespin.plugins.registerExtensionPoints(name);
                instruction.addOutput("Plugin loaded.");
            }, true);
    }
});