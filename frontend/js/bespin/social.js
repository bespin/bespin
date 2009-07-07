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

dojo.provide("bespin.social");

/**
 * Utility to take an string array of follower names, and publish a
 * "Following: ..." message as a command line response.
 */
bespin.social.displayFollowers = function(instruction, followers) {
    bespin.social.displayArray(instruction,
            "You are not following anyone",
            "You are following these users:",
            followers);
};

/**
 * Utility to take an string array of strings, and publish a ul list to the
 * instruction
 */
bespin.social.displayArray = function(instruction, titleNone, titleSome, array) {
    if (!array || array.length === 0) {
        instruction.addOutput(titleNone);
        return;
    }
    var message = titleSome;
    message += "<ul><li>" + array.join("</li><li>") + "</li></ul>";
    instruction.addOutput(message);
};

/**
 * Helper for when you have a command that needs to get a hold of it's params
 * as an array for processing.
 * TODO: I'm fairly sure there is a better way to do this knowing how command
 * line parsing works
 */
bespin.social.toArgArray = function(args) {
    if (args == null) {
        return [];
    }
    else {
        var spliten = args.split(" ");
        if (spliten.length == 1 && spliten[0] == "") {
            return [];
        }
        else {
            return spliten;
        }
    }
};

// =============================================================================

/**
 * Add a 'follow' command that gets and adds to out list of our followers
 */
bespin.command.store.addCommand({
    name: 'follow',
    takes: ['username ...'],
    preview: 'add to the list of users we are following, or (with no args) list the current set',
    completeText: 'username(s) of person(s) to follow',
    usage: "[username] ...<br><br><em>(username optional. Will list current followed users if not provided)</em>",
    execute: function(instruction, args) {
        var usernames = bespin.social.toArgArray(args);
        if (usernames.length === 0) {
            bespin.get('server').followers({
                onSuccess: function(data) {
                    bespin.social.displayFollowers(instruction, dojo.fromJson(data));
                },
                onFailure: function(xhr) {
                    instruction.addErrorOutput("Failed to retrieve followers: " + xhr.responseText);
                }
            });
        }
        else {
            bespin.get('server').follow(usernames, {
                onSuccess: function(data) {
                    bespin.social.displayFollowers(instruction, dojo.fromJson(data));
                },
                onFailure: function(xhr) {
                    instruction.addErrorOutput("Failed to add follower: " + xhr.responseText);
                }
            });
        }
    }
});

/**
 * Extend bespin.client.Server with follow / followers methods
 */
dojo.extend(bespin.client.Server, {
    follow: function(usernames, opts) {
        this.request('POST', '/network/follow/', dojo.toJson(usernames), opts);
    },

    followers: function(opts) {
        this.request('GET', '/network/followers/', null, opts);
    }
});

// =============================================================================

/**
 * Add an 'unfollow' command that removes from our list of our followers
 */
bespin.command.store.addCommand({
    name: 'unfollow',
    takes: ['username ...'],
    preview: 'remove from the list of users we are following',
    completeText: 'username(s) of person(s) to stop following',
    usage: "[username] ...<br><br><em>The username(s) to stop following</em>",
    execute: function(instruction, args) {
        var usernames = bespin.social.toArgArray(args);
        if (usernames.length === 0) {
            instruction.addErrorOutput('Please specify the users to cease following');
        }
        else {
            bespin.get('server').unfollow(usernames, {
                onSuccess: function(data) {
                    bespin.social.displayFollowers(instruction, dojo.fromJson(data));
                },
                onFailure: function(xhr) {
                    instruction.addErrorOutput("Failed to remove follower: " + xhr.responseText);
                }
            });
        }
    }
});

/**
 * Extend bespin.client.Server with an unfollow method
 */
dojo.extend(bespin.client.Server, {
    unfollow: function(users, opts) {
        this.request('POST', '/network/unfollow/', dojo.toJson(users), opts);
    }
});

// =============================================================================

/**
 * Container for the group command
 */
if (!bespin.social.group) {
    bespin.social.group = {};
}

/**
 * Command store for the group commands
 * (which are subcommands of the main 'group' command)
 */
bespin.social.group.commands = new bespin.command.Store(bespin.command.store, {
    name: 'group',
    preview: 'Collect the people you follow into groups, and display the existing groups',
    completeText: 'subcommands: add, remove, list, help',
    subcommanddefault: 'help'
});

/**
 * Display sub-command help
 */
bespin.social.group.commands.addCommand({
    name: 'help',
    takes: ['search'],
    preview: 'show subcommands for group command',
    description: 'The <u>help</u> gives you access to the various subcommands in the group command space.<br/><br/>You can narrow the search of a command by adding an optional search params.<br/><br/>Finally, pass in the full name of a command and you can get the full description, which you just did to see this!',
    completeText: 'optionally, narrow down the search',
    execute: function(instruction, extra) {
        var output = this.parent.getHelp(extra);
        instruction.addOutput(output);
    }
});

/**
 * 'group list' subcommand.
 */
bespin.social.group.commands.addCommand({
    name: 'list',
    preview: 'List the current group and group members',
    takes: ['group'],
    // completeText: 'An optional group name or leave blank to list groups',
    description: 'List the current group and group members.',
    execute: function(instruction, group) {
        if (!group) {
            // List all groups
            bespin.get('server').groupListAll({
                onSuccess: function(groups) {
                    bespin.social.displayArray(instruction,
                            "You have no groups",
                            "You have the following groups:",
                            dojo.fromJson(groups));
                },
                onFailure: function(xhr) {
                    instruction.addErrorOutput("Failed to retrieve groups: " + xhr.responseText);
                }
            });
        } else {
            // List members in a group
            bespin.get('server').groupList(group, {
                onSuccess: function(members) {
                    bespin.social.displayArray(instruction,
                            group + " has no members.",
                            "Members of " + group + ":",
                            dojo.fromJson(members));
                },
                onFailure: function(xhr) {
                    instruction.addErrorOutput("Failed to retrieve group members: " + xhr.responseText);
                }
            });
        }
    }
});

/**
 * 'group add' subcommand.
 */
bespin.social.group.commands.addCommand({
    name: 'add',
    preview: 'Add members to a new or existing group',
    takes: [ 'group', 'member' ],
    completeText: 'A group name followed by a list of members to add',
    description: 'Add members to a new or existing group',
    execute: function(instruction, group, member) {
        // Add to members of a group
        bespin.get('server').groupAdd(group, member, {
            onSuccess: function(data) {
                instruction.addOutput("Members of " + group + ": " + data);
            },
            onFailure: function(xhr) {
                instruction.addErrorOutput("Failed to add to group members. Maybe due to: " + xhr.responseText);
            }
        });
    }
});

/**
 * 'group remove' subcommand.
 */
bespin.social.group.commands.addCommand({
    name: 'remove',
    preview: 'Remove members from an existing group (and remove group if empty)',
    takes: [ 'group', 'member' ],
    completeText: 'A group name followed by a list of members to remove',
    description: 'Remove members from an existing group (and remove group if empty)',
    execute: function(instruction, group, member) {
        if (member === "all") {
            bespin.get('server').groupRemoveAll(group, {
                onSuccess: function(data) {
                    instruction.addOutput("Removed group " + group);
                },
                onFailure: function(xhr) {
                    instruction.addErrorOutput("Failed to retrieve group members. Maybe due to: " + xhr.responseText);
                }
            });
        } else {
            // Remove members from a group
            bespin.get('server').groupRemove(group, member, {
                onSuccess: function(data) {
                    instruction.addOutput("Members of " + group + ": " + data);
                },
                onFailure: function(xhr) {
                    instruction.addErrorOutput("Failed to remove to group members. Maybe due to: " + xhr.responseText);
                }
            });
        }
    }
});

/**
 * Extend bespin.client.Server with group* methods
 */
dojo.extend(bespin.client.Server, {
    /**
     * Get a list of the users the current user is following
     */
    groupListAll: function(opts) {
        this.request('GET', '/group/list/all/', null, opts);
    },

    /**
     * Get a list of the users the current user is following
     */
    groupList: function(group, opts) {
        this.request('GET', '/group/list/' + group + '/', null, opts);
    },

    /**
     * Get a list of the users the current user is following
     */
    groupRemove: function(group, users, opts) {
        this.request('POST', '/group/remove/' + group + '/', dojo.toJson(users), opts);
    },

    /**
     * Get a list of the users the current user is following
     */
    groupRemoveAll: function(group, opts) {
        this.request('POST', '/group/remove/all/' + group + '/', null, opts);
    },

    /**
     * Get a list of the users the current user is following
     */
    groupAdd: function(group, users, opts) {
        this.request('POST', '/group/add/' + group + '/', dojo.toJson(users), opts);
    }
});

// =============================================================================

/**
 * Add a 'share' command to open up projects to other people
 */
bespin.command.store.addCommand({
    name: 'share',
    takes:[ '{project}', '{user}|{group}|everyone', 'readonely|edit', 'loadany' ],
    preview: 'List and alter sharing for a project',
    execute: function(instruction, args) {
        args = args.pieces;

        if (args.length === 0) {
            // === List all project shares ===
            // i.e. 'share'
            bespin.get('server').shareListAll({
                onSuccess: function(data) {
                    var shares = dojo.fromJson(data);
                    if (shares.length === 0) {
                        instruction.addOutput("You are not sharing any projects");
                    }
                    else {
                        var message = "You have the following shares:<ul>\n";
                        dojo.forEach(shares, function(share) {
                            // loadany needs adding here
                            var edit = share.edit ? "<strong>Editable</strong>" : "Read-only";
                            if (share.type == "everyone") {
                                message += "<li><strong>" + share.project + "</strong> with <strong>everyone</strong>: " + edit + ".</li>\n";
                            }
                            else if (share.type == "group") {
                                message += "<li><strong>" + share.project + "</strong> with the group <strong>" + share.recipient + "</strong>: " + edit + ".</li>\n";
                            }
                            else {
                                message += "<li><strong>" + share.project + "</strong> with <strong>" + share.recipient + "</strong>: " + edit + ".</li>\n";
                            }
                        });
                        message += "</ul>";
                        instruction.addOutput(message);
                    }
                },
                onFailure: function(xhr) {
                    instruction.addErrorOutput("Failed to list project shares: " + xhr.responseText);
                }
            });
        }
        else if (args.length === 1) {
            // === List sharing for a given project ===
            // i.e. 'share {project}'
            var project = args[0];
            bespin.get('server').shareListProject(project, {
                onSuccess: function(data) {
                    instruction.addOutput("Project sharing for " + project + ": " + data);
                },
                onFailure: function(xhr) {
                    instruction.addErrorOutput("Failed to list project sharing. Maybe due to: " + xhr.responseText);
                }
            });
        }
        else if (args.length === 2) {
            if (args[1] == "none") {
                // === Remove all sharing from a project ===
                // i.e. 'share {project} none'
                var project = args[0];
                bespin.get('server').shareRemoveAll(project, {
                    onSuccess: function(data) {
                        instruction.addOutput("All sharing removed from " + project);
                    },
                    onFailure: function(xhr) {
                        instruction.addErrorOutput("Failed to remove sharing permissions. Maybe due to: " + xhr.responseText);
                    }
                });
            }
            else {
                // === List sharing for a given project and member ===
                // i.e. 'share {project} {user}|{group}|everyone'
                var project = args[0];
                var member = args[1];
                bespin.get('server').shareListProjectMember(project, member, {
                    onSuccess: function(data) {
                        instruction.addOutput("Project sharing for " + project + ", " + member + ": " + data);
                    },
                    onFailure: function(xhr) {
                        instruction.addErrorOutput("Failed to list project sharing. Maybe due to: " + xhr.responseText);
                    }
                });
            }
        }
        else if (args.length === 3) {
            if (args[2] == "none") {
                // === Remove project sharing from a given member ===
                // i.e. 'share {project} {user}|{group}|everyone none'
                var project = args[0];
                var member = args[1];
                bespin.get('server').shareRemove(project, member, {
                    onSuccess: function(data) {
                        instruction.addOutput("Removed sharing permission from " + member + " to " + project);
                    },
                    onFailure: function(xhr) {
                        instruction.addErrorOutput("Failed to remove sharing permission. Maybe due to: " + xhr.responseText);
                    }
                });
            }
            else if (args[2] != "readonly" && args[2] != "edit") {
                this._syntaxError(instruction, 'Valid edit options are \'none\', \'readonly\' or \'edit\'.');
            }
            else {
                // i.e. 'share {project} {user}|{group}|everyone [readonly|edit]'
                this._shareAdd(instruction, [ args[0], args[1], [ args[2] ] ]);
            }
        }
        else if (args.length === 4) {
            if (args[3] != "loadany") {
                this._syntaxError(instruction, 'Valid scope options are loadany or <blank>');
            }
            else if (args[2] != "readonly" && args[2] != "edit") {
                this._syntaxError(instruction, 'Valid edit options are \'readonly\' or \'edit\'.');
            }
            else {
                // i.e. 'share {project} {user}|{group}|everyone [readonly|edit] loadany'
                this._shareAdd(instruction, args[0], args[1], [ args[2], args[3] ]);
            }
        }
        else {
            this._syntaxError('Too many arguments. Maximum 4 arguments to \'share\' command.');
        }
    },

    _syntaxError: function(instruction, message) {
        instruction.addErrorOutput(message + '<br/>Syntax: share {project} ({user}|{group}|everyone) (none|readonly|edit) [loadany]');
    },

    // === Add a member to the sharing list for a project ===
    _shareAdd: function(instruction, project, member, options) {
        bespin.get('server').shareAdd(project, member, options, {
            onSuccess: function(data) {
                instruction.addOutput("Adding sharing permission for " + member + " to " + project);
            },
            onFailure: function(xhr) {
                instruction.addErrorOutput("Failed to add sharing permission. Maybe due to: " + xhr.responseText);
            }
        });
    }
});

/**
 * Extensions to bespin.client.Server to add share* methods
 */
dojo.extend(bespin.client.Server, {
    /**
     * List all project shares
     */
    shareListAll: function(opts) {
        this.request('GET', '/share/list/all/', null, opts);
    },

    /**
     * List sharing for a given project
     */
    shareListProject: function(project, opts) {
        this.request('GET', '/share/list/' + project + '/', null, opts);
    },

    /**
     * List sharing for a given project and member
     */
    shareListProjectMember: function(project, member, opts) {
        this.request('GET', '/share/list/' + project + '/' + member + '/', null, opts);
    },

    /**
     * Remove all sharing from a project
     */
    shareRemoveAll: function(project, opts) {
        this.request('POST', '/share/remove/' + project + '/all/', null, opts);
    },

    /**
     * Remove project sharing from a given member
     */
    shareRemove: function(project, member, opts) {
        this.request('POST', '/share/remove/' + project + '/' + member + '/', null, opts);
    },

    /**
     * Add a member to the sharing list for a project
     */
    shareAdd: function(project, member, options, opts) {
        this.request('POST', '/share/add/' + project + '/' + member + '/', dojo.toJson(options), opts);
    }
});

// =============================================================================

/**
 * Add a 'viewme' command to allow people to screencast
 *
bespin.command.store.addCommand({
    name: 'viewme',
    preview: 'List and alter user\'s ability to see what I\'m working on',
    execute: function(instruction, args) {
        args = bespin.social.toArgArray(args);

        if (args.length === 0) {
            // === List all the members with view settings on me ===
            // i.e. 'viewme'
            bespin.get('server').viewmeListAll({
                onSuccess: function(data) {
                    instruction.addOutput("All view settings: " + data);
                },
                onFailure: function(xhr) {
                    instruction.addErrorOutput("Failed to retrieve view settings. Maybe due to: " + xhr.responseText);
                }
            });
        }
        else if (args.length === 1) {
            // === List the view settings for a given member ===
            // i.e. 'viewme {user|group}'
            var member = args[0];
            bespin.get('server').viewmeList(member, {
                onSuccess: function(data) {
                    instruction.addOutput("View settings for " + member + ": " + data);
                },
                onFailure: function(xhr) {
                    instruction.addErrorOutput("Failed to retrieve view settings. Maybe due to: " + xhr.responseText);
                }
            });
        }
        else if (args.length === 2) {
            if (args[1] != 'false' && args[1] != 'true' && args[1] != 'default') {
                this._syntaxError('Valid viewme settings are {true|false|deafult}');
            }
            else {
                // === Alter the view setting for a given member ===
                var member = args[0];
                var value = args[1];
                bespin.get('server').viewmeSet(member, value, {
                    onSuccess: function(data) {
                        instruction.addOutput("Changed view settings for " + member);
                    },
                    onFailure: function(xhr) {
                        instruction.addErrorOutput("Failed to change view setttings. Maybe due to: " + xhr.responseText);
                    }
                });
            }
        }
        else {
            this._syntaxError('Too many arguments. Maximum 2 arguments to \'viewme\' command.');
        }
    },
    _syntaxError: function(message) {
        instruction.addErrorOutput('Syntax error - viewme ({user}|{group}|everyone) (true|false|default)');
    }
});
// */

/**
 * Extensions to bespin.client.Server to add viewme* commands
 *
dojo.extend(bespin.client.Server, {
    // List all the members with view settings on me
    viewmeListAll: function(opts) {
        this.request('GET', '/viewme/list/all/', null, opts);
    },

    // List the view settings for a given member
    viewmeList: function(member, opts) {
        this.request('GET', '/viewme/list/' + member + '/', null, opts);
    },

    // Alter the view setting for a given member
    viewmeSet: function(member, value, opts) {
        this.request('POST', '/viewme/set/' + member + '/' + value + '/', null, opts);
    }
});
*/
