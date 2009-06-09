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

dojo.provide("bespin.test.runner");

/**
 * All tests are in one of 5 states, slightly evil that we are blurring the
 * UI display in here.
 */
bespin.test.runner._status = {
    notrun:      { ord:0, color:"#000", backgroundColor:"#eee", name:"Skipped" },
    executing:   { ord:1, color:"#fff", backgroundColor:"#888", name:"Executing" },
    asynchronous:{ ord:2, color:"#000", backgroundColor:"#ffa", name:"Waiting" },
    pass:        { ord:3, color:"#000", backgroundColor:"#8f8", name:"Pass" },
    fail:        { ord:4, color:"#fff", backgroundColor:"#f00", name:"Fail" }
};

/**
 * All the tests keyed on the test name, with the value being a object like
 * { func:function..., name:testName, status:..., group:groupName, messages:[] }
 */
bespin.test.runner._tests = {};

/**
 * Each array contains a list of test names that are in that group
 */
bespin.test.runner._groups = { 'Global':[] };

/**
 * The delay between setting of tests
 */
bespin.test.runner._delay = 20;

/**
 * the setTimeout response for the timer to ensure that we update the
 * display even when things are going slowly
 * TODO: Is this the right way to do things?
 */
bespin.test.runner._boredTimeout = null;

/**
 * Even though several tests may be running at a time, through the magic of
 * the single thredded nature of JavaScript we can say that there is only
 * one that is actually current when the test itself or one of its
 * asynchronous handlers are running.
 */
bespin.test.runner._currentTest = null;

/**
 * Setup the tests.
 * @param displayId An id under which we should create our output table
 * @param parent The object which contains the tests (default = window).
 */
bespin.test.runner.init = function(displayId, parent) {
    this.addTests(parent);
    this.displayTestTable(displayId);
};

/**
 * Introspect an object looking for functions called test* and adding them
 * to the test suite
 */
bespin.test.runner.addTests = function(parent) {
    var parent = parent || window;
    for (var prop in parent) {
        var member = parent[prop];
        if (prop.match(/test/) && typeof member == "function") {
            this.addTest(prop, member);
        }
    }
};

/**
 * Add a single test into the test suite
 */
bespin.test.runner.addTest = function(testName, func) {
    var groupName = "Global";
    for (var i = 0; i < groupNames.length; i++) {
        if (testName.indexOf("test" + groupNames[i]) == 0) {
            groupName = groupNames[i];
        }
    }

    this._groups[groupName].push(testName);
    this._tests[testName] = {
        func: func,
        name: testName,
        status: stati.notrun,
        group: groupName,
        messages: []
    };
};

/**
 * Tests can optionally be packaged into groups called when the tests are
 * called testGroupname*
 */
bespin.test.runner.createTestGroup = function(groupName) {
    this._groups[groupName] = [];
};

/**
 * Create a table structure showing the available tests
 */
bespin.test.runner.displayTestTable = function(displayId) {
    this._root = dojo.byId(displayId);

    var table = dojo.create("table", {
        className: "grey form",
        innerHTML: "<thead><tr><th>#</th><th>Group</th><th>Run</th><th>Results</th><th>Actions</th></tr></thead>"
    }, root);
    this._tbody = dojo.create("tbody", { }, table);

    this._output = dojo.create("div", { }, root);

    var testNum = 0;
    for (var groupName in this._groups) {
        var testNames = this._groups[groupName];
        testNames.sort();

        var row = dojo.create("tr", { }, this._tbody);
        var header = dojo.create("th", { }, row);
        dojo.create("a", {
            className: "headInline",
            id: "groupDisplay" + groupName,
            onclick: this._toggleGroup(groupName),
            innerHTML: "Show"
        }, header);
        dojo.create("td", { innerHTML: "<strong>" + groupName + "</strong>" }, row);
        dojo.create("td", { id: "groupStarted" + options.rowData }, row);
        dojo.create("td", { id: "groupCount" + options.rowData }, row);
        dojo.create("td", { innerHTML: '<input type="button" value="Run Group" onclick="runTestGroup(\'' + groupName + '\')"/>' }, row);
        dojo.create("td", { innerHTML: "<div id='scratch" + groupName + "'></div>" }, row);

        var addSpaces = function(funcName) {
            funcName = funcName.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
            funcName = funcName.replace(/([a-zA-Z])([0-9])/g, "$1 $2");
            return funcName;
        };

        testNames.forEach(function(testName) {
            var row = dojo.create("tr", { className: "groupDetail" + groupName }, this._tbody);
            dojo.create("th", { innerHTML: "" + (++testNum) }, row);
            funcCell = dojo.create("td", { innerHTML: data }, row);
            // We did add    title='" + dwr.util.escapeHtml(tests[testName].func.toString()) + "'
            // But this confuses things because we're not currently escaping for attributes properly
            // The best solution is a better drilldown thing anyway because the wrapping is wrong here
            var stripPrefixStart = 4 + (groupName == "Global" ? 0 : groupName.length);
            dojo.create("a", {
                id: "testDisplay" + groupName,
                onclick: function(testName) {
                    var tog = dojo.byId("testDetail" + testName);
                    tog.style.display = (tog.style.display == "none") ? "block" : "none";
                },
                innerHTML: addSpaces(testName.substring(stripPrefixStart))
            }, funcCell);
            dojo.create("pre", {
                style: "display:none",
                className: "codeBlock",
                id: "testDetail" + testName,
                innerHTML: tests[testName].func.toString()
            }, funcCell);
            dojo.create("td", { innerHTML: "<span id='asyncReturn" + testName + "'>0</span>/<span id='asyncSent" + testName + "'>0</span>" }, row);
            dojo.create("td", { id: options.rowData }, row);
            dojo.create("td", { innerHTML: "<input type='button' value='Run Test' onclick='runTest(\"" + testName + "\");'/>" }, row);
            dojo.create("td", { innerHTML: "<div id='scratch" + testName + "'></div>" }, row);
        });

        this._toggleGroup(groupName);
    }

    var row = dojo.create("tr", { }, this._tbody);
    dojo.create("th", {  }, row);
    dojo.create("th", { innerHTML: "<strong>All</strong>" }, row);
    dojo.create("th", { id: "testsStarted" }, row);
    dojo.create("th", { id: "testCount" }, row);
    dojo.create("th", { innerHTML: '<input type="button" value="Run All" onclick="runAllTests();"/>' }, row);
    dojo.create("th", { innerHTML: "<div id='scratchAll'></div>" }, row);

    for (var testName in tests) {
        tests[testName].scratch = dojo.byId("scratch" + testName);
    }
    this._updateTestResults();
};

/**
 *
 */
bespin.test.runner._toggleGroup = function(groupName) {
    var toToggle = dojo.query(".groupDetail" + groupName);
    if (toToggle.length > 0) {
        if (toToggle[0].style.display == "none") {
            toToggle.forEach(function(node) {
                toToggle[i].style.display = "block";
            });
            dojo.byId("groupDisplay" + groupName).value = "Hide";
        }
        else {
            for (var i = 0; i < toToggle.length; i++) {
                toToggle[i].style.display = "none";
            }
            dojo.byId("groupDisplay" + groupName).value = "Show";
        }
    }
};

/**
 * Update the table to show the current test status
 */
bespin.test.runner.updateTestResults = function() {
    var counts = [ 0, 0, 0, 0, 0 ];
    var groupCounts = {};
    for (var i = 0; i < groupNames.length; i++) {
        groupCounts[groupNames[i]] = [ 0, 0, 0, 0, 0 ];
    }

    var testCount = 0;
    for (var testName in tests) {
        var test = tests[testName];
        counts[test.status]++;
        groupCounts[test.group][test.status]++;
        testCount++;
    }

    for (var i = 0; i < groupNames.length; i++) {
        var groupName = groupNames[i];
        var groupCount = groups[groupName].length;
        var groupStatus = groupCounts[groupName];

        var outstanding = groupStatus[this._status.asynchronous.ord] + groupStatus[this._status.executing.ord];
        var failed = groupStatus[this._status.fail.ord];
        var passed = groupStatus[this._status.pass.ord];
        var started = groupCount - groupStatus[this._status.notrun.ord];

        dojo.byId("groupCount" + groupName).innerHTML = "Pass:" + passed + " Fail:" + failed;
        dojo.byId("groupStarted" + groupName).innerHTML = started + "/" + (started - outstanding);

        dojo.byId("groupCount" + groupName).style.backgroundColor = "";
        dojo.byId("groupCount" + groupName).style.color = "";

        if (failed > 0) {
            status = this._status.fail;
        }
        if (outstanding > 0 && failed > 0) {
            status = this._status.asynchronous;
        }
        if (passed == groupCount) {
            status = this._status.pass;
        }

        dojo.byId("groupCount" + groupName).style.backgroundColor = status.backgroundColor;
        dojo.byId("groupCount" + groupName).style.color = status.color;
    }

    var outstanding = counts[this._status.asynchronous.ord] + counts[this._status.executing.ord];
    var failed = counts[this._status.fail.ord];
    var passed = counts[this._status.pass.ord];
    var started = testCount - counts[this._status.notrun.ord];

    dojo.byId("testCount").innerHTML = "Pass:" + passed + " Fail:" + failed;
    dojo.byId("testsStarted").innerHTML = started + "/" + (started - outstanding);

    if (failed > 0) {
        status = this._status.fail;
    }
    if (outstanding > 0 && failed > 0) {
        status = this._status.asynchronous;
    }
    if (passed == testCount) {
        status = this._status.pass;
    }

    dojo.byId("testCount").style.backgroundColor = status.backgroundColor;
    dojo.byId("testCount").style.color = status.color;
};

/**
 * Go through all the tests setting them off
 */
bespin.test.runner.runAllTests = function() {
    var testNames = [];
    for (var testName in this._tests) {
        testNames.push(testName);
    }
    testNames.sort();
    this._runNextTest(testNames, 0);
};

/**
 * Set off all the tests in a specific group
 */
bespin.test.runner.runTestGroup = function(groupName) {
    var testNames = this._groups[groupName];
    if (testNames == null) {
        throw new Error("No test group called: " + groupName);
    }
    this._runNextTest(testNames, 0);
};

/**
 * Runner to walk through an array of tests with an index, run the next and
 * schedule a timer for the followup until they are all done.
 */
bespin.test.runner._runNextTest = function(testNames, i) {
    if (i >= testNames.length) {
        this._boredTimeout = setTimeout(function() {
            this._updateTestResults(true);
        }, 10000);
        return;
    }
    this.runTest(testNames[i]);

    setTimeout(function() {
        this._runNextTest(testNames, i + 1);
    }, this._delay);
};

/**
 * Fires of a single test
 */
bespin.test.runner.runTest = function(testName) {
    var subTest = (this._currentTest != null);
    if (!subTest) {
        this._currentTest = this._tests[testName];
    }

    this._setStatus(this._currentTest, this._status.executing, true);
    this._currentTest.messages = [];
    dojo.byId(this._currentTest.name).value = "";

    var scope = this._currentTest.scope || window;
    try {
        this._currentTest.func.apply(scope, [ this ]);
    }
    catch (ex) {
        this._setStatus(this.currentTest, this._status.fail);
        if (ex.message && ex.message.length > 0) {
            this._record(ex.message);
        }
        window.console && console.trace();
    }
    if (this._currentTest.status == stati.executing) {
        this._setStatus(this._currentTest, this._status.pass, true);
    }

    if (!subTest) {
        this._currentTest = null;
    }
    this._updateTestResults(false);
};

/**
 * Associate a function to be run in an asynchronous context with the
 * currently executing test.
 */
bespin.test.runner.link = function(func) {
    this._setStatus(this._currentTest, this._status.asynchronous, true);
    var delayedTest = this._currentTest;
    // Keep a count of the outstanding asynchrous tasks
    if (!delayedTest.outstanding) {
        delayedTest.outstanding = 1;
    }
    else {
        delayedTest.outstanding++;
    }

    var asyncSent = dojo.byId("asyncSent" + currentTest.name);
    asyncSent.value = asyncSent.value + 1;

    var self = this;
    return function() {
        var isSync = (this._currentTest != null);
        this._currentTest = delayedTest;
        if (typeof func == "function") {
            try {
                func.apply(this, arguments);
            }
            catch (ex) {
                self._setStatus(self._currentTest, self._status.fail);
                if (ex.message && ex.message.length > 0) {
                    self._record(ex.message);
                }
                window.console && console.trace();
            }
        }
        delayedTest.outstanding--;
        if (delayedTest.outstanding == 0 && delayedTest.status == self._status.asynchronous) {
            self._setStatus(self._currentTest, self._status.pass, true);
        }

        var asyncReturn = dojo.byId("asyncReturn" + self._currentTest.name);
        asyncReturn.value = asyncReturn.value + 1;

        if (!isSync) {
            self._currentTest = null;
        }
        self._updateTestResults(false);
    };
};

/**
 * Create a function which will report an error to a test if it is called.
 */
bespin.test.runner.createOnError = function(func) {
    var delayedTest = this._currentTest;

    var self = this;
    return function() {
        this._currentTest = delayedTest;
        this._setStatus(this._currentTest, this._status.fail);
        if (func == null) {
            this._record("Executing delayed error handler: " + this._toDescriptiveString(Array().slice.call(arguments), 3));
        }
        else if (typeof func == "function") {
            this._record("Executing delayed error handler: " + this._toDescriptiveString(Array().slice.call(arguments), 3));
            func.apply(this, arguments);
        }
        else if (typeof func == "string") {
            this._record("Executing delayed error handler: " + func);
        }
        else {
            this._record("Executing delayed error handler: " + this._toDescriptiveString(Array().slice.call(arguments), 3));
        }
        this._currentTest = null;
        this._updateTestResults(false);
    };
};

/**
 * Assorted assert/verify/success/fail functions
 */
bespin.test.runner.assertTrue = function(value) {
    if (!value) this._recordThrow("assertTrue", arguments);
};
bespin.test.runner.verifyTrue = function(value) {
    if (!value) this._recordTrace("verifyTrue", arguments);
};
bespin.test.runner.assertFalse = function(value) {
    if (value) this._recordThrow("assertFalse", arguments);
};
bespin.test.runner.verifyFalse = function(value) {
    if (value) this._recordTrace("verifyFalse", arguments);
};
bespin.test.runner.assertNull = function(value) {
    if (value !== null) this._recordThrow("assertNull", arguments);
};
bespin.test.runner.verifyNull = function(value) {
    if (value !== null) this._recordTrace("verifyNull", arguments);
};
bespin.test.runner.assertNotNull = function(value) {
    if (value === null) this._recordThrow("assertNotNull", arguments);
};
bespin.test.runner.verifyNotNull = function(value) {
    if (value === null) this. _recordTrace("verifyNotNull", arguments);
};
bespin.test.runner.assertUndefined = function(value) {
    if (value !== undefined) this._recordThrow("assertUndefined", arguments);
};
bespin.test.runner.verifyUndefined = function(value) {
    if (value !== undefined) this._recordTrace("verifyUndefined", arguments);
};
bespin.test.runner.assertNotUndefined = function(value) {
    if (value === undefined) this._recordThrow("assertNotUndefined", arguments);
};
bespin.test.runner.verifyNotUndefined = function(value) {
    if (value === undefined) this._recordTrace("verifyNotUndefined", arguments);
};
bespin.test.runner.assertNaN = function(value) {
    if (!isNaN(value)) this._recordThrow("assertNaN", arguments);
};
bespin.test.runner.verifyNaN = function(value) {
    if (!isNaN(value)) this. _recordTrace("verifyNaN", arguments);
};
bespin.test.runner.assertNotNaN = function(value) {
    if (isNaN(value)) this. _recordThrow("assertNotNaN", arguments);
};
bespin.test.runner.verifyNotNaN = function(value) {
    if (isNaN(value)) this._recordTrace("verifyNotNaN", arguments);
};
bespin.test.runner.assertEqual = function(expected, actual) {
    if (!this._isEqual(expected, actual)) this._recordThrow("assertEqual", arguments);
};
bespin.test.runner.verifyEqual = function(expected, actual) {
    if (!this._isEqual(expected, actual)) this._recordTrace("verifyEqual", arguments);
};
bespin.test.runner.assertNotEqual = function(expected, actual) {
    if (this._isEqual(expected, actual)) this._recordThrow("assertNotEqual", arguments);
};
bespin.test.runner.verifyNotEqual = function(expected, actual) {
    if (!this._isEqual(expected, actual)) this._recordTrace("verifyNotEqual", arguments);
};
bespin.test.runner.fail = function(message) {
    this._recordThrow("fail", arguments);
};
bespin.test.runner.success = function(message) {
    this._appendMessage(message);
};


//---------------------------------------------------------------------------
//= Private Functions Start Here =

// See http://helephant.com/2007/05/diy-javascript-stack-trace/

/**
 *
 */
bespin.test.runner._recordTrace = function() {
    this._record.apply(this, arguments);
    window.console && console.trace();
};

/**
 *
 */
bespin.test.runner._recordThrow = function() {
    this._record.apply(this, arguments);
    throw new Error();
};

/**
 *
 */
bespin.test.runner._record = function() {
    window.console && console.error(arguments);
    this._setStatus(this._currentTest, this._status.fail);
    var message = arguments[0] + "(";
    var data = arguments[1];
    if (typeof data == "string") {
        message += data;
    }
    else {
        for (var i = 0; i < data.length; i++) {
            if (i != 0) message += ", ";
            message += this._toDescriptiveString(data[i], 3);
        }
    }
    message += ")";
    this._appendMessage(this._currentTest, message);
};

/**
 *
 */
bespin.test.runner._appendMessage = function(test, message) {
    test.messages.push(message);
    var output = test.messages.join("<br />");
    dojo.byId(test.name).innerHTML = output;
};

/**
 *
 */
bespin.test.runner._setStatus = function(test, newStatus, override) {
    if (typeof test == "string") {
        test = tests[test];
    }
    if (test.status < newStatus || override) {
        test.status = newStatus;
    }
    dojo.byId(test.name).style.backgroundColor = newStatus.backgroundColor;
    dojo.byId(test.name).style.color = newStatus.colors;
};


/**
 *
 */
bespin.test.runner._isEqual = function(expected, actual, depth) {
    if (!depth) depth = 0;
    // Rather than failing we assume that it works!
    if (depth > 10) return true;

    if (expected == null) {
        if (actual != null) {
            console.log("expected: null, actual non-null: " + this._toDescriptiveString(actual));
            return false;
        }
        return true;
    }

    if (typeof(expected) == "number" && isNaN(expected)) {
        if (!(typeof(actual) == "number" && isNaN(actual))) {
            console.log("expected: NaN, actual non-NaN: " + this._toDescriptiveString(actual));
            return false;
        }
        return true;
    }

    if (actual == null) {
        if (expected != null) {
            console.log("actual: null, expected non-null: " + this._toDescriptiveString(expected));
            return false;
        }
        return true; // we wont get here of course ...
    }

    if (typeof expected == "object") {
        if (!(typeof actual == "object")) {
            console.log("expected object, actual not an object");
            return false;
        }

        var actualLength = 0;
        for (var prop in actual) {
            if (typeof actual[prop] != "function" || typeof expected[prop] != "function") {
                var nest = this._isEqual(actual[prop], expected[prop], depth + 1);
                if (typeof nest != "boolean" || !nest) {
                    console.log("element '" + prop + "' does not match: " + nest);
                    return false;
                }
            }
            actualLength++;
        }

        // need to check length too
        var expectedLength = 0;
        for (prop in expected) expectedLength++;
        if (actualLength != expectedLength) {
            console.log("expected object size = " + expectedLength + ", actual object size = " + actualLength);
            return false;
        }
        return true;
    }

    if (actual != expected) {
        console.log("expected = " + expected + " (type=" + typeof expected + "), actual = " + actual + " (type=" + typeof actual + ")");
        return false;
    }

    if (expected instanceof Array) {
        if (!(actual instanceof Array)) {
            console.log("expected array, actual not an array");
            return false;
        }
        if (actual.length != expected.length) {
            console.log("expected array length = " + expected.length + ", actual array length = " + actual.length);
            return false;
        }
        for (var i = 0; i < actual.length; i++) {
            var inner = this._isEqual(actual[i], expected[i], depth + 1);
            if (typeof inner != "boolean" || !inner) {
                console.log("element " + i + " does not match: " + inner);
                return false;
            }
        }

        return true;
    }

    return true;
};


