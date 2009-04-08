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

dojo.declare("bespin.cmd.commandline.CommandStore", null, {
    constructor: function(initCommands) {
        this.commands = {};
        this.aliases = {};
        
        if (initCommands) this.addCommands(initCommands); // initialize the commands for the cli
    },
    splitCommandAndArgs: function(value) {
        var data = value.split(/\s+/);
        var commandname = data.shift();

        var command;
        var argstr = data.join(' ');

        if (this.commands[commandname]) {
            command = this.commands[commandname];
        } else if (this.aliases[commandname]) {
            var alias = this.aliases[commandname].split(' ');
            var aliascmd = alias.shift();
            if (alias.length > 0) {
                argstr = alias.join(' ') + ' ' + argstr;
            }
            command = this.commands[aliascmd];
        } else {
            this.showInfo("Sorry, no command '" + commandname + "'. Maybe try to run &raquo; help", true);
            return;
        }
        
        return [command, this.getArgs(argstr.split(' '), command)]
        
    },
      
    addCommand: function(command) {
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

    findCompletions: function(value) {
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
        return matches;
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
    }
    
});

// ** {{{ bespin.cmd.commandline.Interface }}} **
//
// The core command line driver. It executes commands, stores them, and handles completion

dojo.declare("bespin.cmd.commandline.Interface", null, {
    constructor: function(commandLine, initCommands) {
        this.commandLine = dojo.byId(commandLine);

        if (bespin.get('files')) this.files = bespin.get('files');
        if (bespin.get('settings')) this.settings = bespin.get('settings');
        if (bespin.get('editor')) this.editor = bespin.get('editor');

        this.inCommandLine = false;
        this.suppressInfo = false; // When true, info bar popups will not be shown
        
        this.commandStore = new bespin.cmd.commandline.CommandStore(initCommands);

        this.commandLineKeyBindings = new bespin.cmd.commandline.KeyBindings(this);
        this.commandLineHistory = new bespin.cmd.commandline.History(this);
        this.customEvents = new bespin.cmd.commandline.Events(this);
    },

    showUsage: function(command, autohide) {
        var usage = command.usage || "no usage information found for " + command.name;
        this.showInfo("Usage: " + command.name + " " + usage, autohide);
    },

    showInfo: function(html, autohide) {
        if (this.suppressInfo) return; // bypass

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

    complete: function(value) {
        var matches = this.commandStore.findCompletions(value);
        if (matches.length == 1) {
            var commandLineValue = matches[0];
            
            var command = this.commandStore.commands[matches[0]];

            if (command) {
                if (this.commandStore.commandTakesArgs(command)) {
                    commandLineValue += ' ';
                }

                if (command['completeText']) {
                    this.showInfo(command['completeText']);
                }

                if (command['complete']) {
                    this.showInfo(command.complete(this, value));
                }
            } else { // an alias
                this.showInfo(commandLineValue + " is an alias for: " + this.commandStore.aliases[commandLineValue]);
                commandLineValue += ' ';
            }
            this.commandLine.value = commandLineValue;
        }
    },
    
    executeCommand: function(value) {
        var ca = this.commandStore.splitCommandAndArgs(value);
        var command = ca[0];
        var args = ca[1];
        
        bespin.publish("command:executed", { command: command, args: args });

        command.execute(this, args, command);
        this.commandLine.value = ''; // clear after the command
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
            dojo.byId('promptimg').src = 'images/icn_command_on.png';
        });
        dojo.connect(cl.commandLine, "onblur", cl, function() {
            this.inCommandLine = false;
            dojo.byId('promptimg').src = 'images/icn_command.png';
        });
        
        dojo.connect(cl.commandLine, "onkeyup", cl, function(e) {
            var command;
            if (e.keyCode >= "A".charCodeAt() && e.keyCode < "Z".charCodeAt()) { // only real letters
                var completions = this.commandStore.findCompletions(dojo.byId('command').value);
                var commandString = completions[0];
                if (completions.length > 0) {
                    var isAutoComplete = (settings && settings.isSettingOn('autocomplete'));
                    if (isAutoComplete && completions.length == 1) { // if only one just set the value
                        command = this.commandStore.commands[commandString] || this.commandStore.commands[this.commandStore.aliases[commandString]];

                        var spacing = (this.commandStore.commandTakesArgs(command)) ? ' ' : '';
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
                            command = this.commandStore.commands[completions[0]] || this.commandStore.commands[this.commandStore.aliases[completions[0]]];

                            if (this.commandStore.commandTakesArgs(command)) {
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
        });             
        
        dojo.connect(cl.commandLine, "onkeypress", cl, function(e) {
            if (e.keyChar == 'j' && e.ctrlKey) { // send back
                dojo.stopEvent(e);

                dojo.byId('command').blur();

                bespin.publish("cmdline:blur");

                return false;
            } else if ((e.keyChar == 'n' && e.ctrlKey) || e.keyCode == dojo.keys.DOWN_ARROW) {
                this.commandLineHistory.setNext();
                return false;
            } else if ((e.keyChar == 'p' && e.ctrlKey) || e.keyCode == dojo.keys.UP_ARROW) {
                this.commandLineHistory.setPrevious();
                return false;
            } else if (e.keyCode == dojo.keys.ENTER) {
                this.executeCommand(dojo.byId('command').value);

                return false;
            } else if (e.keyCode == dojo.keys.TAB) { 
                dojo.stopEvent(e);
                
                this.complete(dojo.byId('command').value);
                return false;
            } else if (e.keyCode == dojo.keys.ESCAPE) {
                this.hideInfo();
            }
        });   
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
        // ** {{{ Event: message }}} **
        // 
        // Observe when others want to show the info bar for the command line
        bespin.subscribe("message", function(event) {
            var msg = event.msg;
            var autohide = (event.tag == 'autohide');
            if (msg) commandline.showInfo(msg, autohide);
        });

        // ** {{{ Event: cmdline:suppressinfo }}} **
        // 
        // Turn on info bar suppression
        bespin.subscribe("cmdline:suppressinfo", function(event) {
            commandline.suppressInfo = true;
        });

        // ** {{{ Event: cmdline:unsuppressinfo }}} **
        // 
        // Turn off info bar suppression
        bespin.subscribe("cmdline:unsuppressinfo", function(event) {
            commandline.suppressInfo = false;
        });

        // ** {{{ Event: command:executed }}} **
        // 
        // Once the command has been executed, do something.
        // In this case, save it for the history
        bespin.subscribe("command:executed", function(event) {
            commandline.commandLineHistory.add(event.command.name + " " + event.args); // only add to the history when a valid command
        });
        
        // ** {{{ Event: command:executed }}} **
        // 
        // Once the command has been executed, do something.        
        bespin.subscribe("command:execute", function(event) {
            var command = event.name;
            var args    = event.args;
            if (command && args) { // if we have a command and some args
                command += " " + args;
            }

            if (command) commandline.commandStore.executeCommand(command);
        });
        
        // -- Files
        // ** {{{ Event: editor:openfile:openfail }}} **
        // 
        // If an open file action failed, tell the user.
        bespin.subscribe("editor:openfile:openfail", function(event) {
            commandline.showInfo('Could not open file: ' + event.filename + "<br/><br/><em>(maybe try &raquo; list)</em>");
        });

        // ** {{{ Event: editor:openfile:opensuccess }}} **
        // 
        // The open file action worked, so tell the user
        bespin.subscribe("editor:openfile:opensuccess", function(event) {
            commandline.showInfo('Loaded file: ' + event.file.name, true);
        });

        // -- Projects
        // ** {{{ Event: project:set }}} **
        // 
        // When the project changes, alert the user
        bespin.subscribe("project:set", function(event) {
            var project = event.project;

            bespin.get('editSession').project = project;
            if (!event.suppressPopup) commandline.showInfo('Changed project to ' + project, true);
        });

    }
});
