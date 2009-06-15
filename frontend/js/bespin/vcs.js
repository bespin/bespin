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

dojo.provide("bespin.vcs");

dojo.require("bespin.util.webpieces");
dojo.require("bespin.cmd.commands");
dojo.require("bespin.cmd.commandline");

// Command store for the VCS commands
// (which are subcommands of the main 'vcs' command)
bespin.vcs.commands = new bespin.cmd.commandline.CommandStore({ subCommand: {
    name: 'vcs',
    preview: 'run a version control command',
    completeText: 'subcommands: add, clone, commit, diff, getkey, help, push, remove, resolved, update',
    subcommanddefault: 'help'
}});

bespin.vcs.createStandardHandler = function(instruction) {
    return {
        evalJSON: true,
        onPartial: function(response) {
            console.log("partial", response);
            instruction.addPartialOutput(response);
        },
        onSuccess: function(response) {
            console.log("success", response);
            instruction.addOutput(response);
        },
        onFailure: function(xhr) {
            instruction.addErrorOutput(xhr.response);
        }
    };
};

//** {{{ bespin.vcs.createCancelHandler }}}
// Create an event handler to sort out the output if the user clicks cancel
bespin.vcs.createCancelHandler = function(instruction) {
    return instruction.link(function() {
        var el = dojo.byId('centerpopup');
        bespin.util.webpieces.hideCenterPopup(el);
        instruction.addErrorOutput("Cancelled");
    });
};

bespin.vcs._remoteauthCache = {};

// ** {{{ bespin.vcs.get_remoteauth }}}
// Looks in the cache or calls to the server to find
// out if the given project requires remote authentication.
// The result is published at vcs:remoteauth:project
bespin.vcs.getRemoteauth = function(project, callback) {
    var cached = bespin.vcs._remoteauthCache[project];
    if (cached === undefined) {
        bespin.get('server').remoteauth(project, callback);
        return;
    }
    // work from cache
    callback(cached);
};

bespin.subscribe("vcs:remoteauthUpdate", function(event) {
    bespin.vcs._remoteauthCache[event.project] = event.remoteauth;
});

bespin.vcs.clone = function(instruction, url) {
    var el = dojo.byId('centerpopup');

    el.innerHTML = '<form method="POST" id="vcsauth">'
            + '<table><tbody>'
            + '<tr><th colspan=2>Add Project from Source Control</th></tr>'
            + '<tr><td>Keychain password:</td><td>'
            + '<input type="password" name="kcpass" id="kcpass"></td></tr>'
            + '<tr><td>URL:</td>'
            + '<td><input type="text" name="source" value="' + url + '" style="width: 85%"></td></tr>'
            + '<tr><td>Project name:</td>'
            + '<td><input type="text" name="dest" value=""> (defaults to last part of URL path)</td></tr>'
            + '<tr><td>Authentication:</td><td><select name="remoteauth" id="remoteauth">'
            + '<option value="">None (read-only access to the remote repo)</option>'
            + '<option value="write">Only for writing</option>'
            + '<option value="both">For reading and writing</option>'
            + '</select></td></tr>'
            + '<tr id="push_row" style="display:none" class="authfields"><td>Push to URL</td>'
            + '<td><input type="text" name="push" style="width: 85%" value="' + url + '"></td></tr>'
            + '<tr id="authtype_row" style="display:none" class="authfields"><td>Authentication type</td>'
            + '<td><select name="authtype" id="authtype">'
            + '<option value="ssh">SSH</option>'
            + '<option value="password">Username/Password</option>'
            + '</select></td></tr>'
            + '<tr id="username_row" style="display:none" class="authfields"><td>Username</td>'
            + '<td><input type="text" name="username">'
            + '</td></tr>'
            + '<tr id="password_row" style="display:none" class="authfields userfields"><td>Password</td><td>'
            + '<input type="password" name="password">'
            + '</td></tr><tr><td>&nbsp;</td><td>'
            + '<input type="submit" id="vcsauthsubmit" value="Clone">'
            + '<input type="button" id="vcsauthcancel" value="Cancel">'
            + '</td></tr></tbody></table></form>';

    dojo.style("vcsauth", {
        background: "white",
        '-moz-border-radius': "5px",
        padding: "5px"
    });

    dojo.connect(dojo.byId("remoteauth"), "onchange", function() {
        var newval = dojo.byId("remoteauth").value;
        if (newval == "") {
            dojo.query("tr.authfields").style("display", "none");
        } else {
            dojo.query("tr.authfields").style("display", "table-row");
            if (dojo.byId("authtype").value == "ssh") {
                dojo.query("tr.userfields").style("display", "none");
            }
        }
    });

    dojo.connect(dojo.byId("authtype"), "onchange", function() {
        var newval = dojo.byId("authtype").value;
        if (newval == "ssh") {
            dojo.query("tr.userfields").style("display", "none");
        } else {
            dojo.query("tr.userfields").style("display", "table-row");
        }
    });

    dojo.connect(dojo.byId("vcsauthcancel"), "onclick", bespin.vcs.createCancelHandler(instruction));

    dojo.connect(dojo.byId("vcsauthsubmit"), "onclick", instruction.link(function(e) {
        dojo.stopEvent(e);
        bespin.util.webpieces.hideCenterPopup(el);
        var data = dojo.formToObject("vcsauth");
        // prune out unnecessary values
        if (data.remoteauth == "") {
            delete data.push;
            delete data.authtype;
            delete data.username;
            delete data.password;
        } else {
            if (data.authtype == "ssh") {
                delete data.password;
            }
        }
        data = dojo.objectToQuery(data);
        bespin.get('server').clone(data, instruction, bespin.vcs.createStandardHandler(instruction));
    }));

    bespin.util.webpieces.showCenterPopup(el, true);
    dojo.byId("kcpass").focus();
};

// Is this called from anywhere? Probably not (this appears to be the only
// instance of the string 'setProjectPassword' in an *.js file) however if
// it is used then we've added the initial 'instruction' parameter.
bespin.vcs.setProjectPassword = function(instruction, project) {
    var el = dojo.byId('centerpopup');

    el.innerHTML = '<form method="POST" id="vcsauth">'
            + '<table><tbody><tr><td>Keychain password</td><td>'
            + '<input type="password" name="kcpass"></td></tr>'
            + '<tr><td>Username</td><td><input type="text" name="username">'
            + '</td></tr><tr><td>Password</td><td>'
            + '<input type="password" name="password">'
            + '</td></tr><tr><td>&nbsp;</td><td>'
            + '<input type="hidden" name="type" value="password">'
            + '<input type="button" id="vcsauthsubmit" value="Save">'
            + '<input type="button" id="vcsauthcancel" value="Cancel">'
            + '</td></tr></tbody></table></form>';

    dojo.connect(dojo.byId("vcsauthcancel"), "onclick", bespin.vcs.createCancelHandler(instruction));

    dojo.connect(dojo.byId("vcsauthsubmit"), "onclick", function() {
        bespin.util.webpieces.hideCenterPopup(el);
        bespin.get("server").setauth(project, "vcsauth",
            {
                onSuccess: function() {
                    instruction.addOutput("Password saved for " + project);
                },
                onFailure: function(xhr) {
                    instruction.addErrorOutput("Password save failed: " + xhr.responseText);
                }
            });
    });

    bespin.util.webpieces.showCenterPopup(el, true);
};

// ** {{{ getKeychainPassword }}}
// Presents the user with a dialog requesting their keychain
// password. If they click the submit button, the password
// is sent to the callback. If they do not, the callback
// is not called.
bespin.vcs.getKeychainPassword = function(instruction, callback) {
    var el = dojo.byId('centerpopup');

    el.innerHTML = '<form id="vcsauth">'
            + '<table><tbody><tr><td>Keychain password</td><td>'
            + '<input type="password" id="kcpass">'
            + '</td></tr><tr><td>&nbsp;</td><td>'
            + '<input type="button" id="vcsauthsubmit" value="Submit">'
            + '<input type="button" id="vcsauthcancel" value="Cancel">'
            + '</td></tr></tbody></table></form>';

    dojo.connect(dojo.byId("vcsauthcancel"), "onclick", bespin.vcs.createCancelHandler(instruction));

    function saveform() {
        bespin.util.webpieces.hideCenterPopup(el);
        var kcpass = dojo.byId("kcpass").value;
        el.innerHTML = "";
        callback(kcpass);
        return false;
    };

    dojo.connect(dojo.byId("vcsauthsubmit"), "onclick", saveform);
    dojo.connect(dojo.byId("vcsauth"), "onsubmit", saveform);

    bespin.util.webpieces.showCenterPopup(el, true);
    dojo.byId("kcpass").focus();
};

// = Commands =
// Version Control System-related commands

// ** {{{{Command: clone}}}} **
bespin.vcs.commands.addCommand({
    name: 'clone',
    takes: ['url'],
    aliases: ['checkout'],
    preview: 'checkout or clone the project into a new Bespin project',
    // ** {{{execute}}} **
    execute: function(instruction, url) {
        bespin.vcs.clone(instruction, url || "");
    }
});


// ** {{{Command: push}}} **
bespin.vcs.commands.addCommand({
    name: 'push',
    preview: 'push to the remote repository',
    // ** {{{execute}}} **
    execute: function(instruction, args) {
        var project;

        bespin.withComponent('editSession', function(editSession) {
            project = editSession.project;
        });

        if (!project) {
            instruction.addErrorOutput("You need to pass in a project");
            return;
        }

        bespin.vcs.getKeychainPassword(instruction, function(kcpass) {
            bespin.get('server').vcs(project,
                                    { command: ['push', '_BESPIN_PUSH'], kcpass: kcpass },
                                    instruction,
                                    bespin.vcs.createStandardHandler(instruction));
        });
    }
});

// ** {{{Command: diff}}} **
bespin.vcs.commands.addCommand({
    name: 'diff',
    preview: 'Display the differences in the checkout out files',
    takes: ['*'],
    completeText: 'Use the current file, add -a for all files or add filenames',
    description: 'Without any options, the vcs diff command will diff the currently selected file against the repository copy. If you pass in -a, the command will diff <em>all</em> files. Finally, you can list files to diff individually.',
    // ** {{{execute}}} **
    execute: function(instruction, args) {
        bespin.vcs._performVCSCommandWithFiles("diff", instruction, args);
    }
});

// ** {{{Command: remove}}} **
bespin.vcs.commands.addCommand({
    name: 'remove',
    preview: 'Remove a file from version control (also deletes it)',
    takes: ['*'],
    description: 'The files presented will be deleted and removed from version control.',
    // ** {{{execute}}} **
    execute: function(instruction, args) {
        bespin.vcs._performVCSCommandWithFiles("remove", instruction, args,
            {acceptAll: false});
    }
});

// ** {{{Command: status}}} **
bespin.vcs.commands.addCommand({
    name: 'status',
    preview: 'Display the status of the repository files.',
    description: 'Shows the current state of the files in the repository<br>M for modified, ? for unknown (you may need to add), R for removed, ! for files that are deleted but not removed',
    // ** {{{execute}}} **
    execute: function(instruction, args) {
        var project;

        bespin.withComponent('editSession', function(editSession) {
            project = editSession.project;
        });

        if (!project) {
            instruction.addErrorOutput("You need to pass in a project");
            return;
        }

        bespin.get('server').vcs(project,
                                { command: ['status'] },
                                instruction,
                                bespin.vcs.createStandardHandler(instruction));
    }
});

// ** {{{Command: diff}}} **
bespin.vcs.commands.addCommand({
    name: 'resolved',
    takes: ['*'],
    preview: 'Mark files as resolved',
    completeText: 'Use the current file, add -a for all files or add filenames',
    description: 'Without any options, the vcs resolved command will mark the currently selected file as resolved. If you pass in -a, the command will resolve <em>all</em> files. Finally, you can list files individually.',
    // ** {{{execute}}} **
    execute: function(instruction, args) {
        bespin.vcs._performVCSCommandWithFiles("resolved", instruction, args);
    }
});


// ** {{{Command: update}}} **
bespin.vcs.commands.addCommand({
    name: 'update',
    preview: 'Update your working copy from the remote repository',
    // ** {{{execute}}} **
    execute: function(instruction) {
        var project;

        bespin.withComponent('editSession', function(editSession) {
            project = editSession.project;
        });

        if (!project) {
            instruction.addErrorOutput("You need to pass in a project");
            return;
        }

        var sendRequest = function(kcpass) {
            var command = {
                command: ['update', '_BESPIN_REMOTE_URL']
            };

            if (kcpass !== undefined) {
                command.kcpass = kcpass;
            }

            bespin.get('server').vcs(project,
                                    command,
                                    instruction,
                                    bespin.vcs.createStandardHandler(instruction));
        };

        bespin.vcs.getRemoteauth(project, function(remoteauth) {
            console.log("remote auth is: " + remoteauth);
            if (remoteauth == "both") {
                bespin.vcs.getKeychainPassword(instruction, sendRequest);
            } else {
                sendRequest(undefined);
            }
        });

    }
});

bespin.vcs._performVCSCommandWithFiles = function(vcsCommand, instruction, args,
            options) {
    options = options || { acceptAll: true };
    var project;
    var path;

    bespin.withComponent('editSession', function(editSession) {
        project = editSession.project;
        path = editSession.path;
    });

    if (!project) {
        instruction.addErrorOutput("You need to pass in a project");
        return;
    }

    if (args.varargs.length == 0) {
        if (!path) {
            var dasha = "";
            if (options.acceptAll) {
                dasha = ", or use -a for all files.";
            }
            instruction.addErrorOutput("You must select a file to " + vcsCommand + dasha);
            return;
        }
        var command = [vcsCommand, path];
    } else if (args.varargs[0] == "-a" && options.acceptAll) {
        var command = [vcsCommand];
    } else {
        var command = [vcsCommand];
        command.concat(args.varargs);
    }
    bespin.get('server').vcs(project,
                            { command: command },
                            instruction,
                            bespin.vcs.createStandardHandler(instruction));
};

// ** {{{Command: add}}} **
bespin.vcs.commands.addCommand({
    name: 'add',
    preview: 'Adds missing files to the project',
    takes: ['*'],
    completeText: 'Use the current file, add -a for all files or add filenames',
    description: 'Without any options, the vcs add command will add the currently selected file. If you pass in -a, the command will add <em>all</em> files. Finally, you can list files individually.',
    // ** {{{execute}}} **
    execute: function(instruction, args) {
        bespin.vcs._performVCSCommandWithFiles("add", instruction, args);
    }
});

// ** {{{Command: commit}}} **
bespin.vcs.commands.addCommand({
    name: 'commit',
    takes: ['message'],
    preview: 'Commit to the repository',
    // ** {{{execute}}} **
    execute: function(instruction, message) {
        if (!message) {
            instruction.addErrorOutput("You must enter a log message");
            return;
        }
        var project;

        bespin.withComponent('editSession', function(editSession) {
            project = editSession.project;
        });

        if (!project) {
            instruction.addErrorOutput("You need to pass in a project");
            return;
        }
        bespin.get('server').vcs(project,
                                { command: [ 'commit', '-m', message ] },
                                instruction,
                                bespin.vcs.createStandardHandler(instruction));
    }
});

bespin.vcs._displaySSHKey = function(response) {
    bespin.util.webpieces.showContentOverlay(
        '<h2>Your Bespin SSH public key</h2><input type="text" value="'
        + response + '" id="sshkey" style="width: 95%">'
    );
    dojo.byId("sshkey").select();
};

// Retrieve the user's SSH public key using their keychain password.
// This is required if they have not already set up a public key.
bespin.vcs._getSSHKeyAuthenticated = function(instruction) {
    bespin.vcs.getKeychainPassword(instruction, function(kcpass) {
        bespin.get('server').getkey(kcpass, {
            onSuccess: bespin.vcs._displaySSHKey,
            on401: function(response) {
                instruction.addErrorOutput("Bad keychain password.");
            },
            onFailure: function(response) {
                instruction.addErrorOutput("getkey failed: " + response);
            }
        });
    });
};

bespin.vcs.commands.addCommand({
    name: 'getkey',
    preview: 'Get your SSH public key that Bespin can use for remote repository authentication. This will prompt for your keychain password.',
    execute: function(instruction) {
        bespin.get('server').getkey(null, {
            onSuccess: bespin.vcs._displaySSHKey,
            on401: bespin.vcs._getSSHKeyAuthenticated(instruction),
            onFailure: function(response) {
                instruction.addErrorOutput("getkey failed: " + response);
            }
        });
    }
});

// ** {{{Command: help}}} **
bespin.vcs.commands.addCommand({
    name: 'help',
    takes: ['search'],
    preview: 'show commands for vcs subcommand',
    description: 'The <u>help</u> gives you access to the various commands in the vcs subcommand space.<br/><br/>You can narrow the search of a command by adding an optional search params.<br/><br/>Finally, pass in the full name of a command and you can get the full description, which you just did to see this!',
    completeText: 'optionally, narrow down the search',
    execute: function(instruction, extra) {
        bespin.cmd.displayHelp(bespin.vcs.commands, instruction, extra);
    }
});

// Command store for the Mercurial commands
// (which are subcommands of the main 'hg' command)
bespin.vcs.hgCommands = new bespin.cmd.commandline.CommandStore({ subCommand: {
    name: 'hg',
    preview: 'run a Mercurial command',
    subcommanddefault: 'help'
}});

// ** {{{Command: help}}} **
bespin.vcs.hgCommands.addCommand({
    name: 'help',
    takes: ['search'],
    preview: 'show commands for hg subcommand',
    description: 'The <u>help</u> gives you access to the various commands in the hg subcommand space.<br/><br/>You can narrow the search of a command by adding an optional search params.<br/><br/>Finally, pass in the full name of a command and you can get the full description, which you just did to see this!',
    completeText: 'optionally, narrow down the search',
    execute: function(instruction, extra) {
        bespin.cmd.displayHelp(bespin.vcs.hgCommands, instruction, extra);
    }
});

// ** {{{Command: init}}} **
bespin.vcs.hgCommands.addCommand({
    name: 'init',
    preview: 'initialize a new hg repository',
    description: 'This will create a new repository in this project.',
    execute: function(instruction) {
        var project;

        bespin.withComponent('editSession', function(editSession) {
            project = editSession.project;
        });

        if (!project) {
            instruction.addErrorOutput("You need to pass in a project");
            return;
        }
        bespin.get('server').vcs(project,
                                { command: ['hg', 'init'] },
                                instruction,
                                bespin.vcs.createStandardHandler(instruction));
    }
});

// == Extension to {{{ bespin.client.Server }}} ==
dojo.extend(bespin.client.Server, {
    // ** {{{ remoteauth() }}}
    // Finds out if the given project requires remote authentication
    // the values returned are "", "both" (for read and write), "write"
    // when only writes require authentication
    // the result is published as an object with project, remoteauth
    // values to vcs:remoteauthUpdate and sent to the callback.
    remoteauth: function(project, callback) {
        var url = '/vcs/remoteauth/' + escape(project) + '/';
        this.request('GET', url, null, {
            onSuccess: function(result) {
                var event = {
                    project: project,
                    remoteauth: result
                };
                bespin.publish("vcs:remoteauthUpdate", event);
                callback(result);
            }
        });
    },

    // ** {{{ vcs() }}}
    // Run a Version Control System (VCS) command
    // The command object should have a command attribute
    // on it that is a list of the arguments.
    // Commands that require authentication should also
    // have kcpass, which is a string containing the user's
    // keychain password.
    vcs: function(project, command, instruction, opts) {
        var url = '/vcs/command/' + project + '/';
        this.requestDisconnected('POST', url, dojo.toJson(command), instruction, opts);
    },

    // ** {{{ setauth() }}}
    // Sets authentication for a project
    setauth: function(project, form, opts) {
        this.request('POST', '/vcs/setauth/' + project + '/',
                    dojo.formToQuery(form), opts || {});
    },

    // ** {{{ getkey() }}}
    // Retrieves the user's SSH public key that can be used for VCS functions
    getkey: function(kcpass, opts) {
        if (kcpass == null) {
            this.request('POST', '/vcs/getkey/', null, opts || {});
        } else {
            this.request('POST', '/vcs/getkey/', "kcpass=" + escape(kcpass), opts || {});
        }
    },

    // ** {{{ clone() }}}
    // Clone a remote repository
    clone: function(data, instruction, opts) {
        this.requestDisconnected('POST', '/vcs/clone/', data, instruction, opts);
    }
});
