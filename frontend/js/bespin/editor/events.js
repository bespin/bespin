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
 
dojo.provide("bespin.editor.events");

dojo.require("bespin.util.util");

// = Editor Events =
//
// Add to the core events.js

// ** {{{ Event: bespin:editor:openfile }}} **
// 
// Observe a request for a file to be opened and start the cycle:
//
// * Send event that you are opening up something (openbefore)
// * Ask the file system to load a file (loadFile)
// * If the file is loaded send an opensuccess event
// * If the file fails to load, send an openfail event
bespin.subscribe("bespin:editor:openfile", function(event) {
    var filename = event.filename;
    var project  = event.project || _editSession.project;

    if (_editSession.checkSameFile(project, filename)) return; // short circuit

    bespin.publish("bespin:editor:openfile:openbefore", { filename: filename });

    _files.loadFile(project, filename, function(file) {
        if (!file) {
            bespin.publish("bespin:editor:openfile:openfail", { filename: filename });
        } else {
            bespin.publish("bespin:editor:openfile:opensuccess", { file: file });
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
bespin.subscribe("bespin:editor:forceopenfile", function(event) {
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

// ** {{{ Event: bespin:editor:newfile }}} **
// 
// Observe a request for a new file to be created
bespin.subscribe("bespin:editor:newfile", function(event) {
    var project = event.project || _editSession.project; 
    var newfilename = event.newfilename || "new.txt";
    
    _files.newFile(project, newfilename, function() {
        bespin.publish("bespin:editor:openfile:opensuccess", { file: {
            name: newfilename,
            content: " ",
            timestamp: new Date().getTime()
        }});
    });        
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

bespin.subscribe("bespin:editor:savefile", function(event) {
    var filename = event.filename || _editSession.path; // default to what you have

    bespin.publish("bespin:editor:openfile:savebefore", { filename: filename });

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

    bespin.publish("bespin:editor:titlechange", { filename: filename });

    bespin.publish("bespin:cmdline:showinfo", { msg: 'Saved file: ' + file.name, autohide: true });
});


// == Shell Events: Header, Chrome, etc ==
//
// ** {{{ Event: bespin:editor:openfile:opensuccess }}} **
// 
// When a file is opened successfully change the project and file status area.
// Then change the window title, and change the URL hash area
bespin.subscribe("bespin:editor:openfile:opensuccess", function(event) {
    var file = event.file;

    var filename = file.name;

    _projectLabel.attributes.text = _editSession.projectForDisplay();
    _fileLabel.attributes.text = filename;
    _scene.render();

    bespin.publish("bespin:editor:titlechange", { filename: file.name });

    bespin.publish("bespin:editor:urlchange", { project: _editSession.project, path: file.name });
});

// ** {{{ Event: bespin:editor:urlchange }}} **
// 
// Observe a urlchange event and then... change the location hash
bespin.subscribe("bespin:editor:urlchange", function(event) {
    var project = event.project;
    var path    = event.path;

    window.location.hash = "project=" + project + "&path=" + path;
});

// ** {{{ Event: bespin:session:status }}} **
// 
// Observe a request for session status
bespin.subscribe("bespin:session:status", function(event) {
    var file = _editSession.path || 'a new scratch file';
    self.showInfo('Hey ' + _editSession.username + ', you are editing ' + file + ' in project ' + _editSession.projectForDisplay());
});