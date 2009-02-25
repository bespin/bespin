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
// * {{{bespin.cmd.commandline.Interface}}} : The base class itself. The actually interface.
// * {{{bespin.cmd.commandline.KeyBindings}}} : Handling the special key handling in the command line
// * {{{bespin.cmd.commandline.History}}} : Handle command line history
// * {{{bespin.cmd.commandline.SimpleHistoryStore}}} : Simple one session storage of history
// * {{{bespin.cmd.commandline.Events}}} : The custom events that the command line needs to handle

dojo.provide("bespin.cmd.commandline");

// ** {{{ bespin.cmd.commandline.Interface }}} **
//
// The core command line driver. It executes commands, stores them, and handles completion

dojo.declare("bespin.cmd.commandline.Interface", null, {
    constructor: function(commandLine, initCommands) {
        this.commandLine = commandLine;

        if (window['_files']) this.files = _files;        
        if (window['_settings']) this.settings = _settings;
        if (window['_editor']) this.editor = _editor;

        this.inCommandLine = false;
        this.commands = {};
        this.aliases = {};

        this.commandLineKeyBindings = new bespin.cmd.commandline.KeyBindings(this);
        this.commandLineHistory = new bespin.cmd.commandline.History(this);
        this.customEvents = new bespin.cmd.commandline.Events(this);

        if (initCommands) this.addCommands(initCommands); // initialize the commands for the cli
    },

    executeCommand: function(value) {
        var data = value.split(/\s+/);
        var commandname = data.shift();

        var command;

        if (this.commands[commandname]) {
            command = this.commands[commandname];
        } else if (this.aliases[commandname]) {
            command = this.commands[this.aliases[commandname]];
        } else {
            this.showInfo("Sorry, no command '" + commandname + "'. Maybe try to run &raquo; help", true);
            return;
        }

        bespin.publish("bespin:cmdline:executed", [{ command: command, args: data.join(' ') }]);

        command.execute(this, this.getArgs(data, command));
        this.commandLine.value = ''; // clear after the command
    },
      
    addCommand: function(command) {
        // -- Allow for the default [ ] takes style by expanding it to something bigger
        if (command.takes && dojo.isArray(command.takes)) {
            command = this.normalizeTakes(command); 
        }  

        // -- Add bindings
        if (command.withKey) {             
            var args = bespin.util.keys.fillArguments(command.withKey);

            args.action = "bespin:cmdline:execute;name=" + command.name;
            bespin.publish("bespin:editor:bindkey", [args]);
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

    showUsage: function(command, autohide) {
        var usage = command.usage || "no usage information found for " + command.name;
        this.showInfo("Usage: " + command.name + " " + usage, autohide);
    },
    
    showInfo: function(html, autohide) {
        this.hideInfo();

        dojo.byId('info').innerHTML = html;
        dojo.style('info', 'display', 'block'); 
        dojo.connect(dojo.byId('info'), "onclick", this, "hideInfo");

        if (autohide) {
            this.infoTimeout = setTimeout(dojo.hitch(this, function() {
                this.hideInfo();
            }), 4600);
        }
    },

    hideInfo: function() {
        dojo.style('info', 'display', 'none');
        if (this.infoTimeout) clearTimeout(this.infoTimeout);
    },

    findCompletions: function(value) {
        var matches = [];

        if (value.length > 0) {
            for (command in this.commands) {
                if (command.indexOf(value) == 0) {
                  matches.push(command);
                }

                if (this.commands[command]['aliases']) {
                    dojo.forEach(this.commands[command]['aliases'], function(alias) {
                        if (alias.indexOf(value) == 0) {
                          matches.push(alias);
                        }
                    });
                }
            }
        }

        return matches;
    },

    complete: function(value) {
        var matches = this.findCompletions(value);
        if (matches.length == 1) {
            var command = this.commands[matches[0]] || this.commands[this.aliases[matches[0]]];

            var commandLineValue = matches[0];

            if (this.commandTakesArgs(command)) {
                commandLineValue += ' ';
            }
            this.commandLine.value = commandLineValue;

            if (command['completeText']) {
                this.showInfo(command['completeText']);
            }

            if (command['complete']) {
                this.showInfo(command.complete(this, value));
            }
        }
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

        if (command.takes && command.takes.order.length < 2) { // One argument, so just return that
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
        }
        
        dojo.forEach(takes, function(item) {
            command.takes[item] = {
                "short": item[0]
            }
        });

        return command;
    },
    
    handleCommandLineFocus: function(e) {
        if (this.inCommandLine) return true; // in the command line!

        if (e.keyCode == bespin.util.keys.Key.J && e.ctrlKey) { // send to command line
            this.commandLine.focus();

            dojo.stopEvent(e);
            return true;
        }
    }

});

// ** {{{ bespin.cmd.commandline.KeyBindings }}} **
//
// Handle key bindings for the command line

dojo.declare("bespin.cmd.commandline.KeyBindings", null, {
    constructor: function(cl) {        
        // -- Tie to the commandLine element itself     
        dojo.connect(cl.commandLine, "onfocus", dojo.hitch(cl, function() {
            if (window['_editor']) _editor.setFocus(false);
            this.inCommandLine = true;
            dojo.byId('promptimg').src = 'images/icn_command_on.png';
        }));
        dojo.connect(cl.commandLine, "onblur", dojo.hitch(cl, function() {
            this.inCommandLine = false;
            dojo.byId('promptimg').src = 'images/icn_command.png';
        }));
        
        dojo.connect(cl.commandLine, "onkeyup", dojo.hitch(cl, function(e) {
            var Key = bespin.util.keys.Key;

            if (e.keyCode >= Key.A && e.keyCode < Key.Z) { // only real letters
                var completions = this.findCompletions(dojo.byId('command').value);
                var commandString = completions[0];
                if (completions.length > 0) {
                    var isAutoComplete = _settings.isOn(_settings.get('autocomplete'));
                    if (isAutoComplete && completions.length == 1) { // if only one just set the value
                        var command = this.commands[commandString] || this.commands[this.aliases[commandString]];

                        var spacing = (this.commandTakesArgs(command)) ? ' ' : '';
                        dojo.byId('command').value = commandString + spacing;
                
                        if (command['completeText']) {
                            this.showInfo(command['completeText']);
                        } else {
                            this.hideInfo();
                        }
                    } else if (completions.length == 1) {
                        if (completions[0] != dojo.byId('command').value) {
                            this.showInfo(completions.join(', '));
                        } else {
                            var command = this.commands[completions[0]] || this.commands[this.aliases[completions[0]]];

                            if (this.commandTakesArgs(command)) {
                                this.complete(dojo.byId('command').value); // make it complete
                            } else {
                                this.hideInfo();
                            }
                        }
                    } else {
                        this.showInfo(completions.join(', '));
                    }
                }
            }
        }));             
        
        dojo.connect(cl.commandLine, "onkeydown", dojo.hitch(cl, function(e) {
            var Key = bespin.util.keys.Key; // alias
            if (e.keyCode == Key.J && e.ctrlKey) { // send back
                dojo.stopEvent(e);

                dojo.byId('command').blur();
                if (window['_editor']) _editor.setFocus(true);

                return false;
            } else if ((e.keyCode == Key.N && e.ctrlKey) || e.keyCode == Key.ARROW_DOWN) {
                this.commandLineHistory.setNext();
                return false;
            } else if ((e.keyCode == Key.P && e.ctrlKey) || e.keyCode == Key.ARROW_UP) {
                this.commandLineHistory.setPrevious();
                return false;
            } else if (e.keyCode == Key.ENTER) {
                this.executeCommand(dojo.byId('command').value);

                return false;
            } else if (e.keyCode == Key.TAB) {
                dojo.stopEvent(e);
                
                this.complete(dojo.byId('command').value);
                return false;
            } else if (e.keyCode == Key.ESCAPE) {
                this.hideInfo();
            }
        }));   
    }
});

// ** {{{ bespin.cmd.commandline.History }}} **
//
// Store command line history so you can go back and forth

dojo.declare("bespin.cmd.commandline.History", null, {
    constructor: function(cl) {
        this.commandLine = cl;
        this.history = [];
        this.pointer = 0;
        this.store = new bespin.cmd.commandline.SimpleHistoryStore();
        this.seed();
    },

    // TODO: get from the database
    seed: function() {
        this.history = this.store.seed();
    },

    add: function(command) {
        command = dojo.trim(command);
        if (this.last() != command) {
            this.store.add(command);
            this.history.push(command);
            this.pointer = this.history.length - 1;
        }
    },

    next: function() {
        if (this.pointer < this.history.length) {
            return this.history[this.pointer++];
        }
    },

    previous: function() {
        if (this.pointer > 0) {
           return this.history[this.pointer--];
        }
    },

    last: function() {
        return this.history[this.history.length - 1];
    },

    first: function() {
        return this.history[0];
    },

    set: function(command) {
        this.commandLine.commandLine.value = command;
    },

    setNext: function() {
        var next = this.next();
        if (next) {
            this.set(next);
        }
    },

    setPrevious: function() {
        var prev = this.previous();
        if (prev) {
            this.set(prev);
        }
    }
});

// ** {{{ bespin.cmd.commandline.SimpleHistoryStore }}} **
//
// A simple store that keeps the commands in memory.
// In the future we would want to store the history cross session.

dojo.declare("bespin.cmd.commandline.SimpleHistoryStore", null, {
    constructor: function() {
        this.commands = [];
    },

    seed: function() {
        this.add('ls');
        this.add('clear');
        this.add('status');

        return dojo.clone(this.commands); 
    },

    add: function(command) {
        this.commands.push(command);
    }
});

// ** {{{ bespin.cmd.commandline.Events }}} **
//
// The custom events that the commandline participates in

dojo.declare("bespin.cmd.commandline.Events", null, {
    constructor: function(commandline) {
        this.commandline = commandline;

        // ** {{{ Event: bespin:cmdline:showinfo }}} **
        // 
        // Observe when others want to show the info bar for the command line
        bespin.subscribe("bespin:cmdline:showinfo", function(event) {
            var msg = event.msg;
            var autohide = event.autohide; 
            if (msg) commandline.showInfo(msg, autohide);
        });

        // ** {{{ Event: bespin:cmdline:executed }}} **
        // 
        // Once the command has been executed, do something.
        // In this case, save it for the history
        bespin.subscribe("bespin:cmdline:executed", function(event) {
            var commandname = event.command.name;
            var args        = event.args;

            commandline.commandLineHistory.add(commandname + " " + args); // only add to the history when a valid command
        });
        
        // ** {{{ Event: bespin:cmdline:executed }}} **
        // 
        // Once the command has been executed, do something.        
        bespin.subscribe("bespin:cmdline:execute", function(event) {
            var command = event.name;
            var args    = event.args;
            if (command && args) { // if we have a command and some args
                command += " " + args;
            }

            if (command) commandline.executeCommand(command);
        });


        // -- Files
        // ** {{{ Event: bespin:editor:openfile:openfail }}} **
        // 
        // If an open file action failed, tell the user.
        bespin.subscribe("bespin:editor:openfile:openfail", function(event) {
            var filename = event.filename;

            commandline.showInfo('Could not open file: ' + filename + "<br/><br/><em>(maybe try &raquo; list)</em>");
        });

        // ** {{{ Event: bespin:editor:openfile:opensuccess }}} **
        // 
        // The open file action worked, so tell the user
        bespin.subscribe("bespin:editor:openfile:opensuccess", function(event) {
            var file = event.file;

            commandline.showInfo('Loaded file: ' + file.name, true);
        });

        // -- Projects
        // ** {{{ Event: bespin:editor:project:set }}} **
        // 
        // When the project changes, alert the user
        bespin.subscribe("bespin:editor:project:set", function(event) {
            var project = event.project;

            _editSession.project = project;
            commandline.showInfo('Changed project to ' + project, true);
        });

    }
});