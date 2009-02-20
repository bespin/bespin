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

// = Event Bus =
//
// Global home for event watching where it doesn't fit using the pattern
// of custom events tied to components themselves such as:
//
// * {{{Bespin.CommandLine.Events}}}
// * {{{Bespin.Settings.Events}}}

// ** {{{ Event: bespin:editor:newfile }}} **
// 
// Observe a request for a new file to be created
document.observe("bespin:editor:newfile", function(event) {
    var project = event.memo.project || _editSession.project;
    var newfilename = event.memo.newfilename || "new.txt";
    var content = event.memo.content || " ";

    _files.newFile(project, newfilename, function() {
        document.fire("bespin:editor:openfile:opensuccess", { file: {
            name: newfilename,
            content: content,
            timestamp: new Date().getTime()
        }});
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
document.observe("bespin:editor:openfile", function(event) {
    var filename = event.memo.filename;
    var project  = event.memo.project || _editSession.project;

    if (_editSession.checkSameFile(project, filename)) return; // short circuit

    document.fire("bespin:editor:openfile:openbefore", { filename: filename });

    _files.loadFile(project, filename, function(file) {
        if (!file) {
            document.fire("bespin:editor:openfile:openfail", { filename: filename });
        } else {
            document.fire("bespin:editor:openfile:opensuccess", { file: file });
        }
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
document.observe("bespin:editor:forceopenfile", function(event) {
    var filename = event.memo.filename;
    var project  = event.memo.project || _editSession.project;

    if (_editSession.checkSameFile(project, filename)) return; // short circuit

    _files.forceOpenFile(project, filename);
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

document.observe("bespin:editor:savefile", function(event) {
    var filename = event.memo.filename;
    
    filename = filename || _editSession.path; // default to what you have

    document.fire("bespin:editor:openfile:savebefore", { filename: filename });

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

    document.fire("bespin:editor:titlechange", { filename: filename });

    document.fire("bespin:cmdline:showinfo", { msg: 'Saved file: ' + file.name, autohide: true });
});


// == Shell Events: Header, Chrome, etc ==
//
// ** {{{ Event: bespin:editor:openfile:opensuccess }}} **
// 
// When a file is opened successfully change the project and file status area.
// Then change the window title, and change the URL hash area
document.observe("bespin:editor:openfile:opensuccess", function(event) {
    var file = event.memo.file;
    
    var filename = file.name;

    _projectLabel.attributes.text = _editSession.projectForDisplay();
    _fileLabel.attributes.text = filename;
    _scene.render();

    document.fire("bespin:editor:titlechange", { filename: file.name });

    document.fire("bespin:editor:urlchange", { project: _editSession.project, path: file.name });
});

// ** {{{ Event: bespin:editor:titlechange }}} **
// 
// Observe a title change event and then... change the document.title!
document.observe("bespin:editor:titlechange", function(event) {
    var title;
    if (event.memo.filename) title = event.memo.filename + ' - editing with Bespin';
    else if (event.memo.title) title = event.memo.title;
    else title = 'Bespin &raquo; Code in the Cloud';

    document.title = title;
});

// ** {{{ Event: bespin:editor:urlchange }}} **
// 
// Observe a urlchange event and then... change the location hash
document.observe("bespin:editor:urlchange", function(event) {
    var project = event.memo.project;
    var path    = event.memo.path;

    document.location.hash = "project=" + project + "&path=" + path;
});

// ** {{{ Event: bespin:cmdline:executed }}} **
// 
// Set the last command in the status window
document.observe("bespin:cmdline:executed", function(event) {
    var commandname = event.memo.command.name;
    var args        = event.memo.args;

    $('message').innerHTML = "last cmd: <span title='" + commandname + " " + args + "'>" + commandname + "</span>"; // set the status message area
});

// ** {{{ Event: bespin:editor:config:run }}} **
// 
// Load the users config file
document.observe("bespin:editor:config:run", function(event) {
    // 1. load the file
    //   project: _editSession.userproject,
    //   filename: "config.js"
    // 2. Take the contents and run each line as a command 
    _files.loadFile(_editSession.userproject, "config.js", function(file) {
        var contents = file.content.split(/\n/);

        contents.each(function(line) {
            if (line.startsWith('/') || line.startsWith('#')) return;
            line = line.replace(/#.*$/, ''); // nuke inline comment (e.g. "version    # get the current version")
            var command = line.split(' ');
            var commandname = command.first();
            if (_commandLine.hasCommand(commandname)) {
                _commandLine.executeCommand(line);
            }
        });
    }, true);
});

// ** {{{ Event: bespin:editor:config:edit }}} **
// 
// Open the users special config file
document.observe("bespin:editor:config:edit", function(event) {
    if (!_editSession.userproject) {
        document.fire("bespin:cmdline:showinfo", { msg: "You don't seem to have a user project. Sorry." });
        return;
    }

    document.fire("bespin:editor:openfile", {
        project: _editSession.userproject,
        filename: "config.js"
    });
});

// ** {{{ Event: bespin:editor:commands:add }}} **
// 
// Create a new command in your special command directory
document.observe("bespin:editor:commands:add", function(event) {
    var commandname = event.memo.commandname;
    
    if (!commandname) {
        document.fire("bespin:cmdline:showinfo", { msg: "Please pass me a command name to add." });
        return;
    }

    document.fire("bespin:editor:forceopenfile", {
        project: _editSession.userproject,
        filename: "commands/" + commandname + ".js"
    });
});

// ** {{{ Event: bespin:editor:preview }}} **
// 
// Load the users config file
document.observe("bespin:editor:preview", function(event) {
    var filename = event.memo.filename || _editSession.path; // default to current page
    var project  = event.memo.project  || _editSession.project;

    // Make sure to save the file first
    document.fire("bespin:editor:savefile", {
        filename: filename
    });

    if (filename)
        window.open(Bespin.Path.combine("preview/at", project, filename));
});

// ** {{{ Event: bespin:editor:closefile }}} **
// 
// Load the users config file
document.observe("bespin:editor:closefile", function(event) {
    var filename = event.memo.filename || _editSession.path; // default to current page
    var project  = event.memo.project  || _editSession.project;

    _files.closeFile(project, filename, function() {
        document.fire("bespin:editor:closedfile", { filename: filename });
        
        // if the current file, move on to a new one
        if (filename == _editSession.path) document.fire("bespin:editor:newfile");

        document.fire("bespin:cmdline:showinfo", { msg: 'Closed file: ' + filename, autohide: true });
    });
});

// ** {{{ Event: bespin:editor:project:create }}} **
// 
// Create a new project
document.observe("bespin:editor:project:create", function(event) {
    var project = event.memo.project || _editSession.project;
    
    _files.createProject(project);
    
    document.fire("bespin:editor:project:set", { project: project });
});


// == Events
// 
// ** {{{ Bespin.Events }}} **
//
// Helpers for the event subsystem
Bespin.Events = {

    // ** {{{ Bespin.Events.toFire }}} **
    //
    // Given an {{{eventString}}} parse out the arguments and configure an event object
    //
    // Example events:
    //
    // * {{{bespin:cmdline:execute;name=ls,args=bespin}}}
    // * {{{bespin:cmdline:execute}}}
    toFire: function(eventString) {
        var event = {};
        if (!eventString.indexOf(';')) { // just a plain command with no args
            event.name = eventString;
        } else { // split up the args
            var pieces = eventString.split(';');
            event.name = pieces[0];
            event.args = pieces[1].toQueryParams(',');
        }
        return event;
    }
};