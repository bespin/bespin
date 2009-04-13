dojo.provide("tests.unit.loadfiles");
dojo.require("doh.runner");

doh.register("tests.unit.loadfiles", [

    function loadInvalidFile() {
        doh.assertError(Error, dojo, "require", ["aposjdpoasdj"]);
    },

    function loadBespinCore() {
        dojo.require("bespin.bespin");
        doh.assertTrue(typeof bespin.versionNumber != "undefined");
    },
    
    function loadBespinComponent() {
        dojo.require("bespin.editor.component");
        doh.assertTrue(typeof bespin.versionNumber != "undefined");
    }

]);
