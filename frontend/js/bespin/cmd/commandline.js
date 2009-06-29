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

// = Command Line =
//
// This command line module provides everything that the command line interface needs:
//
// * {{{bespin.cmd.commandline.Interface}}} : The core command line driver. It executes commands, stores them, and handles completion
// * {{{bespin.cmd.commandline.KeyBindings}}} : Handling the special key handling in the command line
// * {{{bespin.cmd.commandline.History}}} : Handle command line history
// * {{{bespin.cmd.commandline.SimpleHistoryStore}}} : Simple one session storage of history
// * {{{bespin.cmd.commandline.ServerHistoryStore}}} : Save the history on the server in BespinSettings/command.history
// * {{{bespin.cmd.commandline.Events}}} : The custom events that the command line needs to handle

dojo.provide("bespin.cmd.commandline");

/**
 * When we are completing against some type, we need a place to cache the
 * retrieved values
 */
bespin.cmd.commandline.caches = {};

// ** {{{ bespin.cmd.commandline.Interface }}} **
//
// The core command line driver. It executes commands, stores them, and handles completion
dojo.declare("bespin.cmd.commandline.Interface", null, {
    constructor: function(commandLine, store, options) {
        this.setup(commandLine, store, options);
    },

    // Take focus so we can begin work while the pie is rendering for ex
    focus: function() {
        this.commandLine.focus();
    },

    // Dojo automatically calls superclass constructors. So,
    // if you don't want the constructor behavior, there's no
    // way out. Move to a separate function to allow overriding.
    setup: function(commandLine, store, options) {
        options = options || {};
        var idPrefix = options.idPrefix || "command_";
        var parentElement = options.parentElement || dojo.body();
        this.commandLine = dojo.byId(commandLine);

        // * Create the div for hints
        this.styles = {
            bottom: "0px",
            left: "31px"
        };

        this.commandHint = dojo.create("div", {
            id: idPrefix + "hint",
            style: "display:none; bottom: " + this.styles.bottom + "; left:" + this.styles.left + "; width:500px;"
        }, parentElement);
        dojo.connect(this.commandHint, "onclick", this, this.hideHint);

        // * Create the div for real command output
        this.output = dojo.create("div", {
            id: idPrefix + "output",
            style: "display:none;"
        }, parentElement);

        this.footer = dojo.byId("footer");

        if (bespin.get('files')) this.files = bespin.get('files');
        if (bespin.get('settings')) this.settings = bespin.get('settings');
        if (bespin.get('editor')) this.editor = bespin.get('editor');

        this.inCommandLine = false;
        this.store = store;

        this.commandLineKeyBindings = new bespin.cmd.commandline.KeyBindings(this);
        this.history = new bespin.cmd.commandline.History(this);
        this.configureEvents();
        this.hideOutput();
    },

    configureEvents: function() {
        this.customEvents = new bespin.cmd.commandline.Events(this);
    },

    showUsage: function(command) {
        var usage = command.usage || "no usage information found for " + command.name;
        this.showHint("Usage: " + command.name + " " + usage);
    },

    // == Show Hint ==
    // Hints are displayed while typing. They are transient and ignorable
    showHint: function(html) {
        if (html == null) {
            console.warning("showHint passed null");
            return;
        }

        var styles = {
            display: 'block'
        };

        // move the puppy up to the pie menu
        var piemenu = bespin.get("piemenu");
        if (piemenu && !piemenu.visible()) {
            styles.bottom = this.styles.bottom;
            styles.left = this.styles.left;
        }

        dojo.attr(this.commandHint, { innerHTML: html });
        dojo.style(this.commandHint, styles);

        if (this.hintTimeout) clearTimeout(this.hintTimeout);
        this.hintTimeout = setTimeout(dojo.hitch(this, function() {
            this.hideHint();
        }), 4600);
    },

    // == Hide Hint ==
    hideHint: function() {
        dojo.style(this.commandHint, 'display', 'none');
        if (this.hintTimeout) clearTimeout(this.hintTimeout);
    },

    // == Show Output ==
    // Show the output area in the given display rectangle
    showOutput: function(left, bottom, width, height) {
        dojo.style(this.footer, {
            left: left + "px",
            width: (width - 10) + "px",
            bottom: bottom + "px",
            display: "block"
        });
        this.focus();

        var footerHeight = dojo.style(this.footer, "height") + 2;

        var piemenu = bespin.get("piemenu");
        if (piemenu && piemenu.visible()) {
            bottom += footerHeight;
        }

        dojo.style(this.commandHint, {
            left: left + "px",
            bottom: bottom + "px",
            width: width + "px"
        });

        dojo.style(this.output, {
            left: left + "px",
            bottom: bottom + "px",
            width: width + "px",
            height: height + "px",
            display: "block"
        });

        this.maxInfoHeight = height;
    },

    // == Hide Output ==
    hideOutput: function() {
        dojo.style(this.commandHint, {
            left: "32px",
            bottom: "0px",
            width: "500px"
        });

        dojo.style(this.output, "display", "none");
        dojo.style(this.footer, {
            "left": "-10000px",
            "display": "none"
        });
        this.maxInfoHeight = null;
    },

    // == Add Element ==
    // Instead of doing output by appending strings, commands can pass in a
    // DOM node that they update. It is assumed that commands doing this will
    // provide their own progress indicators.
    setElement: function(element) {
        if (this.executing) {
            this.executing.setElement(element);
        } else {
            console.trace();
            console.debug("orphan command node:", element);
        }
    },

    // == Add Output ==
    // Complete the currently executing command with successful output
    addOutput: function(html) {
        if (this.executing) {
            this.executing.addOutput(html);
        } else {
            console.trace();
            console.debug("orphan output:", html);
        }
    },

    // == Add Error Output ==
    // Complete the currently executing command with error output
    addErrorOutput: function(html) {
        if (this.executing) {
            this.executing.addErrorOutput(html);
        } else {
            console.trace();
            console.debug("orphan error output:", html);
        }
    },

    // == Make the console scroll to the bottom ==
    scrollConsole: function() {
        // certain browsers have a bug such that scrollHeight is too small
        // when content does not fill the client area of the element
        var scrollHeight = Math.max(this.output.scrollHeight, this.output.clientHeight);
        this.output.scrollTop = scrollHeight - this.output.clientHeight;
    },

    // == Update Output ==
    // Redraw the table of executed commands
    updateOutput: function() {
        var formatTime = function(date) {
            var mins = "0" + date.getMinutes();
            if (mins.length > 2) mins = mins.slice(mins.length - 2);
            var secs = "0" + date.getSeconds();
            if (secs.length > 2) secs = secs.slice(secs.length - 2);
            return date.getHours() + ":" + mins + ":" + secs;
        };

        var size = parseInt(this.settings.get("consolefontsize"));
        var mode = this.settings.get("historytimemode");

        dojo.attr(this.output, "innerHTML", "");

        var table = dojo.create("table", {
            className: 'command_table',
            style: 'font-size:' + size + 'pt'
        }, this.output);

        var self = this;

        var count = 1;
        dojo.forEach(this.history.instructions, function(instruction) {
            if (!instruction.historical) {
                // The row for the input (i.e. what was typed)
                var rowin = dojo.create("tr", {
                    className: 'command_rowin',
                    style: "background-image: url(/images/instruction" + size + ".png)",
                    onclick: function(ev) {
                        self.historyClick(instruction.typed, ev);
                    },
                    ondblclick: function(ev) {
                        self.historyDblClick(instruction.typed, ev);
                    }
                }, table);

                // The opening column with time or history number or nothing
                var rowid = dojo.create("td", { className: 'command_open' }, rowin);
                if (mode == "history") {
                    rowid.innerHTML = count;
                    dojo.addClass(rowid, 'command_open_history');
                }
                else if (mode == "time" && instruction.start) {
                    rowid.innerHTML = formatTime(instruction.start);
                    dojo.addClass(rowid, 'command_open_time');
                }
                else {
                    dojo.addClass(rowid, 'command_open_blank');
                }

                // Cell for the typed command and the hover
                var typed = dojo.create("td", { className: 'command_main' }, rowin);

                // The execution time
                var hover = dojo.create("div", { className: 'command_hover' }, typed);

                // The execution time
                if (instruction.start && instruction.end) {
                    dojo.create("div", {
                        className: 'command_duration',
                        innerHTML: ((instruction.end.getTime() - instruction.start.getTime()) / 1000) + " sec "
                    }, hover);
                }

                // Toggle output display
                dojo.create("img", {
                    src: instruction.hideOutput ? "/images/plus.png" : "/images/minus.png",
                    style: "vertical-align:middle; padding:2px;",
                    alt: "Toggle display of the output",
                    title: "Toggle display of the output",
                    onclick: function(ev) {
                        instruction.hideOutput = !instruction.hideOutput;
                        self.updateOutput();
                        dojo.stopEvent(ev);
                    }
                }, hover);

                // Open/close output
                dojo.create("img", {
                    src: "/images/closer.png",
                    style: "vertical-align:middle; padding:2px;",
                    alt: "Remove this command from the history",
                    title: "Remove this command from the history",
                    onclick: function(ev) {
                        self.history.remove(instruction);
                        self.updateOutput();
                        dojo.stopEvent(ev);
                    }
                }, hover);

                // What the user actually typed
                dojo.create("img", {
                    className: "nohover",
                    src: "/images/prompt1.png"
                }, typed);
                dojo.create("img", {
                    className: "hover",
                    src: "/images/prompt2.png"
                }, typed);

                dojo.create("span", {
                    innerHTML: instruction.typed,
                    className: "command_typed"
                }, typed);

                // The row for the output (if required)
                if (!instruction.hideOutput) {
                    var rowout = dojo.create("tr", { className: 'command_rowout' }, table);
                    dojo.create("td", { }, rowout);
                    var td = dojo.create("td", {
                        colSpan: 2,
                        className: (instruction.error ? "command_error" : "")
                    }, rowout);

                    if (instruction.element) {
                        dojo.place(instruction.element, td);
                    } else {
                        var contents = instruction.output || "";
                        if (!instruction.completed) {
                            contents += "<img src='/images/throbber.gif'/> Working ...";
                        }
                        td.innerHTML = contents;
                    }
                }
            }
            count ++;
        });
    },

    // == Toggle Font Size ==
    toggleFontSize: function() {
        var self = this;
        var setSize = function(size) {
            self.settings.set("consolefontsize", size);
            self.updateOutput();
        };

        var size = parseInt(this.settings.get("consolefontsize"));
        switch (size) {
            case 9: setSize(11); break;
            case 11: setSize(14); break;
            case 14: setSize(9); break;
            default: setSize(11); break;
        }
    },

    // == Toggle History / Time Mode ==
    toggleHistoryTimeMode: function() {
        var self = this;
        var setMode = function(mode) {
            self.settings.set("historytimemode", mode);
            self.updateOutput();
        };

        var size = this.settings.get("historytimemode");
        switch (size) {
            case "history": setMode("time"); break;
            case "time": setMode("blank"); break;
            case "blank": setMode("history"); break;
            default: setMode("history"); break;
        }
    },

    // == History Click ==
    // A single click on an instruction line in the console copies the command
    // to the command line
    historyClick: function(command) {
        this.commandLine.value = command;
    },

    // == History Double Click ==
    // A double click on an instruction line in the console executes the command
    historyDblClick: function(command) {
        this.executeCommand(command);
    },

    // == Command line completion ==
    complete: function(value) {
        var completions = this.store.findCompletions(value);
        var matches = completions.matches;

        if (matches.length == 1) {
            var commandLineValue = matches[0];

            if (this.store.aliases[commandLineValue]) {
                this.showHint(commandLineValue + " is an alias for: " + this.store.aliases[commandLineValue]);
                // if the completewithspace setting is on, add on
                if (this.settings.isSettingOn('completewithspace')) commandLineValue += ' ';
            } else {
                var command = this.store.commands[commandLineValue] || this.store.rootCommand(value).subcommands.commands[commandLineValue];

                if (command) {
                    if (this.store.commandTakesArgs(command) &&
                        this.settings.isSettingOn('completewithspace')) {
                        commandLineValue += ' ';
                    }

                    if (command['completeText']) {
                        this.showHint(command['completeText']);
                    }

                    if (command['complete']) {
                        this.showHint(command.complete(this, value));
                    }
                }
            }

            this.commandLine.value = (completions.root ? (completions.root + ' ') : '') + commandLineValue;
        }
    },

    // == Execute Command ==
    executeCommand: function(typed, hidden) {
        if (!typed || typed == "") {
            return null;
        }

        var instruction = new bespin.cmd.commandline.Instruction(this, typed);

        if (hidden !== true) {
            this.history.add(instruction);
        }

        var self = this;
        instruction.onOutput(function() {
            self.hideHint();
            self.updateOutput();
            self.scrollConsole();
        });

        instruction.exec();

        return instruction;
    },

    // == Link Function to Instruction ==
    // Make a function be part of the thread of execution of an instruction
    link: function(action, context) {
        if (!this.executing) {
            if (context == null) return action;
            return dojo.hitch(context, action);
        }

        return this.executing.link(action, context);
    },

    handleCommandLineFocus: function(e) {
        if (this.inCommandLine) return true; // in the command line!

        if (e.keyChar == 'j' && e.ctrlKey) { // send to command line
            this.commandLine.focus();

            dojo.stopEvent(e);
            return true;
        }
        return false;
    }
});

// ** {{{ bespin.cmd.commandline.Instruction }}} **
//
// Wrapper for something that the user typed
dojo.declare("bespin.cmd.commandline.Instruction", null, {
    constructor: function(commandLine, typed) {
        this.typed = dojo.trim(typed);
        this.output = "";
        this.commandLine = commandLine;

        this._outstanding = 0;
        this._callbacks = [];

        // It is valid to not know the commandLine when we are filling the
        // history from disk, but in that case we don't need to parse it
        if (commandLine != null) {
            this.start = new Date();
            this.completed = false;

            var ca = this._splitCommandAndArgs(commandLine.store, typed);
            if (ca) {
                this.command = ca[0];
                this.args = ca[1];
            }
        } else {
            this.completed = true;
            this.historical = true;
        }
    },

    // == Exec ==
    // Execute the command
    exec: function() {
        try {
            if (this._parseError) {
                this.addErrorOutput(this._parseError);
            } else {
                this.commandLine.executing = this;
                this.command.execute(this, this.args, this.command);
            }
        }
        catch (ex) {
            if (ex instanceof TypeError) {
                console.error(ex);
            }
            this.addErrorOutput(ex);
        }
        finally {
            this.commandLine.executing = null;

            if (this._outstanding == 0) {
                this.completed = true;
                this._callbacks.forEach(function(callback) {
                    callback();
                });
            }
        }
    },

    // == Link Function to Instruction ==
    // Make a function be part of the thread of execution of an instruction
    link: function(action, context) {
        this._outstanding++;

        var self = this;
        return function() {
            try {
                action.apply(context || dojo.global, arguments);
            } finally {
                self._outstanding--;

                if (self._outstanding == 0) {
                    self.completed = true;
                    self._callbacks.forEach(function(callback) {
                        callback();
                    });
                }
            }
        };
    },

    // A hack to allow an instruction that has called link to forget all the
    // linked functions.
    unlink: function() {
       this._outstanding = 0;
       this.completed = true;
       this._callbacks.forEach(function(callback) {
           callback();
       });
   },

    // == To String ==
    // A string version of this Instruction suitable for serialization
    toString: function() {
        return dojo.toJson({
            typed: this.typed,
            output: this.output,
            start: this.start ? this.start.getTime() : -1,
            end: this.end ? this.end.getTime() : -1
        });
    },

    // == Add Output ==
    // Complete the currently executing command with successful output
    addOutput: function(html) {
        if (html && html != "") {
            if (this.output != "") this.output += "<br/>";
            this.output += html;
        }

        this.element = null;
        this.hideOutput = false;
        this.end = new Date();

        this._callbacks.forEach(function(callback) {
            callback(html);
        });
    },

    // == Add Error Output ==
    // Complete the currently executing command with error output
    addErrorOutput: function(html) {
        this.error = true;
        this.addOutput(html);
    },

    // == Add Usage Output ==
    // Complete the currently executing command with usage output
    addUsageOutput: function(command) {
        this.error = true;
        var usage = command.usage || "no usage information found for " + command.name;
        this.addOutput("Usage: " + command.name + " " + usage);
    },

    // == On Output ==
    // Monitor output that goes to an instruction
    onOutput: function(callback) {
        // Catch-up on the output so far
        callback.call(null, this.output);

        this._callbacks.push(callback);

        // TODO: return an element to allow us to unregister the listener
    },

    // == Add Element ==
    // Instead of doing output by appending strings, commands can pass in a
    // DOM node that they update. It is assumed that commands doing this will
    // provide their own progress indicators.
    setElement: function(element) {
        this.element = element;
        this.end = new Date();
        this.hideOutput = false;
        this.error = false;

        this._callbacks.forEach(function(callback) {
            callback();
        });
    },

    // == Split Command and Args
    // Private method to chop up the typed command
    _splitCommandAndArgs: function(store, typed, parent) {
        var data = typed.split(/\s+/);
        var commandname = data.shift();

        var command;
        var argstr = data.join(' ');

        if (store.commands[commandname]) {
            command = store.commands[commandname];
        } else if (store.aliases[commandname]) {
            var alias = store.aliases[commandname].split(' ');
            var aliascmd = alias.shift();
            if (alias.length > 0) {
                argstr = alias.join(' ') + ' ' + argstr;
            }
            command = store.commands[aliascmd];
        } else {
            if (commandname == "") {
                this._parseError = "Missing " + (parent == null ? "command" : "subcommand") + ".<br/>";
            } else {
                this._parseError = "Sorry, no " + (parent == null ? "command" : "subcommand") + " '" + commandname + "'.<br/>";
            }

            // Sometime I hate JavaScript ...
            var length = 0;
            for (command in store.commands) {
                length++;
            }

            // TODO: consider promoting this somewhere
            var linkup = function(exec) {
                var script = "bespin.get(\"commandLine\").executeCommand(\"" + exec + "\");";
                return "<a href='javascript:" + script + "'>" + exec + "</a>";
            };

            if (length <= 30) {
                this._parseError += "Try one of: ";
                for (command in store.commands) {
                    this._parseError += store.commands[command].name + ", ";
                }
                if (parent != null) {
                    this._parseError += "<br/>Or use '" + linkup(parent.name + " help") + "'.";
                } else {
                    this._parseError += "<br/>Or use '" + linkup("help") + "'.";
                }
            } else {
                if (parent != null) {
                    this._parseError += "Use '" + linkup(parent.name + " help") + "' to enumerate commands.";
                } else {
                    this._parseError += "Use '" + linkup("help") + "' to enumerate commands.";
                }
            }

            return null;
        }

        if (command.subcommands) {
            if (data.length < 1 || data[0] == '') data[0] = command.subcommanddefault || 'help';
            return this._splitCommandAndArgs(command.subcommands, argstr, command);
        }

        return [command, store.getArgs(argstr.split(' '), command)];
    }
});

bespin.cmd.commandline.Instruction.fromString = function(str) {

};

// ** {{{ bespin.cmd.commandline.KeyBindings }}} **
//
// Handle key bindings for the command line
dojo.declare("bespin.cmd.commandline.KeyBindings", null, {
    constructor: function(cl) {
        var settings = bespin.get("settings");

        // -- Tie to the commandLine element itself
        dojo.connect(cl.commandLine, "onfocus", cl, function() {
            bespin.publish("cmdline:focus");

            this.inCommandLine = true;
            if (dojo.byId('promptimg')) dojo.byId('promptimg').src = 'images/icn_command_on.png';
        });

        dojo.connect(cl.commandLine, "onblur", cl, function() {
            this.inCommandLine = false;
            if (dojo.byId('promptimg')) dojo.byId('promptimg').src = 'images/icn_command.png';
        });

        dojo.connect(cl.commandLine, "onkeyup", cl, function(e) {
            var command;
            if (e.keyCode >= "A".charCodeAt() && e.keyCode < "Z".charCodeAt()) { // only real letters
                var completions = this.store.findCompletions(dojo.byId('command').value).matches;
                var commandString = completions[0];
                if (completions.length > 0) {
                    var isAutoComplete = (settings && settings.isSettingOn('autocomplete'));
                    if (isAutoComplete && completions.length == 1) { // if only one just set the value
                        command = this.store.commands[commandString] || this.store.commands[this.store.aliases[commandString]];

                        var spacing = (this.store.commandTakesArgs(command)) ? ' ' : '';
                        dojo.byId('command').value = commandString + spacing;

                        if (command['completeText']) {
                            this.showHint(command['completeText']);
                        } else {
                            this.hideHint();
                        }
                    } else if (completions.length == 1) {
                        if (completions[0] != dojo.byId('command').value) {
                            this.showHint(completions.join(', '));
                        } else {
                            command = this.store.commands[completions[0]] || this.store.commands[this.store.aliases[completions[0]]];

                            if (this.store.commandTakesArgs(command)) {
                                this.complete(dojo.byId('command').value); // make it complete
                            } else {
                                this.hideHint();
                            }
                        }
                    } else {
                        this.showHint(completions.join(', '));
                    }
                }
            }
        });

        dojo.connect(cl.commandLine, "onkeypress", cl, function(e) {
            var key = bespin.util.keys.Key;

            if (e.keyChar == 'j' && e.ctrlKey) { // send back
                dojo.byId('command').blur();
                bespin.publish("cmdline:blur");

                dojo.stopEvent(e);
                return false;
            } else if ((e.keyChar == 'n' && e.ctrlKey) || e.keyCode == key.DOWN_ARROW) {
                var next = this.history.next();
                if (next) {
                    cl.commandLine.value = next.typed;
                } else {
                    this.history.pointer = this.history.instructions.length;
                    cl.commandLine.value = '';
                }

                dojo.stopEvent(e);
                return false;
            } else if ((e.keyChar == 'p' && e.ctrlKey) || e.keyCode == key.UP_ARROW) {
                var prev = this.history.previous();
                if (prev) {
                    cl.commandLine.value = prev.typed;
                }

                dojo.stopEvent(e);
                return false;
            } else if (e.keyChar == 'u' && e.ctrlKey) {
                cl.commandLine.value = '';

                dojo.stopEvent(e);
                return false;
            } else if (e.keyCode == key.ENTER) {
                var typed = cl.commandLine.value;
                this.commandLine.value = '';
                this.executeCommand(typed);

                dojo.stopEvent(e);
                return false;
            } else if (e.keyCode == key.TAB) {
                this.complete(cl.commandLine.value);

                dojo.stopEvent(e);
                return false;
            } else { // pie menu use cases here
                var piemenu = bespin.get("piemenu");
                if (piemenu) {
                    if (e.keyCode == key.ESCAPE) {
                        // ESCAPE onkeydown fails on Moz, so we need this. Why?
                        this.hideHint();
                        piemenu.hide();

                        dojo.stopEvent(e);
                        return false;
                    } else if (piemenu.keyRunsMe(e)) {
                        this.hideHint();
                        piemenu.show(piemenu.slices.off);

                        dojo.stopEvent(e);
                        return false;
                    }
                }
            }

            return true;
        });

        // ESCAPE onkeypress fails on Safari, so we need this. Why?
        dojo.connect(cl.commandLine, "onkeydown", cl, function(e) {
            if (e.keyCode == bespin.util.keys.Key.ESCAPE) {
                this.hideHint();

                // if pie menu is available
                var piemenu = bespin.get("piemenu");
                if (piemenu) piemenu.hide();
            }
        });
    }
});

// ** {{{ bespin.cmd.commandline.History }}} **
//
// Store command line history so you can go back and forth

dojo.declare("bespin.cmd.commandline.History", null, {
    constructor: function() {
        this.instructions = [];
        this.pointer = 0;
        this.store = new bespin.cmd.commandline.ServerHistoryStore(this);
    },

    settings: {
        maxEntries: 50
    },

    // Keep the history to settings.maxEntries
    trim: function() {
        if (this.instructions.length > this.settings.maxEntries) {
            this.instructions.splice(0, this.instructions.length - this.settings.maxEntries);
        }
    },

    add: function(instruction) {
        // We previously de-duped here, by comparing what was typed, but that
        // should really be done as a UI sugar on up/down.
        this.instructions.push(instruction);
        this.trim();
        this.pointer = this.instructions.length; // also make it one past the end so you can go back to it
        this.store.save(this.instructions);
    },

    remove: function(instruction) {
        var index = this.instructions.indexOf(instruction);
        if (index != -1) {
            this.instructions.splice(index, 1);
        }
    },

    next: function() {
        if (this.pointer < this.instructions.length - 1) {
            this.pointer++;
            return this.instructions[this.pointer];
        }
    },

    previous: function() {
        if (this.pointer > 0) {
            this.pointer--;
            return this.instructions[this.pointer];
        }
    },

    last: function() {
        return this.instructions[this.instructions.length - 1];
    },

    first: function() {
        return this.instructions[0];
    },

    setInstructions: function(instructions) {
        if (instructions) {
            this.instructions = instructions;
            this.trim();
        } else {
            this.instructions = [];
        }

        // Set the pointer to one past the end so you can go back and hit the
        // last one not the one before last
        this.pointer = this.instructions.length;
    },

    getInstructions: function() {
        return this.instructions;
    }
});

// ** {{{ bespin.cmd.commandline.SimpleHistoryStore }}} **
//
// A simple store that keeps the commands in memory.
dojo.declare("bespin.cmd.commandline.SimpleHistoryStore", null, {
    constructor: function(history) {
        history.seed(['ls', 'clear', 'status']);
    },

    save: function(instructions) {}
});

// ** {{{ bespin.cmd.commandline.ServerHistoryStore }}} **
//
// Store the history in BespinSettings/command.history
dojo.declare("bespin.cmd.commandline.ServerHistoryStore", null, {
    constructor: function(history) {
        this.history = history;
        var self = this;

        bespin.fireAfter([ "authenticated" ], function() {
            // load last 50 instructions from history
            bespin.get("files").loadContents(bespin.userSettingsProject, "command.history", dojo.hitch(this, function(file) {
                var typings = file.content.split(/\n/);
                var instructions = [];

                dojo.forEach(typings, function(typing) {
                    if (typing && typing != "") {
                        var instruction = new bespin.cmd.commandline.Instruction(null, typing);
                        instructions.push(instruction);
                    }
                });

                self.history.setInstructions(instructions);
            }));
        });
    },

    save: function(instructions) {
        var content = "";
        dojo.forEach(instructions, function(instruction) {
            if (instruction.typed && instruction.typed != "") {
                content += instruction.typed + "\n";
            }
        });
        // save instructions back to server asynchronously
        bespin.get("files").saveFile(bespin.userSettingsProject, {
            name: "command.history",
            content: content,
            autosave: true,
            timestamp: new Date().getTime()
        });
    }
});

//** {{{ bespin.cmd.commandline.LocalHistoryStore }}} **
//
// Store the history in BespinSettings/command.history
dojo.declare("bespin.cmd.commandline.LocalHistoryStore", null, {
    constructor: function(history) {
        this.history = history;
        var self = this;

        bespin.fireAfter([ "authenticated" ], function() {
            if (window.globalStorage) {
                var data = globalStorage[location.hostname].history;
                var instructions = dojo.fromJson(data);
                self.history.setInstructions(instructions);
            }
        });
    },

    save: function(instructions) {
        var data = dojo.toJson(instructions);
        if (window.globalStorage) {
            globalStorage[location.hostname].history = data;
        }
    }
});

// ** {{{ bespin.cmd.commandline.Events }}} **
//
// The custom events that the commandline participates in

dojo.declare("bespin.cmd.commandline.Events", null, {
    constructor: function(commandline) {

        // ** {{{ Event: command:execute }}} **
        //
        // Once the command has been executed, do something.
        bespin.subscribe("command:execute", function(event) {
            var command = event.name;
            var args    = event.args;
            if (command && args) { // if we have a command and some args
                command += " " + args;
            }

            if (command) commandline.executeCommand(command);
        });

        // -- Files
        // ** {{{ Event: editor:openfile:openfail }}} **
        //
        // If an open file action failed, tell the user.
        bespin.subscribe("editor:openfile:openfail", function(event) {
            commandline.showHint('Could not open file: ' + event.filename + " (maybe try &raquo; list)");
        });

        // ** {{{ Event: editor:openfile:opensuccess }}} **
        //
        // The open file action worked, so tell the user
        bespin.subscribe("editor:openfile:opensuccess", function(event) {
            commandline.showHint('Loaded file: ' + event.file.name);
        });

        // ** {{{ Event: ui:escape }}} **
        //
        // When escaped, take out the hints and output
        bespin.subscribe("ui:escape", function(event) {
            commandline.hideHint();
            commandline.hideOutput();
        });
    }
});
