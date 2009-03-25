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

dojo.provide("bespin.cmd.commands");

// = Commands =
// Version Control System-related commands

// ** {{{{Command: clone}}}} **
bespin.cmd.commands.add({
    name: 'clone',
    takes: ['url', 'projectName'],
    aliases: ['checkout'],
    preview: 'checkout or clone the project into a new Bespin project',
    // ** {{{execute}}} **
    execute: function(self, args) {
        if (!args.url || !args.projectName) {
            self.showUsage();
            return;
        }
        bespin.get('server').vcs(args.projectName, 
                                ["clone", args.url], 
                                {evalJSON: true, 
                                call: function(response) {
                                    bespin.publish("bespin:vcs:response", response);
                                }});
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
                                call: function(response) {
                                    bespin.publish("bespin:vcs:response", response);
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
                                call: function(response) {
                                    bespin.publish("bespin:vcs:response", response);
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
                                call: function(response) {
                                    bespin.publish("bespin:vcs:response", response);
                                }});
    }                                
});

bespin.cmd.command.add({
    name: "auth",
    takes: ['type', 'project'],
    preview: "Setup authentication for the given project<br>Type can be 'ssh' or 'password'",
    
})