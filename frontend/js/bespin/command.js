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
            this.subcommandFor = command.name;

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

        this.commands[command.name] = command;

        if (command['aliases']) {
            dojo.forEach(command['aliases'], function(alias) {
                this.aliases[alias] = command.name;
            }, this);
        }
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
     * Find the commands that could work, given the value typed
     * @param value What was typed
     * @param root Any prefix that has been chopped off
     */
    findCompletions: function(query, callback, root) {
        if (root) {
            query.root = root;
        }
        var value = query.value;

        // TODO: A better way to detect who will sort out completion
        if (value.match(' ')) {
            var command = this.rootCommand(value);

            if (command) {
                // It's easy if there are sub-commands...
                if (command.subcommands) {
                    // Create a new query to match the original
                    var subQuery = {
                        // TODO: so we're not going to pass in the whole thing?
                        value: value.replace(new RegExp('^' + command.name + '\\s*'), ''),
                        // TODO: subtract from start?
                        cursorPos: query.cursorPos
                    };

                    // Our callback wrapper inserts the original values back
                    // into the response to fake the reply
                    var subCallback = function(response) {
                        response.value = query.value;
                        response.cursorPos = query.cursorPos;
                        callback(response);
                    };

                    command.subcommands.findCompletions(query, subCallback, command.name);
                    return;
                }

                // Using custom completions requires us to know the prefix that
                // we are matching against. 'value' contains the command name
                var prefix = value;
                if (prefix.substr(0, command.name.length) === command.name) {
                    prefix = dojo.trim(prefix.substr(command.name.length));
                }

                // We'll need to filter the possibles by the prefix
                var filter = function(potentials, prefix) {
                    return {
                        matches: potentials.filter(function(potential) {
                            return potential.substr(0, prefix.length) === prefix;
                        })
                    };
                };

                // MAJOR HACK - clearly this should not be hard coded
                var type = "group";

                var options = bespin.cmd.commandline.caches[type];

                // If we've got some options already, use those. We need a
                // recache strategy somehow...
                // TODO: command is the WRONG place to store this
                if (dojo.isArray(options)) {
                    return filter(options, prefix);
                }

                if (options !== "outstanding" && dojo.isFunction(command.sendAllOptions)) {
                    bespin.cmd.commandline.caches[type] = "outstanding";

                    command.sendAllOptions(type, function(options) {
                        bespin.cmd.commandline.caches[type] = options;
                        return filter(options, prefix);
                    });
                }
            }
        } else {
            // We're completing from the commands and aliases
            query.matches = [];

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
        }

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
     * Given the entire string typed for this command, find the root command by
     * looking for the first space and finding the command for everything to
     * there.
     */
    rootCommand: function(value) {
        return this.commands[dojo.trim(value.substring(0, value.indexOf(' ')))];
    }
});

/**
 * Add a root command store to the main bespin namespace
 */
dojo.mixin(bespin.command, {
    store: new bespin.command.Store()
});
