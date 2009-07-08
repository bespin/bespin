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
        var isEmpty = bespin.util.isEmpty;
        var contents = moduleFactory.toString();
        var modules = bespin.plugins.loader.modules;
        var loadQueue = bespin.plugins.loader.loadQueue;
        
        var queueitem = loadQueue[scriptName];
        
        var resolver = queueitem.resolver;
        queueitem.moduleFactory = moduleFactory;

        //Find dependencies.
        var depRegExp = /require\s*\(('|")([\w\W]*?)('|")\)/mg;
        var deps = queueitem.deps = {};
        var match;
        while ((match = depRegExp.exec(contents)) != null) {
            var depScriptName = "/js/" + match[2] + ".js";
            if (modules[depScriptName] !== undefined) {
                continue;
            }
            var adjustedName = resolver ? resolver(depScriptName) : depScriptName;
            deps[adjustedName] = true;
            if (!loadQueue[adjustedName]) {
                bespin.plugins.loader.loadScript(depScriptName,
                    {resolver: resolver});
            }
        }
        
        if (isEmpty(deps)) {
            bespin.plugins.loader._loaded(scriptName, loadQueue, queueitem);
        }
    },
    
    _loaded: function(scriptName) {
        var isEmpty = bespin.util.isEmpty;
        var modules = bespin.plugins.loader.modules;
        var loadQueue = bespin.plugins.loader.loadQueue;
        var queueitem = loadQueue[scriptName];
        var resolver = queueitem.resolver;

        delete loadQueue[scriptName];
        
        var module = queueitem.moduleFactory(function(modname) {
            if (resolver) {
                modname = resolver(modname);
            }
            return bespin.plugins.loader.modules[modname];
        }, {});
        
        modules[scriptName] = module;
        if (queueitem.callback) {
            queueitem.callback(module);
        }
        
        // So, we've successfully loaded this module. Let's
        // clear out dependencies.
        for (var otherScript in loadQueue) {
            var qi = loadQueue[otherScript];
            if (qi.deps && qi.deps[scriptName]) {
                delete qi.deps[scriptName];
                if (isEmpty(qi.deps)) {
                    bespin.plugins.loader._loaded(otherScript);
                }
            }
        }
    },

    loadScript: function(scriptName, opts) {
        opts = opts || {};
        
        var loadQueue = bespin.plugins.loader.loadQueue;
        
        if (opts.resolver) {
            scriptName = opts.resolver(scriptName);
        }
        
        // already loading?
        if (loadQueue[scriptName] && !opts.force) {
            return;
        }
        
        loadQueue[scriptName] = {factory: null, name: scriptName,
                                callback: opts.callback,
                                resolver: opts.resolver};
        bespin.plugins.loader._addScriptTag(scriptName);
    },
    
    _addScriptTag: function(fullName) {
        var s = document.createElement("script");
        s.setAttribute("src", fullName);
        document.body.appendChild(s);
    }
});
