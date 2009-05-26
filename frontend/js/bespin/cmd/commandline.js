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
// * {{{bespin.cmd.commandline.CommandStore}}} : Model to store the commands
// * {{{bespin.cmd.commandline.Interface}}} : The core command line driver. It executes commands, stores them, and handles completion
// * {{{bespin.cmd.commandline.KeyBindings}}} : Handling the special key handling in the command line
// * {{{bespin.cmd.commandline.History}}} : Handle command line history
// * {{{bespin.cmd.commandline.SimpleHistoryStore}}} : Simple one session storage of history
// * {{{bespin.cmd.commandline.ServerHistoryStore}}} : Save the history on the server in BespinSettings/command.history
// * {{{bespin.cmd.commandline.Events}}} : The custom events that the command line needs to handle

dojo.provide("bespin.cmd.commandline");

dojo.declare("bespin.cmd.commandline.CommandStore", null, {
    constructor: function(opts) {
        this.commands = {};
        this.aliases = {};

        if (opts.subCommand) {
            this.subcommandFor = opts.subCommand.name; // save the fact that we are a subcommand for this chap
            opts.subCommand.takes = ['*']; // implicit that it takes something
            opts.subCommand.subcommands = this; // link back to this store

            bespin.cmd.commands.add(opts.subCommand); // add the sub command to the root store
        }

        if (opts.initCommands) this.addCommands(opts.initCommands); // initialize the commands for the cli
    },

    addCommand: function(command) {
        if (!command) {
            return;
        }
        // -- Allow for the default [ ] takes style by expanding it to something bigger
        if (command.takes && dojo.isArray(command.takes)) {
            command = this.normalizeTakes(command);
        }

        // -- Add bindings
        if (command.withKey) {
            var args = bespin.util.keys.fillArguments(command.withKey);

            args.action = "command:execute;name=" + command.name;
            bespin.publish("editor:bindkey", args);
        }

        this.commands[command.name] = command;

        if (command['aliases']) {
            dojo.forEach(command['aliases'], function(alias) {
                this.aliases[alias] = command.name;
            }, this);
        }
    },

    addCommands: function(commands) {
        dojo.forEach(commands, dojo.hitch(this, function(command) {
            if (dojo.isString(command)) command = bespin.cmd.commands.get(command);
            this.addCommand(command);
        }));

    },

    hasCommand: function(commandname) {
        if (this.commands[commandname]) { // yup, there she blows. shortcut
            return true;
        }

        for (command in this.commands) { // try the aliases
            if (this.commands[command]['aliases']) {
                if (bespin.util.include(this.commands[command]['aliases'], commandname)) {
                    return true;
                }
            }
        }
        return false;
    },

    findCompletions: function(value, root) {
        var completions = {};

        if (root) {
            completions.root = root;
        }

        if (value.match(' ')) {
            var command = this.rootCommand(value);
            if (command && command.subcommands) {
                return command.subcommands.findCompletions(value.replace(new RegExp('^' + command.name + '\\s*'), ''), command.name);
            }
        }

        var matches = [];

        if (value.length > 0) {
            for (var command in this.commands) {
                if (command.indexOf(value) == 0) {
                  matches.push(command);
                }
            }

            for (var alias in this.aliases) {
                if (alias.indexOf(value) == 0) {
                  matches.push(alias);
                }
            }
        }

        completions.matches = matches;
        return completions;
    },

    commandTakesArgs: function(command) {
        return command.takes != undefined;
    },

    // ** {{{ getArgs }}} **
    //
    // Calculate the args object to be passed into the command.
    // If it only takes one argument just send in that data, but if it wants more, split it all up for the command and send in an object.

    getArgs: function(fromUser, command) {
        if (!command.takes) return undefined;

        var args;
        var userString = fromUser.join(' ');

        if (command.takes['*']) {
            args = new bespin.util.TokenObject(userString);
            args.rawinput = userString;

            args.varargs = args.pieces; // directly grab the token pieces as an array
        } else if (command.takes && command.takes.order.length < 2) { // One argument, so just return that
            args = userString;
        } else {
            args = new bespin.util.TokenObject(userString, { params: command.takes.order.join(' ') });
            args.rawinput = userString;
        }
        return args;
    },

    normalizeTakes: function(command) {
        // TODO: handle shorts that are the same! :)
        var takes = command.takes;
        command.takes = {
            order: takes
        };

        dojo.forEach(takes, function(item) {
            command.takes[item] = {
                "short": item[0]
            };
        });

        return command;
    },

    rootCommand: function(value) {
        return this.commands[dojo.trim(value.substring(0, value.indexOf(' ')))];
    }
});

// ** {{{ bespin.cmd.commandline.Interface }}} **
//
// The core command line driver. It executes commands, stores them, and handles completion

dojo.declare("bespin.cmd.commandline.Interface", null, {
    constructor: function(commandLine, initCommands) {
        this.commandLine = dojo.byId(commandLine);

        // * Create the div for hints
        this.commandHint = dojo.create("div", {
            id: "command_hint",
            style: "display:none; bottom:0px; left:31px; width:500px;"
        }, dojo.body());
        dojo.connect(this.commandHint, "onclick", this, this.hideHint);

        // * Create the div for real command output
        this.output = dojo.create("div", {
            id: "command_output",
            style: "display:none;"
        }, dojo.body());

        if (bespin.get('files')) this.files = bespin.get('files');
        if (bespin.get('settings')) this.settings = bespin.get('settings');
        if (bespin.get('editor')) this.editor = bespin.get('editor');

        this.inCommandLine = false;
        this.commandStore = new bespin.cmd.commandline.CommandStore({ initCommands: initCommands });

        this.commandLineKeyBindings = new bespin.cmd.commandline.KeyBindings(this);
        this.history = new bespin.cmd.commandline.History(this);
        this.customEvents = new bespin.cmd.commandline.Events(this);
        this.hideOutput();
    },

    showUsage: function(command) {
        var usage = command.usage || "no usage information found for " + command.name;
        this.showHint("Usage: " + command.name + " " + usage);
    },

    // == Show Hint ==
    // Hints are displayed while typing. They are transient and ignorable
    showHint: function(html) {
        dojo.attr(this.commandHint, { innerHTML: html })
        dojo.style(this.commandHint, "display", "block");

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
        // TODO: There are lots of magic numbers here. Sort them out
        dojo.style("footer", {
            left: left + "px",
            width: (width + 40) + "px",
            bottom: bottom + "px",
            display: "block"
        });
        dojo.byId("command").focus();

        dojo.style(this.commandHint, {
            left: left + "px",
            bottom: (bottom + dojo.style("footer", "height") + 5) + "px",
            width: width + "px",
        });

        dojo.style(this.output, {
            left: left + "px",
            bottom: (bottom + dojo.style("footer", "height") + 5) + "px",
            width: (width + 40) + "px",
            height: (height - 5) + "px",
            display: "block",
        });

        this.maxInfoHeight = height;
    },

    // == Hide Output ==
    hideOutput: function() {
        this.hideHint();
        dojo.style(this.output, "display", "none");
        dojo.style("footer", "display", "none");
        this.maxInfoHeight = null;
    },

    // == Add Output ==
    // Add some html to the currently executing command
    addOutput: function(html) {
        if (this.executing) {
            // TODO: Should we append ???
            this.executing.setOutput(html);
        } else {
            console.trace();
            console.debug("orphan output:", html);
        }

        this.hideHint();
        this.updateOutput();
        this.scrollConsole();
    },

    // == Add Error Output ==
    addErrorOutput: function(html) {
        if (this.executing) {
            // TODO: Should we append ???
            this.executing.setOutput(html);
            this.executing.error = true;
        } else {
            console.trace();
            console.debug("orphan output:", html);
        }

        this.hideHint();
        this.updateOutput();
        this.scrollConsole();
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

        var settings = bespin.get("settings");
        var size = parseInt(settings.get("consolefontsize"));
        var mode = settings.get("historytimemode");

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
                var typed = dojo.create("td", { className: 'command_typed' }, rowin);

                // The execution time
                var hover = dojo.create("div", { className: 'command_hover' }, typed);

                // The execution time
                if (instruction.start && instruction.end) {
                    dojo.create("span", {
                        innerHTML: ((instruction.end.getTime() - instruction.start.getTime()) / 1000) + " sec "
                    }, hover);
                }

                // Toggle output display
                dojo.create("img", {
                    src: instruction.hideOutput ? "/images/plus.png" : "/images/minus.png",
                    style: "vertical-align:middle; padding:2px;",
                    onclick: function() {
                        instruction.hideOutput = !instruction.hideOutput;
                        self.updateOutput();
                    }
                }, hover);

                // Open/close output
                dojo.create("img", {
                    src: "/images/closer.png",
                    style: "vertical-align:middle; padding:2px;",
                    onclick: function() {
                        self.history.remove(instruction);
                        self.updateOutput();
                    }
                }, hover);

                // What the user actually typed
                var ts = dojo.create("span", { className: 'command_prompt' }, typed);
                ts.innerHTML = ' &gt; ';
                dojo.create("span", { innerHTML: instruction.typed }, typed);

                // The row for the output (if required)
                if (!instruction.hideOutput) {
                    var rowout = dojo.create("tr", { className: 'command_rowout' }, table);
                    dojo.create("td", { }, rowout);
                    dojo.create("td", {
                        colSpan: 2,
                        className: (instruction.error ? "command_error" : ""),
                        innerHTML: (instruction.output ? instruction.output : "<img src='/images/throbber.gif'/> Working ...")
                    }, rowout);
                }
            }
            count ++;
        });
    },

    // == Toggle Font Size ==
    toggleFontSize: function() {
        var settings = bespin.get("settings");

        var self = this;
        var set = function(size) {
            settings.set("consolefontsize", size);
            self.updateOutput();
        };

        var size = parseInt(settings.get("consolefontsize"));
        switch (size) {
            case 8: set(10); break;
            case 10: set(14); break;
            case 14: set(8); break;
            default: set(10); break;
        }
    },

    // == Toggle History / Time Mode ==
    toggleHistoryTimeMode: function() {
        var settings = bespin.get("settings");

        var self = this;
        var set = function(mode) {
            settings.set("historytimemode", mode);
            self.updateOutput();
        };

        var size = settings.get("historytimemode");
        switch (size) {
            case "history": set("time"); break;
            case "time": set("blank"); break;
            case "blank": set("history"); break;
            default: set("history"); break;
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

    complete: function(value) {
        var completions = this.commandStore.findCompletions(value);
        var matches = completions.matches;

        if (matches.length == 1) {
            var commandLineValue = matches[0];

            if (this.commandStore.aliases[commandLineValue]) {
                this.showHint(commandLineValue + " is an alias for: " + this.commandStore.aliases[commandLineValue]);
                commandLineValue += ' ';
            } else {
                var command = this.commandStore.commands[commandLineValue] || this.commandStore.rootCommand(value).subcommands.commands[commandLineValue];

                if (command) {
                    if (this.commandStore.commandTakesArgs(command)) {
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

    executeCommand: function(value) {
        var instruction = new bespin.cmd.commandline.Instruction(this, value);

        // clear after the command
        this.commandLine.value = '';

        this.history.add(instruction);
        this.executing = instruction;

        try {
            if (instruction.error) {
                bespin.get('commandLine').addErrorOutput(instruction.error);
            } else {
                instruction.command.execute(this, instruction.args, instruction.command);
            }
        }
        finally {
            this.executing = null;
        }

        this.updateOutput();
    },

    link: function(action, context) {
        var closureExecuting = this.executing;
        var self = this;
        return function() {
            self.executing = closureExecuting;
            action.apply(context || dojo.global, arguments);
            self.executing = null;
        };
    },

    handleCommandLineFocus: function(e) {
        if (this.inCommandLine) return true; // in the command line!

        if (e.keyChar == 'j' && e.ctrlKey) { // send to command line
            this.commandLine.focus();

            dojo.stopEvent(e);
            return true;
        }
    }
});

// ** {{{ bespin.cmd.commandline.Instruction }}} **
//
// Wrapper for something that the user typed
dojo.declare("bespin.cmd.commandline.Instruction", null, {
    constructor: function(commandLine, typed) {
        this.typed = dojo.trim(typed);

        // It is valid to not know the commandLine when we are filling the
        // history from disk, but in that case we don't need to parse it
        if (commandLine != null) {
            this.start = new Date();

            var ca = this._splitCommandAndArgs(commandLine, typed);
            if (ca) {
                this.command = ca[0];
                this.args = ca[1];
            }
        } else {
            this.historical = true;
        }
    },

    // == Set Output ==
    // On completion we finish a command by settings it's output
    setOutput: function(output) {
        this.output = output;
        this.end = new Date();
    },

    // == Split Command and Args
    // Private method to chop up the typed command
    _splitCommandAndArgs: function(commandLine, typed) {
        var data = typed.split(/\s+/);
        var commandname = data.shift();

        var command;
        var argstr = data.join(' ');

        if (commandLine.commandStore.commands[commandname]) {
            command = commandLine.commandStore.commands[commandname];
        } else if (commandLine.commandStore.aliases[commandname]) {
            var alias = commandLine.commandStore.aliases[commandname].split(' ');
            var aliascmd = alias.shift();
            if (alias.length > 0) {
                argstr = alias.join(' ') + ' ' + argstr;
            }
            command = commandLine.commandStore.commands[aliascmd];
        } else {
            // TODO: This is a bit nasty - find a better way
            this.error = "Sorry, no command '" + commandname + "'. Maybe try to run &raquo; help";
            return;
        }

        if (command.subcommands) {
            if (data.length < 1 || data[0] == '') data[0] = command.subcommanddefault || 'help';
            return this._splitCommandAndArgs(data.join(" "));
        }

        return [command, commandLine.commandStore.getArgs(argstr.split(' '), command)];
    }
});

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
                var completions = this.commandStore.findCompletions(dojo.byId('command').value).matches;
                var commandString = completions[0];
                if (completions.length > 0) {
                    var isAutoComplete = (settings && settings.isSettingOn('autocomplete'));
                    if (isAutoComplete && completions.length == 1) { // if only one just set the value
                        command = this.commandStore.commands[commandString] || this.commandStore.commands[this.commandStore.aliases[commandString]];

                        var spacing = (this.commandStore.commandTakesArgs(command)) ? ' ' : '';
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
                            command = this.commandStore.commands[completions[0]] || this.commandStore.commands[this.commandStore.aliases[completions[0]]];

                            if (this.commandStore.commandTakesArgs(command)) {
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
                dojo.stopEvent(e);

                dojo.byId('command').blur();

                bespin.publish("cmdline:blur");

                return false;
            } else if ((e.keyChar == 'n' && e.ctrlKey) || e.keyCode == key.DOWN_ARROW) {
                dojo.stopEvent(e);

                var next = this.history.next();
                if (next) {
                    cl.commandLine.value = next.typed;
                }

                return false;
            } else if ((e.keyChar == 'p' && e.ctrlKey) || e.keyCode == key.UP_ARROW) {
                dojo.stopEvent(e);

                var prev = this.history.previous();
                if (prev) {
                    cl.commandLine.value = prev.typed;
                }

                return false;
            } else if (e.keyChar == 'u' && e.ctrlKey) {
                dojo.stopEvent(e);

                cl.commandLine.value = '';

                return false;
            } else if (e.keyCode == key.ENTER) {
                this.executeCommand(dojo.byId('command').value);

                return false;
            } else if (e.keyCode == key.TAB) {
                dojo.stopEvent(e);

                this.complete(dojo.byId('command').value);
                return false;
            } else if (e.keyCode == key.ESCAPE) {
                // ESCAPE onkeydown fails on Moz, so we need this. Why?
                this.hideHint();
                bespin.get("piemenu").hide();
                dojo.stopEvent(e);
                return false;
            } else if (bespin.get("piemenu").keyRunsMe(e)) {
                dojo.stopEvent(e);

                this.hideHint();
                var piemenu = bespin.get("piemenu");
                piemenu.showSlice(piemenu.slices.off);

                return false;
            }
        });

        // ESCAPE onkeypress fails on Safari, so we need this. Why?
        dojo.connect(cl.commandLine, "onkeydown", cl, function(e) {
            if (e.keyCode == bespin.util.keys.Key.ESCAPE) {
                this.hideHint();
                bespin.get("piemenu").hide();
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

    // TODO: get from the database
    seed: function(typings) {
        dojo.forEach(typings, function(typing) {
            if (typing && typing != "") {
                var instruction = new bespin.cmd.commandline.Instruction(null, typing);
                this.instructions.push(instruction);
            }
        }, this);
        this.trim();
        this.pointer = this.instructions.length; // make it one past the end so you can go back and hit the last one not the one before last
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

    getCommands: function() {
        return dojo.map(this.instructions, function(instruction) { return instruction.typed; });
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

        if (bespin.authenticated) {
            self.seed();
        } else {
            bespin.subscribe("authenticated", function() {
                self.seed();
            });
        }
    },

    seed: function() {
        // load last 50 instructions from history
        bespin.get('files').loadContents(bespin.userSettingsProject, "command.history", dojo.hitch(this, function(file) {
            this.history.seed(file.content.split(/\n/));
        }));
    },

    save: function(instructions) {
        var content = "";
        dojo.forEach(instructions, function(instruction) {
            if (instruction.typed && instruction.typed != "") {
                content += instruction.typed + "\n";
            }
        });
        // save instructions back to server asynchronously
        bespin.get('files').saveFile(bespin.userSettingsProject, {
            name: "command.history",
            content: content,
            timestamp: new Date().getTime()
        });
    }
});

// ** {{{ bespin.cmd.commandline.Events }}} **
//
// The custom events that the commandline participates in

dojo.declare("bespin.cmd.commandline.Events", null, {
    constructor: function(commandline) {
        // ** {{{ Event: message:output }}} **
        //
        // message:output is good output for the console
        bespin.subscribe("message:output", function(event) {
            if (event.msg) commandline.addOutput(event.msg);
        });

        // ** {{{ Event: message:output }}} **
        //
        // message:output is good output for the console
        bespin.subscribe("message:error", function(event) {
            if (event.msg) commandline.addErrorOutput(event.msg);
        });

        // ** {{{ Event: message:output }}} **
        //
        // message:output is good output for the console
        bespin.subscribe("message:hint", function(event) {
            if (event.msg) commandline.showHint(event.msg);
        });

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

        // -- Projects
        // ** {{{ Event: project:set }}} **
        //
        // When the project changes, alert the user
        bespin.subscribe("project:set", function(event) {
            var project = event.project;

            bespin.get('editSession').project = project;
            if (!event.suppressPopup) commandline.showHint('Changed project to ' + project);
        });
    }
});
