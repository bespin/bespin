/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 * 
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 * 
 * The Original Code is Bespin.
 * 
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s):
 *     Bespin Team (bespin@mozilla.com)
 *
 * 
 * ***** END LICENSE BLOCK ***** */

var CommandLine = Class.create({
	initialize: function(commandLine, files, settings, editor) {
        this.commandLine = commandLine;
        this.files = files;
        this.settings = settings;
        this.editor = editor;

        this.inCommandLine = false;
        this.commands = {};
        this.aliases = {};

        this.commandLineKeyBindings = new CommandLineKeyBindings(this);
        this.commandLineHistory = new CommandLineHistory(this);
		this.customEvents = new CommandLineCustomEvents(this);
		
		DefaultCommands.seed(this);
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

		document.fire("bespin:cmdline:execute", { command: command });

        command.execute(this, this.getArgs(data, command));
        this.commandLine.value = ''; // clear after the command
    },

    addCommand: function(command) {
		// -- Allow for the default [ ] takes style by expanding it to something bigger
		if (command.takes && 
		    Object.prototype.toString.call(command.takes) === '[object Array]') {
			command = this.normalizeTakes(command);
		}

		this.commands[command.name] = command;

		if (command['aliases']) {
			command['aliases'].each(function(alias) {
				this.aliases[alias] = command.name;
			}.bind(this));
		}
    },

    showInfo: function(html, autohide) {
        this.hideInfo();

        $('info').innerHTML = html;
        $('info').show();
        $('info').onclick = function() {
            this.hideInfo();
        }.bind(this);

        if (autohide) {
            this.infoTimeout = setTimeout(function() {
                this.hideInfo();
            }.bind(this), 4600);
        }
    },

    hideInfo: function() {
        $('info').hide();
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
                    this.commands[command]['aliases'].each(function(alias) {
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

	/*
	 * Calculate the args object to be passed into the command. If it only takes one argument just send in that data, but if it wants more, split it all up for the command and send in an object.
	 */
	getArgs: function(fromUser, command) {
		if (!command.takes) return undefined;

		var args;
		var userString = fromUser.join(' ');
		
		if (command.takes && command.takes.order.length < 2) { // One argument, so just return that
			args = userString;
		} else {		
			args = new TokenObject(userString, { params: command.takes.order.join(' ') });
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
		
		takes.each(function(item) {
			command.takes[item] = {
				"short": item[0]
			}
		});
		
		return command;
	}
});

/*
 * Handle key bindings for the command line
 */
var CommandLineKeyBindings = Class.create({
    initialize: function(cl) {
        // -- Tie to the commandLine element itself

        cl.commandLine.onfocus = function() {
            _editor.setFocus(false);
            this.inCommandLine = true;
            $('promptimg').src = 'images/icn_command_on.png';
        }.bind(cl);

        cl.commandLine.onblur = function() {
            this.inCommandLine = false;
            $('promptimg').src = 'images/icn_command.png';
        }.bind(cl);

        cl.commandLine.onkeyup = function(e) {
           if (e.keyCode >= Key.A && e.keyCode < Key.Z) { // only real letters
                var completions = this.findCompletions($('command').value);
                var commandString = completions[0];
                if (completions.length > 0) {
                    var isAutoComplete = _settings.isOn(_settings.get('autocomplete'));
                    if (isAutoComplete && completions.length == 1) { // if only one just set the value
                        var command = this.commands[commandString] || this.commands[this.aliases[commandString]];

                        var spacing = (this.commandTakesArgs(command)) ? ' ' : '';
                        $('command').value = commandString + spacing;

                        if (command['completeText']) {
                            this.showInfo(command['completeText']);
                        } else {
                            this.hideInfo();
                        }
                    } else if (completions.length == 1) {
                        if (completions[0] != $('command').value) {
                            this.showInfo(completions.join(', '));
                        } else {
                            var command = this.commands[completions[0]] || this.commands[this.aliases[completions[0]]];

                            if (this.commandTakesArgs(command)) {
                                this.complete($('command').value); // make it complete
                            } else {
                                this.hideInfo();
                            }
                        }
                    } else {
                        this.showInfo(completions.join(', '));
                    }
                }
            }
        }.bind(cl);

        cl.commandLine.onkeydown = function(e) {
            if (e.keyCode == Key.J && e.ctrlKey) { // send back
                Event.stop(e);

                $('command').blur();
                _editor.setFocus(true);

                return false;
            } else if ((e.keyCode == Key.N && e.ctrlKey) || e.keyCode == Key.ARROW_DOWN) {
                this.commandLineHistory.setNext();
                return false;
            } else if ((e.keyCode == Key.P && e.ctrlKey) || e.keyCode == Key.ARROW_UP) {
                this.commandLineHistory.setPrevious();
                return false;
            } else if (e.keyCode == Key.ENTER) {
                this.executeCommand($('command').value);
				
                return false;
            } else if (e.keyCode == Key.TAB) {
                this.complete($('command').value);
                return false;
            } else if (e.keyCode == Key.ESCAPE) {
                this.hideInfo();
            }
        }.bind(cl);
    }
});

var CommandLineHistory = Class.create({
    initialize: function(cl) {
        this.commandLine = cl;
        this.history = [];
        this.pointer = 0;
        this.store = new SimpleCommandLineHistoryStore();
        this.seed();
    },

    // TODO: get from the database
    seed: function() {
        this.history = this.store.seed();
    },

    add: function(command) {
        command = command.strip();
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

var SimpleCommandLineHistoryStore = Class.create({
    initialize: function() {
        this.commands = [];
    },

    seed: function() {
        this.add('ls');
        this.add('clear');
        this.add('status');

        return this.commands.clone();
    },

    add: function(command) {
        this.commands.push(command);
    }
});

var CommandLineCustomEvents = Class.create({
    initialize: function(commandline) {
		this.commandline = commandline;
		
		// -- My stuff
		document.observe("bespin:cmdline:showinfo", function(event) {
			var msg = event.memo.msg;
			if (msg) commandline.showInfo(msg);
		});
		
		document.observe("bespin:cmdline:execute", function(event) {
			var commandname = event.memo.command.name;
			
	        commandline.commandLineHistory.add(commandname); // only add to the history when a valid command
		});
		
		// -- Files
		document.observe("bespin:editor:openfile:openfail", function(event) {
			var filename = event.memo.filename;

			commandline.showInfo('Could not open file: ' + filename + "<br/><br/><em>(maybe try &raquo; list)</em>");
		});

		document.observe("bespin:editor:openfile:opensuccess", function(event) {
			var file = event.memo.file;

			commandline.showInfo('Loaded file: ' + file.name, true);
		});
		
		// -- Projects
		document.observe("bespin:editor:project:set", function(event) {
			var project = event.memo.project;

			_editSession.project = project;
	        commandline.showInfo('Changed project to ' + project, true);
		});
		
	}
});

