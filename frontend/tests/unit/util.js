dojo.provide("tests.unit.util");
dojo.require("doh.runner");

doh.register("tests.unit.util", function assertTrueTest() {
    doh.assertTrue(true);
    doh.assertTrue(1);
    doh.assertTrue(!false);
});
