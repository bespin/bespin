
dojo.provide("bespin.social");

// ====================================================================== FOLLOW

format_json_string_array = function(data) {
    var reply = "";
    dojo.forEach(data, function(item) {
        if (item) {
            reply += ", " + item;
        }
    });
    if (reply.length < 2) {
        return "";
    }
    return reply.substring(2);
}

social_display_followers = function(followers) {
    var message = "Following: " + format_json_string_array(followers);
    bespin.publish("message", { msg:message });
}

// ** {{{Command: follow}}} **
bespin.cmd.commands.add({
    name: 'follow',
    takes: ['username ...'],
    preview: 'add to the list of users we are following, or (with no args) list the current set',
    completeText: 'username(s) of person(s) to follow',
    usage: "[username] ...<br><br><em>(username optional. Will list current followed users if not provided)</em>",
    // ** {{{execute}}}
    execute: function(self, args) {
        var usernames = bespin.cmd.commands.toArgArray(args);
        if (usernames.length == 0) {
            bespin.publish("network:followers");
        }
        else {
            bespin.publish("network:follow", [ usernames ]);
        }
    }
});

// ** {{{ Event: network:followers }}} **
// Get a list of our followers
bespin.subscribe("network:followers", function() {
    bespin.get('server').followers({
        onSuccess: function(data) {
            social_display_followers(dojo.fromJson(data));
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to retrieve followers: " + xhr.responseText });
        }
    });
});

// ** {{{ Event: network:follow }}} **
// Add to the list of users that we follow
bespin.subscribe("network:follow", function(usernames) {
    bespin.get('server').follow(usernames, {
        onSuccess: function(data) {
            social_display_followers(dojo.fromJson(data));
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to add follower: " + xhr.responseText });
        }
    });
});

// ** {{{Command: unfollow}}} **
bespin.cmd.commands.add({
    name: 'unfollow',
    takes: ['username ...'],
    preview: 'remove from the list of users we are following',
    completeText: 'username(s) of person(s) to stop following',
    usage: "[username] ...<br><br><em>The username(s) to stop following</em>",
    // ** {{{execute}}}
    execute: function(self, args) {
        var usernames = bespin.cmd.commands.toArgArray(args);
        if (usernames.length == 0) {
            self.showInfo('Please specify the users to cease following');
        }
        else {
            bespin.publish("network:unfollow", [ usernames ]);
        }
    }
});

// ** {{{ Event: network:unfollow }}} **
// Remove users from the list that we follow
bespin.subscribe("network:unfollow", function(usernames) {
    bespin.get('server').unfollow(usernames, {
        onSuccess: function(data) {
            social_display_followers(dojo.fromJson(data));
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to remove follower: " + xhr.responseText });
        }
    });
});

// ======================================================================= GROUP

// ** {{{Command: group}}} **
bespin.cmd.commands.add({
    name: 'group',
    takes: ['[{name}|--add|--remove] ...'],
    preview: 'Collect the people you follow into groups, and display the existing groups',
    // ** {{{execute}}}
    execute: function(self, args) {
        args = bespin.cmd.commands.toArgArray(args);

        if (args.length == 0) {
            bespin.publish("groups:list:all");
        }
        else if (args.length == 1) {
            bespin.publish("groups:list", [ args[0] ]);
        }
        else if (args.length == 2) {
            if (args[1] == "-r" || args[1] == "--remove") {
                bespin.publish("groups:remove:all", [ args[0] ]);
            }
            else {
                self.showInfo('Syntax error - You must specify what you want to do with your group.');
            }
        }
        else if (args.length > 2) {
            var group = args.shift();
            var command = args.shift();
            if (command == "-a" || command == "--add") {
                bespin.publish("groups:add", [ group, args ]);
            }
            else if (command == "-r" || command == "--remove") {
                args.shift();
                bespin.publish("groups:remove", [ group, args ]);
            }
            else {
                self.showInfo('Syntax error - To manipulate a group you must use add/remove');
            }
        }
    }
});

// ** {{{ Event: groups:list:all }}} **
// Get a list of our groups
bespin.subscribe("groups:list:all", function() {
    bespin.get('server').groupListAll({
        onSuccess: function(data) {
            var groups = dojo.fromJson(data);
            if (groups.length == 0) {
                bespin.publish("message", { msg:"You have no groups" });
            }
            else {
                var message = "You have the following groups: " + format_json_string_array(groups);
                bespin.publish("message", { msg:message });
            }
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to retrieve groups: " + xhr.responseText });
        }
    });
});

// ** {{{ Event: groups:list }}} **
// Get a list of group members
bespin.subscribe("groups:list", function(group) {
    bespin.get('server').groupList(group, {
        onSuccess: function(data) {
            var members = dojo.fromJson(data);
            if (members.length == 0) {
                console.warn("Group " + group + " has no members - it should have been auto-deleted!")
                bespin.publish("message", { msg: "" + group + " has no members." });
            }
            else {
                var message = "Members of " + group + ": " + format_json_string_array(members);
                bespin.publish("message", { msg:message });
            }
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to retrieve group members: " + xhr.responseText });
        }
    });
});

// ** {{{ Event: groups:remove:all }}} **
// Remove a group and all its members
bespin.subscribe("groups:remove:all", function(group) {
    bespin.get('server').groupRemoveAll(group, {
        onSuccess: function(data) {
            bespin.publish("message", { msg: "Removed group " + group });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to retrieve group members. Maybe due to: " + xhr.responseText });
        }
    });
});

// ** {{{ Event: groups:add }}} **
// Add to members of a group
bespin.subscribe("groups:add", function(group, users) {
    bespin.get('server').groupAdd(group, users, {
        onSuccess: function(data) {
            bespin.publish("message", { msg: "Members of " + group + ": " + data });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to add to group members. Maybe due to: " + xhr.responseText });
        }
    });
});

// ** {{{ Event: groups:remove }}} **
// Add to members of a group
bespin.subscribe("groups:remove", function(group, users) {
    bespin.get('server').groupRemove(group, users, {
        onSuccess: function(data) {
            bespin.publish("message", { msg: "Members of " + group + ": " + data });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to remove to group members. Maybe due to: " + xhr.responseText });
        }
    });
});

// ======================================================================= SHARE

// ** {{{Command: share}}} **
bespin.cmd.commands.add({
    name: 'share',
    takes:[ '{project}', '{user}|{group}|everyone', 'readonely|edit', 'loadany' ],
    preview: 'List and alter sharing for a project',
    // ** {{{execute}}}
    execute: function(self, args) {
        args = args.pieces;

        if (args.length == 0) {
            // i.e. 'share'
            bespin.publish("share:list:all");
        }
        else if (args.length == 1) {
            // i.e. 'share {project}'
            bespin.publish("share:list:project", [ args[0] ]);
        }
        else if (args.length == 2) {
            if (args[1] == "none") {
                // i.e. 'share {project} none'
                bespin.publish("share:remove:all", [ args[0] ]);
            }
            else {
                // i.e. 'share {project} {user}|{group}|everyone'
                bespin.publish("share:list:project:member", [ args[0], args[1] ]);
            }
        }
        else if (args.length == 3) {
            if (args[2] == "none") {
                // i.e. 'share {project} {user}|{group}|everyone none'
                bespin.publish("share:remove", [ args[0], args[1] ]);
            }
            else if (args[2] != "readonly" && args[2] != "edit") {
                this._syntaxError('Valid edit options are \'none\', \'readonly\' or \'edit\'.');
            }
            else {
                // i.e. 'share {project} {user}|{group}|everyone [readonly|edit]'
                bespin.publish("share:add", [ args[0], args[1], [ args[2] ] ]);
            }
        }
        else if (args.length == 4) {
            if (args[3] != "loadany") {
                this._syntaxError('Valid scope options are loadany or <blank>');
            }
            else if (args[2] != "readonly" && args[2] != "edit") {
                this._syntaxError('Valid edit options are \'readonly\' or \'edit\'.');
            }
            else {
                // i.e. 'share {project} {user}|{group}|everyone [readonly|edit] loadany'
                bespin.publish("share:add", [ args[0], args[1], [ args[2], args[3] ] ]);
            }
        }
        else {
            this._syntaxError('Too many arguments. Maximum 4 arguments to \'share\' command.');
        }
    },
    _syntaxError: function(message) {
        self.showInfo('Syntax error - share {project} ({user}|{group}|everyone) (none|readonly|edit) [loadany]');
    }
});

// ** {{{ Event: share:list:all }}} **
// List all project shares
bespin.subscribe("share:list:all", function() {
    bespin.get('server').shareListAll({
        onSuccess: function(data) {
            bespin.publish("message", { msg: "Project sharing: " + data });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to list project shares. Maybe due to: " + xhr.responseText });
        }
    });
});

// ** {{{ Event: share:list:project }}} **
// List sharing for a given project
bespin.subscribe("share:list:project", function(project) {
    bespin.get('server').shareListProject(project, {
        onSuccess: function(data) {
            bespin.publish("message", { msg: "Project sharing for " + project + ": " + data });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to list project sharing. Maybe due to: " + xhr.responseText });
        }
    });
});

// ** {{{ Event: share:list:project:member }}} **
// List sharing for a given project and member
bespin.subscribe("share:list:project:member", function(project, member) {
    bespin.get('server').shareListProjectMember(project, member, {
        onSuccess: function(data) {
            bespin.publish("message", { msg: "Project sharing for " + project + ", " + member + ": " + data });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to list project sharing. Maybe due to: " + xhr.responseText });
        }
    });
});

// ** {{{ Event: share:remove:all }}} **
// Remove all sharing from a project
bespin.subscribe("share:remove:all", function(project) {
    bespin.get('server').shareRemoveAll(project, {
        onSuccess: function(data) {
            bespin.publish("message", { msg: "All sharing removed from " + project });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to remove sharing permissions. Maybe due to: " + xhr.responseText });
        }
    });
});

// ** {{{ Event: share:remove }}} **
// Remove project sharing from a given member
bespin.subscribe("share:remove", function(project, member) {
    bespin.get('server').shareRemove(project, member, {
        onSuccess: function(data) {
            bespin.publish("message", { msg: "Removed sharing permission from " + member + " to " + project });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to remove sharing permission. Maybe due to: " + xhr.responseText });
        }
    });
});

// ** {{{ Event: share:add }}} **
// Add a member to the sharing list for a project
bespin.subscribe("share:add", function(project, member, options) {
    bespin.get('server').shareAdd(project, member, options, {
        onSuccess: function(data) {
            bespin.publish("message", { msg: "Adding sharing permission for " + member + " to " + project });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to add sharing permission. Maybe due to: " + xhr.responseText });
        }
    });
});

// ====================================================================== VIEWME

// ** {{{Command: viewme}}} **
bespin.cmd.commands.add({
    name: 'viewme',
    preview: 'List and alter user\'s ability to see what I\'m working on',
    // ** {{{execute}}}
    execute: function(self, args) {
        args = bespin.cmd.commands.toArgArray(args);

        if (args.length == 0) {
            // i.e. 'viewme'
            bespin.publish("viewme:list:all");
        }
        else if (args.length == 1) {
            // i.e. 'viewme {user|group}'
            bespin.publish("viewme:list", [ args[0] ]);
        }
        else if (args.length == 2) {
            if (args[1] != 'false' && args[1] != 'true' && args[1] != 'default') {
                this._syntaxError('Valid viewme settings are {true|false|deafult}');
            }
            else {
                bespin.publish("viewme:set", [ args[0], args[1] ]);
            }
        }
        else {
            this._syntaxError('Too many arguments. Maximum 2 arguments to \'viewme\' command.');
        }
    },
    _syntaxError: function(message) {
        self.showInfo('Syntax error - viewme ({user}|{group}|everyone) (true|false|default)');
    }
});

// ** {{{ Event: viewme:list:all }}} **
// List all the members with view settings on me
bespin.subscribe("viewme:list:all", function() {
    bespin.get('server').viewmeListAll({
        onSuccess: function(data) {
            bespin.publish("message", { msg: "All view settings: " + data });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to retrieve view settings. Maybe due to: " + xhr.responseText });
        }
    });
});

// ** {{{ Event: viewme:list }}} **
// List the view settings for a given member
bespin.subscribe("viewme:list", function(member) {
    bespin.get('server').viewmeList(member, {
        onSuccess: function(data) {
            bespin.publish("message", { msg: "View settings for " + member + ": " + data });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to retrieve view settings. Maybe due to: " + xhr.responseText });
        }
    });
});

// ** {{{ Event: viewme:set }}} **
// Alter the view setting for a given member
bespin.subscribe("viewme:set", function(member, value) {
    bespin.get('server').viewmeSet(member, value, {
        onSuccess: function(data) {
            bespin.publish("message", { msg: "Changed view settings for " + member });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to change view setttings. Maybe due to: " + xhr.responseText });
        }
    });
});

// ======================================================================== TEST

// ** {{{Command: test}}} **
bespin.cmd.commands.add({
    name: 'test',
    preview: 'Run some automated end to end tests',
    script: [
        { send:"echo Starting", expect:/^Starting$/ },
        { send:"follow", expect:/sds/ },
        { send:"echo Finished", expect:/^Finished$/ }
    ],
    // ** {{{_setup}}}
    _setup: function(self, onComplete) {
        this.originalShowInfo = self.showInfo;
        var that = this;
        bespin.get('server').request('POST', '/test/setup/', null, {
            onSuccess: onSuccess,
            onFailure: function(xhr) {
                that._cleanup(self, "_setup() failed. Maybe due to: " + xhr.responseText);
            }
        });
    },
    // ** {{{_cleanup}}}
    _cleanup: function(self, reason) {
        self.showInfo = this.originalShowInfo;
        self.showInfo(reason);
        bespin.get('server').request('POST', '/test/cleanup/', null, {
            onSuccess: function() {
                console.log("Server cleanup completed");
            },
            onFailure: function(xhr) {
                self.showInfo("_setup() failed. Maybe due to: " + xhr.responseText);
            }
        });
    },
    // ** {{{_runNextElement}}}
    _runNextElement: function(self, script, index) {
        console.log("_runNextElement", index);
        if (index >= script.length) {
            this._cleanup(self, "Finished running tests");
            return;
        }
        var element = script[index];
        var that = this;
        self.showInfo = function(html, autohide) {
            var info = dojo.byId('info');
            info.innerHTML = html;
            var text = info.textContent;
            if (element.expect.test(text)) {
                that._runNextElement(self, script, index + 1);
            }
            else {
                console.error("Test failure at index:", index);
                console.log("Command: ", element.send);
                console.log("Expected: ", element.expect.source);
                console.log("Received:", text);
                that._cleanup(self, "Test failure at index: " + index + "<br/>Command: '" + element.send + "'<br/>Expected: /" + element.expect.source + "/<br/>Received: '" + text + "'");
            }
        };
        self.executeCommand(element.send);
    },
    // ** {{{execute}}}
    execute: function(self) {
        var that = this;
        this._setup(self, function() {
            that._runNextElement(self, that.script, 0);
        });
    }
});

// ======================================================================== ECHO

// ** {{{Command: echo}}} **
bespin.cmd.commands.add({
    name: 'echo',
    takes: ['message ...'],
    preview: 'A test echo command',
    // ** {{{execute}}}
    execute: function(self, args) {
        self.showInfo(args);
    }
});

