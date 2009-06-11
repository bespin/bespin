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

dojo.provide("bespin.test");

dojo.require("bespin.util.util");

//** {{{ Command: test }}} **
bespin.cmd.commands.add({
    name: 'test',
    takes: ['suite'],
    preview: 'run a test suite or suites',
    completeText: 'suite name, or \'all\' to run all tests, or press return to list tests.',
    // ** {{{execute}}}
    execute: function(commandline, suite) {
        if (!suite) {
            if (bespin.util.isEmpty(bespin.test._knownTests)) {
                commandline.addOutput("No test suites registered. See bespin.test.addTests() to add them.");
            } else {
                var msg = "Available test targets: all";
                for (var name in bespin.test._knownTests) {
                    msg += ", " + name;
                }
                commandline.addOutput(msg);
            }
        } else if (suite == "all") {
            // TODO: run all tests
        } else {
            if (bespin.test._knownTests[suite]) {
                // TODO: run just suite
            } else {
                commandline.addErrorOutput("No test suite called: " + suite);
            }
        }
    }
});

/**
 * The bespin.test object is used in setting up test suites.
 */
dojo.mixin(bespin.test, {
    /**
     * Add a named test suite to the list of available tests
     * @param name The new test suite name
     * @param container Object containing setup|teardown|test* methods
     */
    addTests: function(name, container) {
        if (name == "all") throw new Error("Test suites can't be called 'all'");
        this._knownTests[name] = container;
    },

    /**
     * @private
     * Registered tests are stored in here
     */
    _knownTests: {}
});

dojo.declare("bespin.test.Runner", null, {
    constructor: function(opts) {
    }
});
