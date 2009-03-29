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
 
dojo.provide("bespin.events");

dojo.require("bespin.util.util");

// = Event Bus =
//
// Global home for event watching where it doesn't fit using the pattern
// of custom events tied to components themselves such as:
//
// * {{{bespin.cmd.commandline.Events}}}
// * {{{bespin.client.settings.Events}}}

// ** {{{ Event: editor:titlechange }}} **
// 
// Observe a title change event and then... change the document.title!
bespin.subscribe("editor:titlechange", function(event) {
    var title;
    if (event.filename) title = event.filename + ' - editing with Bespin';
    else if (event.title) title = event.title;
    else title = 'Bespin &raquo; Code in the Cloud';

    document.title = title;
});

// ** {{{ Event: editor:evalfile }}} **
// 
// Load up the given file and try to run it
bespin.subscribe("editor:evalfile", function(event) {
    var project  = event.project;
    var filename = event.filename;
    var scope    = event.scope || bespin.events.defaultScope();

    if (!project || !filename) {
        bespin.get('commandLine').showInfo("Please, I need a project and filename to evaulate");
        return;
    }

    bespin.get('files').loadFile(project, filename, function(file) {
        with (scope) { // wow, using with. crazy.
            try {
                bespin.publish("cmdline:suppressinfo");
                eval(file.content);
                bespin.publish("cmdline:unsuppressinfo");
            } catch (e) {
                bespin.get('commandLine').showInfo("There is a error trying to run " + filename + " in project " + project + ":<br><br>" + e);
            }
        }
    }, true);
});

// ** {{{ Event: editor:preview }}} **
// 
// Preview the given file in a browser context
bespin.subscribe("editor:preview", function(event) {
    var editSession = bespin.get('editSession');
    var filename = event.filename || editSession.path;  // default to current page
    var project  = event.project  || editSession.project; 

    // Make sure to save the file first
    bespin.publish("editor:savefile", {
        filename: filename
    });

    if (filename) {
        window.open(bespin.util.path.combine("preview/at", project, filename));
    }
});

// ** {{{ Event: editor:closefile }}} **
// 
// Close the given file (wrt the session)
bespin.subscribe("editor:closefile", function(event) {
    var editSession = bespin.get('editSession');
    var filename = event.filename || editSession.path;  // default to current page
    var project  = event.project  || editSession.project;   
    
    bespin.get('files').closeFile(project, filename, function() {
        bespin.publish("editor:closedfile", { filename: filename }); 
        
        // if the current file, move on to a new one
        if (filename == editSession.path) bespin.publish("editor:newfile");    

        bespin.publish("message", { msg: 'Closed file: ' + filename });
    });
});

// ** {{{ Event: editor:config:run }}} **
//
// Load and execute the user's config file
bespin.subscribe("editor:config:run", function(event) {
    bespin.publish("editor:evalfile", {
        project: bespin.userSettingsProject,
        filename: "config.js"
    });
});

// ** {{{ Event: editor:config:edit }}} **
// 
// Open the users special config file
bespin.subscribe("editor:config:edit", function(event) {
    if (!bespin.userSettingsProject) {
        bespin.publish("message", { msg: "You don't seem to have a user project. Sorry." });
        return;
    }

    bespin.publish("editor:openfile", {
        project: bespin.userSettingsProject,
        filename: "config.js"
    });
});

// ** {{{ Event: command:executed }}} **
// 
// Set the last command in the status window
bespin.subscribe("command:executed", function(event) {
    var commandname = event.command.name;
    var args        = event.args;

    dojo.byId('message').innerHTML = "last cmd: <span title='" + commandname + " " + args + "'>" + commandname + "</span>"; // set the status message area
});

// ** {{{ Event: command:load }}} **
// 
// Create a new command in your special command directory
bespin.subscribe("command:load", function(event) {
    var commandname = event.commandname;
    
    if (!commandname) {
        bespin.publish("message", { msg: "Please pass me a command name to load." });
        return;
    }

    bespin.get('files').loadFile(bespin.userSettingsProject, "commands/" + commandname + ".js", function(file) {
        try {
            eval('bespin.get("commandLine").addCommands([' + file.content + '])');
        } catch (e) {
            bespin.publish("message", { msg: "Something is wrong about the command:<br><br>" + e });
        }
    }, true);
});

// ** {{{ Event: command:edit }}} **
// 
// Edit the given command
bespin.subscribe("command:edit", function(event) {
    var commandname = event.commandname;
    
    if (!bespin.userSettingsProject) {
        bespin.publish("message", { msg: "You don't seem to have a user project. Sorry." });
        return;
    }

    if (!commandname) {
        bespin.publish("message", { msg: "Please pass me a command name to edit." });
        return;
    }
    
    bespin.publish("editor:forceopenfile", {
        project: bespin.userSettingsProject,
        filename: "commands/" + commandname + ".js",
        content: "{\n    name: '" + commandname + "',\n    takes: [YOUR_ARGUMENTS_HERE],\n    preview: 'execute any editor action',\n    execute: function(self, args) {\n\n    }\n}"
    });
});

// ** {{{ Event: command:list }}} **
// 
// List the custom commands that a user has
bespin.subscribe("command:list", function(event) {
    if (!bespin.userSettingsProject) {
        bespin.publish("message", { msg: "You don't seem to have a user project. Sorry." });
        return;
    }

    bespin.get('server').list(bespin.userSettingsProject, 'commands/', function(commands) {
        var output;
        
        if (!commands || commands.length < 1) {
            output = "You haven't installed any custom commands.<br>Want to <a href='https://wiki.mozilla.org/Labs/Bespin/Roadmap/Commands'>learn how?</a>";
        } else {
            output = "<u>Your Custom Commands</u><br/><br/>";
            
            output += dojo.map(dojo.filter(commands, function(file) {
                return bespin.util.endsWith(file.name, '\\.js');
            }), function(c) { return c.name.replace(/\.js$/, ''); }).join("<br>");
        }
        
        bespin.publish("message", { msg: output });
    });
});

// ** {{{ Event: command:delete }}} **
// 
// Delete the named command
bespin.subscribe("command:delete", function(event) {
    var commandname = event.commandname;
    
    var editSession = bespin.get('editSession');
    var files = bespin.get('files');

    if (!bespin.userSettingsProject) {
        bespin.publish("message", { msg: "You don't seem to have a user project. Sorry." });
        return;
    }

    if (!commandname) {
        bespin.publish("message", { msg: "Please pass me a command name to delete." });
        return;
    }

    var commandpath = "commands/" + commandname + ".js";
    
    files.removeFile(bespin.userSettingsProject, commandpath, function() {
        if (editSession.checkSameFile(bespin.userSettingsProject, commandpath)) bespin.get('editor').model.clear(); // only clear if deleting the same file
        bespin.publish("message", { msg: 'Removed command: ' + commandname, tag: 'autohide' });
    }, function(xhr) {
        bespin.publish("message", { 
            msg: "Wasn't able to remove the command <b>" + commandname + "</b><br/><em>Error</em> (probably doesn't exist): " + xhr.responseText, 
            tag: 'autohide'
        });
    });
});

// ** {{{ Event: directory:create }}} **
// 
// Create a new directory
bespin.subscribe("directory:create", function(event) {
    var editSession = bespin.get('editSession');
    var files = bespin.get('files');

    var project = event.project || editSession.project;
    var path = event.path || '';
    
    files.makeDirectory(project, path, function() {
        if (path == '') bespin.publish("project:set", { project: project });
        bespin.publish("message", { 
            msg: 'Successfully created directory: [project=' + project + ', path=' + path + ']', tag: 'autohide' });
    }, function() {
        bespin.publish("message", {
            msg: 'Unable to delete directory: [project=' + project + ', path=' + path + ']' + project, tag: 'autohide' });
    });
});

// ** {{{ Event: directory:delete }}} **
// 
// Delete a directory
bespin.subscribe("directory:delete", function(event) {
    var editSession = bespin.get('editSession');
    var files = bespin.get('files');

    var project = event.project || editSession.project;
    var path = event.path || '';
    
    if (project == bespin.userSettingsProject && path == '/') return; // don't delete the settings project
    
    files.removeDirectory(project, path, function() {
        if (path == '/') bespin.publish("project:set", { project: '' }); // reset
        bespin.publish("message", { 
            msg: 'Successfully deleted directory: [project=' + project + ', path=' + path + ']', tag: 'autohide' });
    }, function() {
        bespin.publish("message", {
            msg: 'Unable to delete directory: [project=' + project + ', path=' + path + ']', tag: 'autohide' });
    });
});

// ** {{{ Event: project:create }}} **
// 
// Create a new project
bespin.subscribe("project:create", function(event) {
    var project = event.project || bespin.get('editSession').project;
    
    bespin.publish("directory:create", { project: project });
});

// ** {{{ Event: project:delete }}} **
// 
// Delete a project
bespin.subscribe("project:delete", function(event) {
    var project = event.project;
    if (!project || project == bespin.userSettingsProject) return; // don't delete the settings project
    
    bespin.publish("directory:delete", { project: project });
});

// ** {{{ Event: project:rename }}} **
// 
// Rename a project
bespin.subscribe("project:rename", function(event) {
    var currentProject = event.currentProject;
    var newProject = event.newProject;
    if ( (!currentProject || !newProject) || (currentProject == newProject) ) return;
    
    bespin.get('server').renameProject(currentProject, newProject, {
        onSuccess: function() {
            bespin.publish("project:set", { project: newProject });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: 'Unable to rename project from ' + currentProject + " to " + newProject + "<br><br><em>Are you sure that the " + currentProject + " project exists?</em>", tag: 'autohide' });
        }
    });
});


// ** {{{ Event: project:import }}} **
// 
// Import a project
bespin.subscribe("project:import", function(event) {
    var project = event.project;
    var url = event.url;

    bespin.get('server').importProject(project, url, { onSuccess: function() {
        bespin.publish("message", { msg: "Project " + project + " imported from:<br><br>" + url, tag: 'autohide' });
    }, onFailure: function(xhr) {
        bespin.publish("message", { msg: "Unable to import " + project + " from:<br><br>" + url + ".<br><br>Maybe due to: " + xhr.responseText });
    }});
});



// == Events
// 
// ** {{{ bespin.events }}} **
//
// Helpers for the event subsystem

// ** {{{ bespin.events.toFire }}} **
//
// Given an {{{eventString}}} parse out the arguments and configure an event object
//
// Example events:
//
// * {{{command:execute;name=ls,args=bespin}}}
// * {{{command:execute}}} 
    
dojo.mixin(bespin.events, {
    toFire: function(eventString) {
        var event = {};
        if (!eventString.indexOf(';')) { // just a plain command with no args
            event.name = eventString;
        } else { // split up the args
            var pieces = eventString.split(';');
            event.name = pieces[0];
            event.args = bespin.util.queryToObject(pieces[1], ',');
        }
        return event;
    }
});

// ** {{{ bespin.events.defaultScope }}} **
//
// Return a default scope to be used for evaluation files
bespin.events.defaultScope = function() {
    if (bespin.events._defaultScope) return bespin.events._defaultScope;
    
    var scope = {
        bespin: bespin,
        include: function(file) {
            bespin.publish("editor:evalfile", {
                project: bespin.userSettingsProject,
                filename: file
            });
        },
        tryTocopyComponent: function(id) {
            bespin.withComponent(id, dojo.hitch(this, function(component) {
                this.id = component;
            }));
        },
        require: dojo.require,
        publish: bespin.publish,
        subscribe: bespin.subscribe
    };

    bespin.withComponent('commandLine', function(commandLine) {
        scope.commandLine = commandLine;
        scope.execute = function(cmd) {
            commandLine.executeCommand(cmd);
        };
    });

    scope.tryTocopyComponent('editor');
    scope.tryTocopyComponent('editSession');
    scope.tryTocopyComponent('files');
    scope.tryTocopyComponent('server');
    scope.tryTocopyComponent('toolbar');

    bespin.events._defaultScope = scope; // setup the short circuit

    return bespin.events._defaultScope;
};

// ** {{{ Event: network:followers }}} **
// Get a list of our followers
bespin.subscribe("network:followers", function() {
    bespin.get('server').followers({
        onSuccess: function(data) {
            bespin.publish("message", { msg: "Following " + data });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to retrieve followers. Maybe due to: " + xhr.responseText });
        }
    });
});

// ** {{{ Event: network:follow }}} **
// Add to the list of users that we follow
bespin.subscribe("network:follow", function(usernames) {
    bespin.get('server').follow(usernames, {
        onSuccess: function(data) {
            bespin.publish("message", { msg: "Following " + data });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to retrieve followers. Maybe due to: " + xhr.responseText });
        }
    });
});

// ** {{{ Event: network:unfollow }}} **
// Remove users from the list that we follow
bespin.subscribe("network:unfollow", function(usernames) {
    bespin.get('server').unfollow(usernames, {
        onSuccess: function(data) {
            bespin.publish("message", { msg: "Following " + data });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to retrieve followers. Maybe due to: " + xhr.responseText });
        }
    });
});

// ** {{{ Event: groups:list:all }}} **
// Get a list of our groups
bespin.subscribe("groups:list:all", function() {
    bespin.get('server').groupListAll({
        onSuccess: function(data) {
            bespin.publish("message", { msg: "Known groups " + data });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to retrieve groups. Maybe due to: " + xhr.responseText });
        }
    });
});

// ** {{{ Event: groups:list }}} **
// Get a list of group members
bespin.subscribe("groups:list", function(group) {
    bespin.get('server').groupList(group, {
        onSuccess: function(data) {
            bespin.publish("message", { msg: "Members of " + group + ": " + data });
        },
        onFailure: function(xhr) {
            bespin.publish("message", { msg: "Failed to retrieve group members. Maybe due to: " + xhr.responseText });
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

// ** {{{ Event: bespin:vcs:response }}} **
// Handle a response from a version control system command
bespin.subscribe("bespin:vcs:response", function(event) {
    dojo.require("bespin.util.webpieces");
    bespin.util.webpieces.showContentOverlay(event.output, {pre: true});
});
