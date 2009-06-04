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

// = Bespin Debugger =
//
// {{{ bespin.debug }}} holds data for the Bespin debugger

dojo.provide("bespin.debug");

dojo.require("bespin.cmd.commandline");

dojo.declare("bespin.debug.EvalCommandLineInterface",
    bespin.cmd.commandline.Interface, {
    
    // complete does nothing for eval
    complete: function() {
        
    },
    
    executeCommand: function(value) {
        console.log("Evaling: " + value);
        var instruction = new bespin.cmd.commandline.Instruction(null, value);
        this.history.add(instruction);
        this.updateOutput();
        this.scrollConsole();
    }
});

dojo.mixin(bespin.debug, {
    /*
     * Array of objects that look like this:
     * { project: "project", path: "/path/to/file.js", lineNumber: 23 }
     */
    breakpoints: [],

    // any state that is sent from the target VM
    state: {},
    
    // internal ID numbers for these breakpoints.
    _sequence: 1,
    
    // has the debugbar been initialized?
    _initialized: false,

    // helper to check for duplicate breakpoints before adding this one
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

    // returns true if the two breakpoints represent the same line in the same file in the same project
    breakpointsEqual: function(b1, b2) {
        return (b1.project == b2.project && b1.path == b2.path && b1.lineNumber == b2.lineNumber);
    },

    // helper to remove a breakpoint from the breakpoints array
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

    toggleBreakpoint: function(breakpoint) {
        if (!this.addBreakpoint(breakpoint)) this.removeBreakpoint(breakpoint);
    },

    // helper to return the breakpoints that apply to the current file
    getBreakpoints: function(project, path) {
        var bps = [];   // breakpoints to return

        dojo.forEach(this.breakpoints, function(breakpoint) {
            if (breakpoint.project == project && breakpoint.path == path) bps.push(breakpoint);
        });

        return bps;
    },

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

    saveBreakpoints: function() {
        // save breakpoints back to server asynchronously
        bespin.get('files').saveFile(bespin.userSettingsProject, {
            name: "breakpoints",
            content: dojo.toJson(this.breakpoints),
            timestamp: new Date().getTime()
        });
    },
    
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
                
        var evalLine = new bespin.debug.EvalCommandLineInterface(
                'debugbar_command', {}, {
                    idPrefix: "debugbar_",
                    parentElement: dojo.byId("debugbar")
                });
        
        bespin.debug._initialized = true;
    },
    
    showDebugBar: function() {
        bespin.debug._initialize();
        dojo.style("debugbar", "display", "block");
        bespin.page.editor.recalcLayout();
    },
    
    hideDebugBar: function() {
        dojo.style("debugbar", "display", "none");
        bespin.page.editor.recalcLayout();
    }
});

bespin.subscribe("debugger:running", function() {
    var el = dojo.byId("debugbar_status");
    el.innerHTML = "Running";
    dojo.addClass(el, "running");
});

bespin.subscribe("debugger:stopped", function() {
   var el = dojo.byId("debugbar_status");
   el.innerHTML = "Stopped";
   dojo.removeClass(el, "running");
});
