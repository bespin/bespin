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

dojo.provide("bespin.plugins.loader");

dojo.mixin(bespin.plugins.loader, {
    modules: {},
    loadQueue: {},

    moduleLoaded: function(scriptName, moduleFactory) {
        var contents = moduleFactory.toString();
        var modules = bespin.plugins.loader.modules;
        var loadQueue = bespin.plugins.loader.loadQueue;

        //Find dependencies.
        var depRegExp = /require\s*\(('|")([\w\W]*?)('|")\)/mg;
        var deps = [];
        var match;
        while ((match = depRegExp.exec(contents)) != null) {
            var depScriptName = "/js/" + match[2] + ".js";
            if (modules[depScriptName] !== undefined) {
                continue;
            }
            deps.push(depScriptName);
            if (!loadQueue[depScriptName]) {
                bespin.plugins.loader.loadScript(depScriptName);
            }
        }
        
        if (deps.length == 0) {
            var queueitem = loadQueue[scriptName];
            loadQueue[scriptName] = undefined;
            var module = moduleFactory(bespin.plugins.loader.require, {});
            modules[scriptName] = module;
            console.log(queueitem);
            if (queueitem.callback) {
                queueitem.callback(module);
            }
        }
    },

    loadScript: function(scriptName, callback, force) {
        var loadQueue = bespin.plugins.loader.loadQueue;
        
        // already loading?
        if (loadQueue[scriptName] && !force) {
            return;
        }
        
        loadQueue[scriptName] = {factory: null, name: scriptName,
                                callback: callback};
        bespin.plugins.loader._addScriptTag(scriptName);
    },
    
    _addScriptTag: function(fullName) {
        var s = document.createElement("script");
        s.setAttribute("src", "/getscript/" + fullName);
        document.body.appendChild(s);
    },

    require: function(module) {
        var scriptName = "/js/" + module + ".js";
        return bespin.plugins.loader.modules[scriptName];
    }
});
