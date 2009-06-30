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
    },
    
    reset: function() {
        bespin.plugins.loader.modules = [];
        bespin.plugins.loader.loadQueue = [];
    },
    
    testQueueUpAModule: function(test) {
        bespin.plugins.loader.loadScript("/js/bespin/nonModule.js");
        var lq = bespin.plugins.loader.loadQueue;
        test.isEqual(1, lq.length);
        test.isNotUndefined(lq["/js/bespin/nonModule.js"]);
    },
    
    testModuleWithNoDeps: function(test) {
        loadCheck = {didLoad: false};
        var modName = "/js/bespin/nonModule.js";
        bespin.plugins.loader.moduleLoaded(modName,
            function(require, exports) {
                loadCheck.didLoad = true;
                
                exports.secretValue = 27;
                
                return exports;
            });
        test.isTrue(loadCheck.didLoad);
        test.isNotUndefined(bespin.plugins.loader.modules[modName],
            "Was module object saved?");
        
        var nonModule = bespin.plugins.loader.require("bespin/nonModule");
        test.isEqual(27, nonModule.secretValue);
    },
    
    testModuleWithSingleDep: function(test) {
        var lq = bespin.plugins.loader.loadQueue;
        
        loadCheck = {didLoad: false, otherDidLoad: false};
        var modName = "/js/bespin/nonModule.js";
        var depModName = "/js/bespin/depModule.js";
        
        bespin.plugins.loader.loadScript(modName);
    
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
        
        bespin.plugins.loader.moduleLoaded(depModName,
            function(require, exports) {
                loadCheck.otherDidLoad = true;
                
                exports.secretValue = 192;
                
                return exports;
            });
        
        test.isTrue(loadCheck.didLoad, "Main module should load");
        test.isTrue(loadCheck.otherDidLoad, "Module it depended on should load");
        
        var mod = bespin.plugins.loader.require(modName);
        test.isEqual(192, mod.secretValue, "secret value should have been set");
    }
});