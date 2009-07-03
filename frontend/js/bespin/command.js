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

dojo.provide("bespin.command");

/**
 * A store of commands
 */
dojo.declare("bespin.command.Store", null, {
    /**
     * To create a root command store, call with no parameters.
     * To create a sub-command store, pass the parent store in first, and a
     * single command into the second parameter
     */
    constructor: function(parent, command) {
        this.commands = {};
        this.aliases = {};

        // If there is a parent, then this is a store for a command with subcommands
        if (parent) {
            // save the fact that we are a subcommand for this chap
            this.containerCommand = command;
            this.parent = parent;

            // implicit that it takes something
            command.takes = ['*'];

            // link back to this store
            command.subcommands = this;

            // add the sub command to the parent store
            parent.addCommand(command);
        }
    },

    /**
     * Add a new command to this command store
     */
    addCommand: function(command) {
        if (!command) {
            return;
        }

        command.parent = this;

        // Remember the command
        this.commands[command.name] = command;

        // Allow for the default [ ] takes style by expanding it to something bigger
        if (command.takes && dojo.isArray(command.takes)) {
            command = this.normalizeTakes(command);
        }

        // Add bindings
        if (command.withKey) {
            // TODO - ensure that keyboard support is loaded earlier so we
            // don't have to muck about like this
            bespin.fireAfter([ "component:register:editor" ], function() {
                bespin.get('editor').bindCommand(command.name, command.withKey);
            });
        }

        // Cache all the aliases in a store wide list
        if (command.aliases) {
            dojo.forEach(command.aliases, function(alias) {
                this.aliases[alias] = command.name;
            }, this);
        }
    },
    
    /**
     * Add a new command to this command store
     */
    removeCommand: function(command) {
        if (!command) {
            return;
        }
        
        delete this.commands[command.name];
    },

    /*
    // Do we need this?
    hasCommand: function(commandname) {
        if (this.commands[commandname]) { // yup, there she blows. shortcut
            return true;
        }

        for (var command in this.commands) { // try the aliases
            if (this.commands[command]['aliases']) {
                if (bespin.util.include(this.commands[command]['aliases'], commandname)) {
                    return true;
                }
            }
        }
        return false;
    },
    */

    /**
     * Commands can contain sub commands, this gets us the full name of this
     * command. e.g. This may be a 'commit' command that is part of the 'vcs'
     * command, so this will return "vcs commit"
     */
    getFullCommandName: function() {
        var name = this.containerCommand ? this.containerCommand.name : "";
        if (this.parent) {
            name = this.parent.getFullCommandName() + " " + name;
        }
        return dojo.trim(name);
    },

    /**
     * Returns the subset of the options input array where the string values
     * begin with the given prefix
     */
    filterOptionsByPrefix: function(options, prefix) {
        return options.filter(function(option) {
            return option.substr(0, prefix.length) === prefix;
        });
    },

    /**
     * Find the commands that could work, given the value typed
     * @param value What was typed
     * @param root Any prefix that has been chopped off
     */
    findCompletions: function(query, callback) {
        // Find the text that we're working on.
        var value = query.value.substring(0, query.cursorPos);
        var prefix = this.getFullCommandName();
        if (value.substr(0, prefix.length) != prefix) {
            console.error("findCompletions: value (", value, ") does not start with prefix (", prefix, ")");
            return;
        }
        value = value.substr(prefix.length);
        // If we've got an initial space, chop it off and add to the prefix so
        // the cursor position calculation still works
        if (value.charAt(0) == " ") {
            value = value.substr(1);
        }

        // No spaces means we're completing from the commands and aliases
        if (!value.match(' ')) {
            var matches = [];

            // Only begin matching when they've typed something
            if (value.length == 0) {
                query.hint = "Type a command or 'help' for a list of commands";
                callback(query);
                return;
            }

            // Get a list of all commands and aliases. TODO: cache?
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

            if (matches.length == 1) {
                // Single match: go for autofill and hint
                var newValue = matches[0];
                var command = this.commands[newValue] || this.commands[this.aliases[newValue]];
                if (this.commandTakesArgs(command)) {
                    newValue = newValue + " ";
                }
                if (prefix === "") {
                    query.autofill = newValue;
                } else {
                    query.autofill = prefix + " " + newValue;
                }
                query.hint = command.preview;
            } else if (matches.length == 0) {
                // No matches, cause an error
                query.error = "No matches";
            } else {
                // Multiple matches, present a list
                matches.sort(function(a, b) {
                    return a.localeCompare(b);
                });
                query.options = matches;
            }

            callback(query);
            return;
        }

        // Given the entire string typed for this command, find the root command by
        // looking for the first space and finding the command for everything to
        // there.
        var command = this.commands[dojo.trim(value.substring(0, value.indexOf(' ')))];
        if (!command) {
            // No matches, cause an error
            query.error = "No matches";
            callback(query);
            return;
        }

        // If we've got something that does findCompletions, the delegate
        if (command.findCompletions) {
            command.findCompletions(query, callback);
            return;
        }

        // If there are sub-commands, then delegate
        if (command.subcommands) {
            command.subcommands.findCompletions(query, callback);
            return;
        }

        // So we have a command that doesn't have a findCompletions method
        // we just use
        query.hint = command.completeText;
        callback(query);
    },

    commandTakesArgs: function(command) {
        return command.takes != undefined;
    },

    /**
     * Calculate the args object to be passed into the command.
     * If it only takes one argument just send in that data, but if it wants
     * more, split it all up for the command and send in an object.
     */
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

    /**
     * Convert a command that uses a plain array for its 'takes' member and
     * upgrade it
     */
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

    /**
     * Generate some help text for all commands in this store, optionally
     * filtered by a <code>prefix</code>, and with a <code>helpSuffix</code>
     * appended.
     */
    getHelp: function(prefix, options) {
        var commands = [];
        var command, name;

        if (this.commands[prefix]) { // caught a real command
            command = this.commands[prefix];
            commands.push(command['description'] ? command.description : command.preview);
        } else {
            var showHidden = false;

            var subcmdprefix = "";
            if (this.containerCommand) {
                subcmdprefix = " for " + this.containerCommand.name;
            }

            if (prefix) {
                if (prefix == "hidden") { // sneaky, sneaky.
                    prefix = "";
                    showHidden = true;
                }
                commands.push("<h2>Commands starting with '" + prefix + "':</h2>");
            } else {
                commands.push("<h2>Available Commands:</h2>");
            }

            var tobesorted = [];
            for (name in this.commands) {
                tobesorted.push(name);
            }

            var sorted = tobesorted.sort();

            commands.push("<table>");
            for (var i = 0; i < sorted.length; i++) {
                name = sorted[i];
                command = this.commands[name];

                if (!showHidden && command.hidden) continue;
                if (prefix && name.indexOf(prefix) != 0) continue;

                var args = (command.takes) ? ' [' + command.takes.order.join('] [') + ']' : '';

                commands.push("<tr>");
                commands.push('<th>' + name + '</th>');
                commands.push('<td>' + command.preview + "</td>");
                commands.push('<td>' + args + '</td>');
                commands.push("</tr>");
            }
            commands.push("</table>");
        }

        var output = commands.join("");
        if (options && options.prefix) {
            output = options.prefix + "<br/>" + output;
        }
        if (options && options.suffix) {
            output = output + "<br/>" + options.suffix;
        }
        return output;
    }
});

/**
 * Add a root command store to the main bespin namespace
 */
dojo.mixin(bespin.command, {
    store: new bespin.command.Store(),
    
    executeExtensionCommand: function() {
        var args = arguments;
        var self = this;
        this.load(function(execute) {
            execute.apply(self, args);
        });
    }
});



bespin.subscribe("extension:loaded:bespin.command", function(ext) {
    ext.execute = bespin.command.executeExtensionCommand;
    bespin.command.store.addCommand(ext);
});

bespin.subscribe("extension:removed:bespin.command", function(ext) {
    bespin.command.store.removeCommand(ext);
});