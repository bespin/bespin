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

dojo.provide("bespin.plugins.loaderTest");

dojo.require("bespin.test");

bespin.test.addTests("loader", {
    setup: function() {
        this.oldAddScriptTag = bespin.plugins.loader._addScriptTag;
        bespin.plugins.loader._addScriptTag = this._addScriptTag;
    },
    
    tearDown: function() {
        console.log("teardown was called");
        bespin.plugins.loader._addScriptTag = this._addScriptTag;
    },
    
    setupTest: function() {
        this.scriptsLoaded = [];
        this.reset();
    },
    
    _addScriptTag: function() {
        // no-op for testing.
        console.log("Script tag WOULD HAVE been added if this were not a test");
    },
    
    reset: function() {
        console.log("reset called");
        bespin.plugins.loader.modules = [];
        bespin.plugins.loader.loadQueue = [];
    },
    
    resolver: function(name) {
        if (name.charAt(0) != "/") {
            name = "/js/" + name;
        }
        if (!bespin.util.endsWith(name, "\\.js")) {
            name = name + ".js";
        }
        name = "/getscript" + name;
        return name;
    },
    
    testQueueUpAModule: function(test) {
        bespin.plugins.loader.loadScript("bespin/nonModule", {resolver: this.resolver});
        var lq = bespin.plugins.loader.loadQueue;
        test.isNotUndefined(lq["/getscript/js/bespin/nonModule.js"], 
            "Expected to find module in load queue");
    },
    
    testModuleWithNoDeps: function(test) {
        var lq = bespin.plugins.loader.loadQueue;
        loadCheck = {didLoad: false};
        var modName = "/getscript/js/bespin/nonModule.js";
        
        lq[modName] = {resolver: this.resolver};
        
        bespin.plugins.loader.moduleLoaded(modName,
            function(require, exports) {
                loadCheck.didLoad = true;
                
                exports.secretValue = 27;
                
                return exports;
            });
        test.isTrue(loadCheck.didLoad);
        
        test.isUndefined(lq[modName], "Module should be gone from the queue");
        
        test.isNotUndefined(bespin.plugins.loader.modules[modName],
            "Was module object saved?");
        
        var nonModule = bespin.plugins.loader.modules[modName];
        test.isEqual(27, nonModule.secretValue);
    },
    
    testModuleWithSingleDep: function(test) {
        var lq = bespin.plugins.loader.loadQueue;
        
        loadCheck = {didLoad: false, otherDidLoad: false};
        var modName = "/getscript/js/bespin/nonModule.js";
        var depModName = "/getscript/js/bespin/depModule.js";
        
        bespin.plugins.loader.loadScript("bespin/nonModule",
                {resolver: this.resolver});
        
        bespin.plugins.loader.moduleLoaded(modName,
            function(require, exports) {
                var othermod = require("bespin/depModule");
                
                loadCheck.didLoad = true;
                
                exports.secretValue = othermod.secretValue;
                
                return exports;
            });
            
        test.isFalse(loadCheck.didLoad);
        
        test.isNotUndefined(lq[modName], "main module should be in the queue");
        test.isNotUndefined(lq[depModName], 
                "dependent module should be in queue");
        test.isNotUndefined(lq[depModName].resolver);
        
        bespin.plugins.loader.moduleLoaded(depModName,
            function(require, exports) {
                loadCheck.otherDidLoad = true;
                
                exports.secretValue = 192;
                
                return exports;
            });
        
        test.isTrue(loadCheck.didLoad, "Main module should load");
        test.isTrue(loadCheck.otherDidLoad, "Module it depended on should load");
        
        console.dir(bespin.plugins.loader.modules);
        var mod = bespin.plugins.loader.modules[modName];
        test.isNotUndefined(mod, "The main module should be requireable");
        test.isEqual(192, mod.secretValue, "secret value should have been set");
    },
    
    testModuleLoadOrderShouldNotMatter: function(test) {
        var loader = bespin.plugins.loader;
        var lq = loader.loadQueue;
        var loadCheck = {};

        loader.loadScript("/js/A.js");
        
        loader.moduleLoaded("/js/A.js",
            function(require, exports) {
                loadCheck.A = true;
                var B = require("B");
                var C = require("C");
                
                return exports;
            });
        
        test.isUndefined(loadCheck.A, "A should not have been loaded yet");
        test.isNotUndefined(lq["/js/B.js"], "B should be queued up");
        test.isNotUndefined(lq["/js/C.js"], "C should be queued up");
        
        loader.moduleLoaded("/js/B.js",
            function(require, exports) {
                loadCheck.B = true;
                var D = require("D");
                
                return exports;
            });
        
        test.isUndefined(loadCheck.A, "A should not have been loaded");
        test.isUndefined(loadCheck.B, "B should not have been loaded");
        
        // D comes in out of order
        loader.moduleLoaded("/js/D.js",
            function(require, exports) {
                loadCheck.D = true;
                return exports;
            });
        
        test.isTrue(loadCheck.D, "D should *now* have been loaded");
        test.isTrue(loadCheck.B, "B should *now* have been loaded");
        test.isUndefined(loadCheck.A, "A should not have been loaded");
        
        loader.moduleLoaded("/js/C.js",
            function(require, exports) {
                loadCheck.C = true;
                
                var D = require("D");
                
                return exports;
            });
        
        test.isTrue(loadCheck.C, "C should *now* have been loaded");
        test.isTrue(loadCheck.A, "A should *now* have been loaded");
    }
});