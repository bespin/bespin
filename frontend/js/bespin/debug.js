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

/**
 * Bespin Debugger
 * <p>This holds the data for the Bespin debugger.
 */

dojo.provide("bespin.debug");

dojo.require("bespin.cmd.commandline");

/**
 * A simple store that currently doesn't store the history at all
 */
dojo.declare("bespin.debug.SimpleHistoryStore", null, {
    constructor: function(history) {
    },

    save: function(instructions) {}
});

/**
 * A specialization of bespin.cmd.commandline.Interface for the Javascript
 * based CLI
 */
dojo.declare("bespin.debug.EvalCommandLineInterface",
    bespin.cmd.commandline.Interface, {

    setup: function(commandLine, store, options) {
        console.log("overridden setup called");
        options = options || {};
        var idPrefix = options.idPrefix || "command_";
        var parentElement = options.parentElement || dojo.body();
        this.commandLine = dojo.byId(commandLine);
        this.setKeyBindings();
        this.history = new bespin.cmd.commandline.History(this);
        this.history.store = new bespin.debug.SimpleHistoryStore();
        this.output = dojo.byId(idPrefix + "output");
        this._resizeConnection = null;
    },

    /**
     *
     */
    setKeyBindings: function() {
        dojo.connect(this.commandLine, "onfocus", this, function() {
            bespin.publish("cmdline:focus");
        });

        dojo.connect(this.commandLine, "onblur", this, function() {
            bespin.publish("cmdline:blur");
        });

        dojo.connect(this.commandLine, "onkeypress", this, function(e) {
            var key = bespin.util.keys.Key;
            if (e.keyCode == key.ENTER) {
                var typed = this.commandLine.value;
                this.commandLine.value = '';
                this.executeCommand(typed);

                return false;
            } else if ((e.keyChar == 'n' && e.ctrlKey) || e.keyCode == key.DOWN_ARROW) {
                var next = this.history.next();
                if (next) {
                    this.commandLine.value = next.typed;
                }

                dojo.stopEvent(e);
                return false;
            } else if ((e.keyChar == 'p' && e.ctrlKey) || e.keyCode == key.UP_ARROW) {
                var prev = this.history.previous();
                if (prev) {
                    this.commandLine.value = prev.typed;
                }

                dojo.stopEvent(e);
                return false;
            } else if (e.keyChar == 'u' && e.ctrlKey) {
                this.commandLine.value = '';

                dojo.stopEvent(e);
                return false;
            }
        });
    },

    /**
     *
     */
    executeCommand: function(value) {
        if (!this.evalFunction) {
            return;
        }

        this.commandLine.value = "";

        var self = this;

        var instruction = new bespin.cmd.commandline.Instruction(null, value);
        this.executing = instruction;

        var frame = null;
        if (dojo.byId("debugbar_position").innerHTML != "") {
            var frame = 0;
        }
        this.evalFunction(value, frame, function(output) {
            console.log("EvalCL got output: " + output);
            instruction.addOutput(output);
            self.updateOutput();
        });
        this.history.add(instruction);
        this.updateOutput();
    },

    /**
     *
     */
    updateOutput: function() {
        var outputNode = this.output;
        var self = this;
        outputNode.innerHTML = "";
        dojo.forEach(this.history.instructions, function(instruction) {
            var rowin = dojo.create("div", {
                className: "command_rowin",
                onclick: function(ev) {
                    self.historyClick(instruction.typed, ev);
                },
                ondblclick: function(ev) {
                    self.historyDblClick(instruction.typed, ev);
                }
            }, outputNode);
            rowin.innerHTML = "> " + instruction.typed || "";

            var rowout = dojo.create("div", {
                className: "command_rowout"
            }, outputNode);
            rowout.innerHTML = instruction.output || "";
        });
    },

    /**
     *
     */
    resize: function() {
        if (this.resizeConnection == null) {
            this._resizeConnection = dojo.connect(window, "resize", this,
                                                this.resize);
        }
        // The total size of the debugbar is 19+47+20+100+20+X+39+16
        // where X is the size of the output, adjusted so that
        // the total matches the height of the editor canvas.
        var canvas = bespin.get("editor").canvas;
        var totalHeight = canvas.offsetHeight;
        var outputHeight = totalHeight - 261;
        dojo.style("debugbar_output", "height", outputHeight + "px");
    },

    /**
     *
     */
    clearAll: function() {
        this.history.setInstructions();
        if (this._resizeConnection != null) {
            dojo.disconnect(this._resizeConnection);
        }
        this.updateOutput();
    }
});

/**
 *
 */
dojo.mixin(bespin.debug, {
    /*
     * Array of objects that look like this:
     * { project: "project", path: "/path/to/file.js", lineNumber: 23 }
     */
    breakpoints: [],

    /** any state that is sent from the target VM */
    state: {},

    /** internal ID numbers for these breakpoints. */
    _sequence: 1,

    /** has the debugbar been initialized? */
    _initialized: false,

    /**
     * Helper to check for duplicate breakpoints before adding this one
     */
    addBreakpoint: function(newBreakpoint) {
        for (var i = 0; i < this.breakpoints.length; i++) {
            var breakpoint = this.breakpoints[i];
            if (this.breakpointsEqual(breakpoint, newBreakpoint)) return false;
        }
        newBreakpoint.id = this.sequence++;
        this.breakpoints.push(newBreakpoint);
        this.saveBreakpoints();
        bespin.publish("debugger:breakpoints:add", newBreakpoint);
        return true;
    },

    /**
     * Returns true if the two breakpoints represent the same line in the same
     * file in the same project
     */
    breakpointsEqual: function(b1, b2) {
        return (b1.project == b2.project && b1.path == b2.path && b1.lineNumber == b2.lineNumber);
    },

    /**
     * Helper to remove a breakpoint from the breakpoints array
     */
    removeBreakpoint: function(breakpointToRemove) {
        for (var i = 0; i < this.breakpoints.length; i++) {
            if (this.breakpointsEqual(this.breakpoints[i], breakpointToRemove)) {
                breakpointToRemove.id = this.breakpoints[i].id;
                this.breakpoints.splice(i, 1);
                this.saveBreakpoints();
                bespin.publish("debugger:breakpoints:remove", breakpointToRemove);
                return;
            }
        }
    },

    /**
     *
     */
    toggleBreakpoint: function(breakpoint) {
        if (!this.addBreakpoint(breakpoint)) this.removeBreakpoint(breakpoint);
    },

    /**
     * Helper to return the breakpoints that apply to the current file
     */
    getBreakpoints: function(project, path) {
        var bps = [];   // breakpoints to return

        dojo.forEach(this.breakpoints, function(breakpoint) {
            if (breakpoint.project == project && breakpoint.path == path) bps.push(breakpoint);
        });

        return bps;
    },

    /**
     *
     */
    loadBreakpoints: function(callback) {
        bespin.get('files').loadContents(bespin.userSettingsProject, "breakpoints", dojo.hitch(this, function(file) {
            this.breakpoints = dojo.fromJson(file.content);

            // reset IDs, because they are not consistent between
            // loads of Bespin.
            this.sequence = 1;
            for (var i = 0; i < this.breakpoints.length; i++) {
                this.breakpoints[i].id = this.sequence++;
            }

            if (dojo.isFunction(callback)) callback();
        }));
    },

    /**
     *
     */
    saveBreakpoints: function() {
        // save breakpoints back to server asynchronously
        bespin.get('files').saveFile(bespin.userSettingsProject, {
            name: "breakpoints",
            content: dojo.toJson(this.breakpoints),
            timestamp: new Date().getTime()
        });
    },

    /**
     *
     */
    _initialize: function() {
        if (bespin.debug._initialized) {
            return;
        }
        dojo.connect(dojo.byId("debugbar_break"), "onclick",
                    null, function() {
                        bespin.publish("debugger:break", {});
                    });

        dojo.connect(dojo.byId("debugbar_continue"), "onclick",
                    null, function() {
                        bespin.publish("debugger:continue", {});
                    });

        dojo.connect(dojo.byId("debugbar_stepnext"), "onclick",
                    null, function() {
                        bespin.publish("debugger:stepnext", {});
                    });

        dojo.connect(dojo.byId("debugbar_stepout"), "onclick",
                    null, function() {
                        bespin.publish("debugger:stepout", {});
                    });

        dojo.connect(dojo.byId("debugbar_stepin"), "onclick",
                    null, function() {
                        bespin.publish("debugger:stepin", {});
                    });

        bespin.debug.evalLine = new bespin.debug.EvalCommandLineInterface(
                'debugbar_command', null, {
                    idPrefix: "debugbar_",
                    parentElement: dojo.byId("debugbar")
                });

        bespin.debug._initialized = true;
    },

    /**
     * Note that evalFunction should be an extension point
     */
    showDebugBar: function(evalFunction) {
        bespin.debug._initialize();

        var evalLine = bespin.debug.evalLine;
        evalLine.evalFunction = evalFunction;
        dojo.style("debugbar", "display", "block");
        bespin.page.editor.recalcLayout();
        evalLine.resize();

        var settings = bespin.get("settings");
        if (settings && settings.isSettingOff("debugmode")) {
            settings.set("debugmode", "on");
        }

        bespin.debug.project = bespin.get("editSession").project;
    },

    hideDebugBar: function() {
        var evalLine = bespin.debug.evalLine;
        dojo.style("debugbar", "display", "none");
        bespin.page.editor.recalcLayout();
        evalLine.clearAll();
        bespin.debug.project = undefined;
    }
});

bespin.subscribe("debugger:running", function() {
    dojo.style("debugbar_status_running", "display", "inline");
    dojo.style("debugbar_status_stopped", "display", "none");
    dojo.byId("debugbar_position").innerHTML = "";
    dojo.style("debugbar_break", "display", "inline");
    dojo.style("debugbar_continue", "display", "none");
});

bespin.subscribe("debugger:stopped", function() {
    dojo.style("debugbar_status_running", "display", "none");
    dojo.style("debugbar_status_stopped", "display", "inline");
    dojo.style("debugbar_break", "display", "none");
    dojo.style("debugbar_continue", "display", "inline");
});

bespin.subscribe("debugger:halted", function(location) {
    var el = dojo.byId("debugbar_position");
    var newtext = "";

    if (location.exception) {
        newtext = 'Exception <span class="error">' + location.exception + "</span> at<br>";
    }

    var linenum = location.sourceLine + 1;
    if (bespin.debug.project) {
        var scriptloc = '<a onclick="bespin.get(\'commandLine\').executeCommand(\'open  ' + location.scriptName + ' ' + bespin.debug.project + ' ' + linenum + '\', true)">' + location.scriptName + ':' + linenum + '</a>';
    } else {
        var scriptloc = location.scriptName + ':' + linenum;
    }
    newtext += '<span class="code">' + location.sourceLineText + '</span><br>' +
                scriptloc;
    if (location.invocationText) {
        newtext += '<br>invoked by <span class="code">' + location.invocationText + '</span>';
    }

    el.innerHTML = newtext;
});
