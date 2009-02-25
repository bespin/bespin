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
// * {{{bespin.clien.settings.Events}}}

// ** {{{ Event: bespin:editor:newfile }}} **
// 
// Observe a request for a new file to be created
dojo.subscribe("bespin:editor:newfile", function(event) {
    var project  = (event) ? event.project : _editSession.project; 
    var newfilename = (event) ? event.newfilename : "new.txt";

    _files.newFile(project, newfilename, function() {
        dojo.publish("bespin:editor:openfile:opensuccess", [{ file: {
            name: newfilename,
            content: " ",
            timestamp: new Date().getTime()
        }}]);
    });
});

// ** {{{ Event: bespin:editor:openfile }}} **
// 
// Observe a request for a file to be opened and start the cycle:
//
// * Send event that you are opening up something (openbefore)
// * Ask the file system to load a file (loadFile)
// * If the file is loaded send an opensuccess event
// * If the file fails to load, send an openfail event
dojo.subscribe("bespin:editor:openfile", function(event) {
    var filename = event.filename;
    var project  = event.project || _editSession.project;

    if (_editSession.checkSameFile(project, filename)) return; // short circuit

    dojo.publish("bespin:editor:openfile:openbefore", [{ filename: filename }]);

    _files.loadFile(project, filename, function(file) {
        if (!file) {
            dojo.publish("bespin:editor:openfile:openfail", [{ filename: filename }]);
        } else {
            dojo.publish("bespin:editor:openfile:opensuccess", [{ file: file }]);
        }
    });
});

// ** {{{ Event: bespin:editor:forceopenfile }}} **
// 
// Observe a request for a file to be opened and start the cycle:
//
// * Send event that you are opening up something (openbefore)
// * Ask the file system to load a file (loadFile)
// * If the file is loaded send an opensuccess event
// * If the file fails to load, send an openfail event
dojo.subscribe("bespin:editor:forceopenfile", function(event) {
    var filename = event.filename;
    var project  = event.project;
    var content  = event.content || " ";
    
    if (typeof _editSession != "undefined") {
        if (!project) project = _editSession.project;
        if (_editSession.checkSameFile(project, filename)) return; // short circuit
    }

    if (!project) return; // short circuit

    _files.forceOpenFile(project, filename, content);
});

// ** {{{ Event: bespin:editor:savefile }}} **
// 
// Observe a request for a file to be saved and start the cycle:
//
// * Send event that you are about to save the file (savebefore)
// * Get the last operation from the sync helper if it is up and running
// * Ask the file system to save the file
// * Change the page title to have the new filename
// * Tell the command line to show the fact that the file is saved
//
// TODO: Need to actually check saved status and know if the save worked

dojo.subscribe("bespin:editor:savefile", function(event) {
    var filename = event.filename || _editSession.path; // default to what you have

    dojo.publish("bespin:editor:openfile:savebefore", [{ filename: filename }]);

    var file = {
        name: filename,
        content: _editor.model.getDocument(),
        timestamp: new Date().getTime()
    };

    if (_editor.undoManager.syncHelper) { // only if ops are on
        file.lastOp = _editor.undoManager.syncHelper.lastOp;
    }

    _files.saveFile(_editSession.project, file); // it will save asynchronously.
    // TODO: Here we need to add in closure to detect errors and thus fire different success / error

    dojo.publish("bespin:editor:titlechange", [{ filename: filename }]);

    dojo.publish("bespin:cmdline:showinfo", [{ msg: 'Saved file: ' + file.name, autohide: true }]);
});


// == Shell Events: Header, Chrome, etc ==
//
// ** {{{ Event: bespin:editor:openfile:opensuccess }}} **
// 
// When a file is opened successfully change the project and file status area.
// Then change the window title, and change the URL hash area
dojo.subscribe("bespin:editor:openfile:opensuccess", function(event) {
    var file = event.file;

    var filename = file.name;

    _projectLabel.attributes.text = _editSession.projectForDisplay();
    _fileLabel.attributes.text = filename;
    _scene.render();

    dojo.publish("bespin:editor:titlechange", [{ filename: file.name }]);

    dojo.publish("bespin:editor:urlchange", [{ project: _editSession.project, path: file.name }]);
});

// ** {{{ Event: bespin:editor:titlechange }}} **
// 
// Observe a title change event and then... change the document.title!
dojo.subscribe("bespin:editor:titlechange", function(event) {
    var title;
    if (event.filename) title = event.filename + ' - editing with Bespin';
    else if (event.title) title = event.title;
    else title = 'Bespin &raquo; Code in the Cloud';

    document.title = title;
});

// ** {{{ Event: bespin:editor:urlchange }}} **
// 
// Observe a urlchange event and then... change the location hash
dojo.subscribe("bespin:editor:urlchange", function(event) {
    var project = event.project;
    var path    = event.path;

    window.location.hash = "project=" + project + "&path=" + path;
});

// ** {{{ Event: bespin:cmdline:executed }}} **
// 
// Set the last command in the status window
dojo.subscribe("bespin:cmdline:executed", function(event) {
    var commandname = event.command.name;
    var args        = event.args;

    dojo.byId('message').innerHTML = "last cmd: <span title='" + commandname + " " + args + "'>" + commandname + "</span>"; // set the status message area
});

// ** {{{ Event: bespin:editor:config:run }}} **
// 
// Load the users config file
dojo.subscribe("bespin:editor:config:run", function(event) {
    // 1. load the file
    //   project: _editSession.userproject,
    //   filename: "config.js"
    // 2. Take the contents and eval the code with a nice scope
    _files.loadFile(bespin.userSettingsProject, "config.js", function(file) {
        var scope = {
            bespin: bespin
        };

        if (typeof _commandLine != "undefined") scope.commandLine = _commandLine;
        if (typeof _editor != "undefined")      scope.editor = _editor;
        if (typeof _editSession != "undefined") scope.editSession = _editSession;
        if (typeof _files != "undefined")       scope.files = _files;        
        if (typeof _server != "undefined")      scope.server = _server;
        if (typeof _toolbar != "undefined")     scope.toolbar = _toolbar;
        
        with (scope) { // wow, using with. crazy.
            try {
                eval(file.content);
            } catch (e) {
                _commandLine.showInfo("There is a error in your config.js:<br><br>" + e);
            }
        }
    }, true);
});

// ** {{{ Event: bespin:editor:config:edit }}} **
// 
// Open the users special config file
dojo.subscribe("bespin:editor:config:edit", function(event) {
    if (!bespin.userSettingsProject) {
        dojo.publish("bespin:cmdline:showinfo", [{ msg: "You don't seem to have a user project. Sorry." }]);
        return;
    }

    dojo.publish("bespin:editor:openfile", [{
        project: bespin.userSettingsProject,
        filename: "config.js"
    }]);
});

// ** {{{ Event: bespin:commands:load }}} **
// 
// Create a new command in your special command directory
dojo.subscribe("bespin:commands:load", function(event) {
    var commandname = event.commandname;
    
    if (!commandname) {
        dojo.publish("bespin:cmdline:showinfo", [{ msg: "Please pass me a command name to load." }]);
        return;
    }

    _files.loadFile(bespin.userSettingsProject, "commands/" + commandname + ".js", function(file) {
        try {
            eval('_commandLine.addCommands([' + file.content.replace(/\n/g, "") + '])');
        } catch (e) {
            dojo.publish("bespin:cmdline:showinfo", [{ msg: "Something is wrong about the command:<br><br>" + e }]);
        }
    }, true);
});

// ** {{{ Event: bespin:commands:edit }}} **
// 
// Edit the given command
dojo.subscribe("bespin:commands:edit", function(event) {
    var commandname = event.commandname;
    
    if (!bespin.userSettingsProject) {
        dojo.publish("bespin:cmdline:showinfo", [{ msg: "You don't seem to have a user project. Sorry." }]);
        return;
    }

    if (!commandname) {
        dojo.publish("bespin:cmdline:showinfo", [{ msg: "Please pass me a command name to edit." }]);
        return;
    }
    
    dojo.publish("bespin:editor:forceopenfile", [{
        project: Bespin.userSettingsProject,
        filename: "commands/" + commandname + ".js",
        content: "{\n    name: '" + commandname + "',\n    takes: [YOUR_ARGUMENTS_HERE],\n    preview: 'execute any editor action',\n    execute: function(self, args) {\n\n    }\n}"
    }]);
});

// ** {{{ Event: bespin:commands:list }}} **
// 
// List the custom commands that a user has
dojo.subscribe("bespin:commands:list", function(event) {
    if (!bespin.userSettingsProject) {
        dojo.publish("bespin:cmdline:showinfo", [{ msg: "You don't seem to have a user project. Sorry." }]);
        return;
    }

    _server.list(bespin.userSettingsProject, 'commands/', function(commands) {
        var output;
        
        if (!commands || commands.length < 1) {
            output = "You haven't installed any custom commands.<br>Want to <a href='https://wiki.mozilla.org/Labs/Bespin/Roadmap/Commands'>learn how?</a>";
        } else {
            output = "<u>Your Custom Commands</u><br/><br/>";
            
            output += dojo.map(dojo.filter(commands, function(file) {
                return bespin.util.endsWith(file.name, '\\.js');
            }), function(c) { return c.name.replace(/\.js$/, '') }).join("<br>");
        }
        
        dojo.publish("bespin:cmdline:showinfo", [{ msg: output }]);
    });
});

// ** {{{ Event: bespin:commands:delete }}} **
// 
// List the custom commands that a user has
dojo.subscribe("bespin:commands:delete", function(event) {
    var commandname = event.commandname;

    if (!bespin.userSettingsProject) {
        dojo.publish("bespin:cmdline:showinfo", [{ msg: "You don't seem to have a user project. Sorry." }]);
        return;
    }

    if (!commandname) {
        dojo.publish("bespin:cmdline:showinfo", [{ msg: "Please pass me a command name to delete." }]);
        return;
    }

    var commandpath = "commands/" + commandname + ".js";
    
    _files.removeFile(bespin.userSettingsProject, commandpath, function() {
        if (_editSession.checkSameFile(Bespin.userSettingsProject, commandpath)) _editor.model.clear(); // only clear if deleting the same file
        dojo.publish("bespin:cmdline:showinfo", [{ msg: 'Removed command: ' + commandname, autohide: true }]);
    }, function(xhr) {
        dojo.publish("bespin:cmdline:showinfo", [{ 
            msg: "Wasn't able to remove the command <b>" + commandname + "</b><br/><em>Error</em> (probably doesn't exist): " + xhr.responseText, 
            autohide: true 
        }]);
    });
});


// ** {{{ Event: bespin:editor:preview }}} **
// 
// Load the users config file
dojo.subscribe("bespin:editor:preview", function(event) {
    var filename = (event) ? event.filename : _editSession.path;  // default to current page
    var project  = (event) ? event.project : _editSession.project; 

    // Make sure to save the file first
    dojo.publish("bespin:editor:savefile", [{
        filename: filename
    }]);

    if (filename)
        window.open(bespin.util.path.combine("preview/at", project, filename));
});

// ** {{{ Event: bespin:editor:closefile }}} **
// 
// Load the users config file
dojo.subscribe("bespin:editor:closefile", function(event) {
    var filename = (event) ? event.filename : _editSession.path;  // default to current page
    var project  = (event) ? event.project : _editSession.project;   
    
    _files.closeFile(project, filename, function() {
        dojo.publish("bespin:editor:closedfile", [{ filename: filename }]); 
        
        // if the current file, move on to a new one
        if (filename == _editSession.path) dojo.publish("bespin:editor:newfile");    

        dojo.publish("bespin:cmdline:showinfo", [{ msg: 'Closed file: ' + filename }]); 
    });
});

// ** {{{ Event: bespin:directory:create }}} **
// 
// Create a new directory
dojo.subscribe("bespin:directory:create", function(event) {
    var project  = (event) ? event.project : _editSession.project;
    var path = (event) ? event.path : ''; 
    
    _files.makeDirectory(project, path, function() {
        if (path == '') dojo.publish("bespin:project:set", [{ project: project }]);
        dojo.publish("bespin:cmdline:showinfo", [{ 
            msg: 'Successfully created directory: [project=' + project + ', path=' + path + ']', autohide: true }]);
    }, function() {
        dojo.publish("bespin:cmdline:showinfo", [{ 
            msg: 'Unable to delete directory: [project=' + project + ', path=' + path + ']' + project, autohide: true }]);
    });
});

dojo.subscribe("bespin:directory:delete", function(event) {
    var project  = (event) ? event.project : _editSession.project;
    var path = (event) ? event.path : '';
    
    if (project == bespin.userSettingsProject && path == '/') return; // don't delete the settings project
    
    _files.removeDirectory(project, path, function() {
        if (path == '/') dojo.publish("bespin:project:set", [{ project: '' }]); // reset
        dojo.publish("bespin:cmdline:showinfo", [{ 
            msg: 'Successfully deleted directory: [project=' + project + ', path=' + path + ']', autohide: true }]);
    }, function() {
        dojo.publish("bespin:cmdline:showinfo", [{
            msg: 'Unable to delete directory: [project=' + project + ', path=' + path + ']', autohide: true }]);
    });
});

// ** {{{ Event: bespin:project:create }}} **
// 
// Create a new project
dojo.subscribe("bespin:project:create", function(event) {
    var project  = (event) ? event.project : _editSession.project;
    
    dojo.publish("bespin:directory:create", [{ project: project }]);    
});

// ** {{{ Event: bespin:project:delete }}} **
// 
// Create a new project
dojo.subscribe("bespin:project:delete", function(event) {
    var project = event.project;
    if (!project || project == bespin.userSettingsProject) return; // don't delete the settings project
    
    dojo.publish("bespin:directory:delete", [{ project: project }]);
});

// ** {{{ Event: bespin:project:delete }}} **
// 
// Create a new project
dojo.subscribe("bespin:project:rename", function(event) {
    var currentProject = event.currentProject;
    var newProject = event.newProject;
    if ( (!currentProject || !newProject) || (currentProject == newProject) ) return;
    
    _server.renameProject(currentProject, newProject, {
        call: function() {
            dojo.publish("bespin:project:set", [{ project: newProject }]);
        },
        onFailure: function(xhr) {
            dojo.publish("bespin:cmdline:showinfo", [{ msg: 'Unable to rename project from ' + currentProject + " to " + newProject + "<br><br><em>Are you sure that the " + currentProject + " project exists?</em>", autohide: true }]);
        }
    });
});


// ** {{{ Event: bespin:project:delete }}} **
// 
// Create a new project
dojo.subscribe("bespin:project:import", function(event) {
    var project = event.project;
    var url = event.url;

    _server.importProject(project, url, { call: function() {
        dojo.publish("bespin:cmdline:showinfo", [{ msg: "Project " + project + " imported from:<br><br>" + url, autohide: true }]);
    }, onFailure: function(xhr) {
        dojo.publish("bespin:cmdline:showinfo", [{ msg: "Unable to import " + project + " from:<br><br>" + url + ".<br><br>Maybe due to: " + xhr.responseText }]);
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
// * {{{bespin:cmdline:execute;name=ls,args=bespin}}}
// * {{{bespin:cmdline:execute}}} 
    
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