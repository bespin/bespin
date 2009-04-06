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

bespin.vcs.standardHandler = {
    onSuccess: function(response) {
        bespin.publish("vcs:response", response);
    },
    onFailure: function(response) {
        bespin.publish("vcs:error", response);
    }
};

bespin.vcs.clone = function(url) {
    var el = dojo.byId('centerpopup');
    
    el.innerHTML = '<form method="POST" id="vcsauth">'
            + '<table><tbody><tr><td>Keychain password</td><td>'
            + '<input type="password" name="kcpass" id="kcpass"></td></tr>'
            + '<tr><td>URL</td>'
            + '<td><input type="text" name="source" value="' + url + '" style="width: 85%"></td></tr>'
            + '<tr><td style="width: 25%">Project name (defaults to last part of URL path)</td>'
            + '<td><input type="text" name="dest" value=""></td></tr>'
            + '<tr><td>Authentication</td><td><select name="remoteauth" id="remoteauth">'
            + '<option value="">None (read-only access to the remote repo)</option>'
            + '<option value="write">Only for writing</option>'
            + '<option value="both">For reading and writing</option>'
            + '</select></td></tr>'
            + '<tr id="push_row" style="display:none" class="authfields"><td>Push to URL</td>'
            + '<td><input type="text" name="push" style="width: 85%"></td></tr>'
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
            + '<input type="button" id="vcsauthsubmit" value="Clone">'
            + '<input type="button" id="vcsauthcancel" value="Cancel">'
            + '</td></tr></tbody></table></form>';
    
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
    
    dojo.connect(dojo.byId("vcsauthcancel"), "onclick", function() {
        bespin.util.webpieces.hideCenterPopup(el);
    });
    
    dojo.connect(dojo.byId("vcsauthsubmit"), "onclick", function() {
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
        bespin.get('server').clone(data, bespin.vcs.standardHandler);
    });
    
    bespin.util.webpieces.showCenterPopup(el, true);
    dojo.byId("kcpass").focus();
};

bespin.vcs.setProjectPassword = function(project) {
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
    
    dojo.connect(dojo.byId("vcsauthcancel"), "onclick", function() {
        bespin.util.webpieces.hideCenterPopup(el);
    });
    
    dojo.connect(dojo.byId("vcsauthsubmit"), "onclick", function() {
        bespin.util.webpieces.hideCenterPopup(el);
        bespin.get("server").setauth(project, "vcsauth", 
            {
                onSuccess: function() {
                    bespin.publish("message", {msg: "Password saved for " + project});
                },
                onFailure: function(xhr) {
                    bespin.publish("message", {msg: "Password save failed: " + xhr.responseText});
                }
            })
    });
    
    bespin.util.webpieces.showCenterPopup(el, true);
}

bespin.vcs.getKeychainPassword = function(callback) {
    var el = dojo.byId('centerpopup');
    
    el.innerHTML = '<form id="vcsauth">'
            + '<table><tbody><tr><td>Keychain password</td><td>'
            + '<input type="password" id="kcpass">'
            + '</td></tr><tr><td>&nbsp;</td><td>'
            + '<input type="button" id="vcsauthsubmit" value="Save">'
            + '<input type="button" id="vcsauthcancel" value="Cancel">'
            + '</td></tr></tbody></table></form>';
    
    dojo.connect(dojo.byId("vcsauthcancel"), "onclick", function() {
        bespin.util.webpieces.hideCenterPopup(el);
    });
    
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
}

// = Commands =
// Version Control System-related commands

// ** {{{{Command: clone}}}} **
bespin.cmd.commands.add({
    name: 'clone',
    takes: ['url'],
    aliases: ['checkout'],
    preview: 'checkout or clone the project into a new Bespin project',
    // ** {{{execute}}} **
    execute: function(self, url) {
        url = url || "";
        bespin.vcs.clone(url);
    }
});

// ** {{{Command: vcs}}} **
bespin.cmd.commands.add({
    name: 'vcs',
    takes: ['*'],
    preview: 'run any version control system command',
    // ** {{{execute}}} **
    execute: function(self, args) {
        var project;

        bespin.withComponent('editSession', function(editSession) {
            project = editSession.project;
        });

        if (!project) {
            self.showInfo("You need to pass in a project");
            return;
        }
        bespin.get('server').vcs(project, 
                                args.varargs, 
                                {evalJSON: true, 
                                onSuccess: function(response) {
                                    bespin.publish("vcs:response", response);
                                }});
    }                                
});

// ** {{{Command: diff}}} **
bespin.cmd.commands.add({
    name: 'diff',
    preview: 'Display the differences in the checkout out files',
    // ** {{{execute}}} **
    execute: function(self) {
        var project;

        bespin.withComponent('editSession', function(editSession) {
            project = editSession.project;
        });

        if (!project) {
            self.showInfo("You need to pass in a project");
            return;
        }
        bespin.get('server').vcs(project, 
                                ["diff"], 
                                {evalJSON: true, 
                                onSuccess: function(response) {
                                    bespin.publish("vcs:response", response);
                                }});
    }                                
});

// ** {{{Command: commit}}} **
bespin.cmd.commands.add({
    name: 'commit',
    takes: ['message'],
    preview: 'Commit to the repository',
    // ** {{{execute}}} **
    execute: function(self, message) {
        if (!message) {
            self.showInfo("You must enter a log message");
            return;
        }
        var project;

        bespin.withComponent('editSession', function(editSession) {
            project = editSession.project;
        });

        if (!project) {
            self.showInfo("You need to pass in a project");
            return;
        }
        bespin.get('server').vcs(project, 
                                ['commit', '-m', 'message'], 
                                {evalJSON: true, 
                                onSuccess: function(response) {
                                    bespin.publish("vcs:response", response);
                                }});
    }                                
});

bespin.cmd.commands.add({
    name: "authset",
    takes: ['type', 'project'],
    preview: "Setup authentication for the given project<br>Type can be 'ssh' or 'password'",
    execute: function(self, args) {
        var project = args.project;
        if (!project) {
            bespin.withComponent('editSession', function(editSession) {
                project = editSession.project;
            });
        }
        
        if (!project) {
            self.showInfo("You need to pass in a project");
            return;
        }

        if (args.type == "password") {
            bespin.vcs.setProjectPassword(project);
        }
    }
});

bespin.cmd.commands.add({
    name: 'getkey',
    preview: 'Get your SSH public key that Bespin can use for remote repository authentication. This will prompt for your keychain password.',
    execute: function(self) {
        bespin.vcs.getKeychainPassword(function(kcpass) {
            bespin.get('server').getkey(kcpass, {
                onSuccess: function(response) {
                    bespin.util.webpieces.showContentOverlay(
                        '<h2>Your Bespin SSH public key</h2><input type="text" value="' 
                        + response + '" id="sshkey" style="width: 95%">'
                    );
                    dojo.byId("sshkey").select()
                },
                on401: function(response) {
                    self.showInfo("Bad keychain password.");
                },
                onFailure: function(response) {
                    self.showInfo("getkey failed: " + response);
                }
            });
        });
    }
});

// ** {{{ Event: bespin:vcs:response }}} **
// Handle a response from a version control system command
bespin.subscribe("vcs:response", function(event) {
    bespin.util.webpieces.showContentOverlay(event.output, {pre: true});
});

// ** {{{ Event: bespin:vcs:error }}} **
// Handle a negative response from a version control system command
bespin.subscribe("vcs:error", function(event) {
    bespin.util.webpieces.showContentOverlay("<h2>Error in VCS command</h2><pre>" + event.responseText + "</pre>");
});
