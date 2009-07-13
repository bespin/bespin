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
        console.log(scriptName + " module has arrived");
        var isEmpty = bespin.util.isEmpty;
        var contents = moduleFactory.toString();
        var modules = bespin.plugins.loader.modules;
        var loadQueue = bespin.plugins.loader.loadQueue;
        
        var queueitem = loadQueue[scriptName];
        
        var resolver = queueitem.resolver;
        var force = queueitem.force;
        queueitem.moduleFactory = moduleFactory;

        //Find dependencies.
        var depRegExp = /require\s*\(('|")([\w\W]*?)('|")\)/mg;
        var deps = queueitem.deps = {};
        var allDependencies = queueitem.dependsOn = {};
        var match;
        while ((match = depRegExp.exec(contents)) != null) {
            var depScriptName = match[2];
            var adjustedName = resolver ? resolver(depScriptName) : depScriptName;
            allDependencies[adjustedName] = true;
            
            if (modules[adjustedName] !== undefined && !force) {
                continue;
            }
            deps[adjustedName] = true;
            if (!loadQueue[adjustedName]) {
                bespin.plugins.loader.loadScript(depScriptName,
                    {resolver: resolver, force: force});
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
        
        module._name = scriptName;
        module._depends_on = queueitem.dependsOn;
        module._depended_on_by = {};
        
        for (var modName in module._depends_on) {
            modules[modName]._depended_on_by[scriptName] = true;
        }
        
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
    
    // By default, the script will only be loaded if it's not already
    // in the queue.
    //
    // Options:
    // callback: function to call when the module is loaded
    // resolver: function that will adjust the scriptName for the proper
    //           script tag location
    // force: set to true to reload this *and* its dependencies
    // reload: reload just this module.
    loadScript: function(scriptName, opts) {
        opts = opts || {};
        
        var loadQueue = bespin.plugins.loader.loadQueue;
        
        if (opts.resolver) {
            scriptName = opts.resolver(scriptName);
        }
        
        // already loading?
        if (loadQueue[scriptName] && !opts.force && !opts.reload) {
            return;
        }
        
        console.log("Queued " + scriptName + " for load");
        
        setTimeout(function() {
            if (loadQueue[scriptName]) {
                console.error("Unable to load before timeout: " + scriptName);
            }
        }, 2000);
        
        loadQueue[scriptName] = {factory: null, name: scriptName,
                                callback: opts.callback,
                                resolver: opts.resolver,
                                force: opts.force};
        bespin.plugins.loader._addScriptTag(scriptName);
    },
    
    _addScriptTag: function(fullName) {
        var s = document.createElement("script");
        var cachebreaker = new Date().getTime();
        s.setAttribute("src", fullName + "?" + cachebreaker);
        document.body.appendChild(s);
    }
});
