//  ***** BEGIN LICENSE BLOCK *****
// Version: MPL 1.1
// 
// The contents of this file are subject to the Mozilla Public License  
// Version
// 1.1 (the "License"); you may not use this file except in compliance  
// with
// the License. You may obtain a copy of the License at
// http://www.mozilla.org/MPL/
// 
// Software distributed under the License is distributed on an "AS IS"  
// basis,
// WITHOUT WARRANTY OF ANY KIND, either express or implied. See the  
// License
// for the specific language governing rights and limitations under the
// License.
// 
// The Original Code is Bespin.
// 
// The Initial Developer of the Original Code is Mozilla.
// Portions created by the Initial Developer are Copyright (C) 2009
// the Initial Developer. All Rights Reserved.
// 
// Contributor(s):
// 
// ***** END LICENSE BLOCK *****
// 

/*
 * Event Bus
 */

document.observe("bespin:editor:newfile", function(event) {
    var project = event.memo.project || _editSession.project;
    var newfilename = event.memo.newfilename || "new.txt";

    _files.newFile(project, newfilename, function() {
        document.fire("bespin:editor:openfile:opensuccess", { file: {
            name: newfilename,
            content: " ",
            timestamp: new Date().getTime()
        }});
    });
});

document.observe("bespin:editor:openfile", function(event) {
    var filename = event.memo.filename;

    if (_editSession.path == filename) return; // short circuit

    document.fire("bespin:editor:openfile:openbefore", { filename: filename });

    _files.loadFile(_editSession.project, filename, function(file) {
        if (!file) {
            document.fire("bespin:editor:openfile:openfail", { filename: filename });
        } else {
            document.fire("bespin:editor:openfile:opensuccess", { file: file });
        }
    });
});


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

    document.fire("bespin:cmdline:showinfo", { msg: 'Saved file: ' + file.name });
});


// Shell Events: Header, Chrome, etc

document.observe("bespin:editor:openfile:opensuccess", function(event) {
    var file = event.memo.file;

    $('status').innerHTML = '<span id="project" title="Current project">' + _editSession.project + '</span> <span class="seperator" style="">&rsaquo;</span> <span id="filename" title="Current file">' + file.name + '</span>';

    document.fire("bespin:editor:titlechange", { filename: file.name });

    document.fire("bespin:editor:urlchange", { project: _editSession.project, path: file.name });
});

document.observe("bespin:editor:titlechange", function(event) {
    var title;
    if (event.memo.filename) title = event.memo.filename + ' - editing with Bespin';
    else if (event.memo.title) title = event.memo.title;
    else title = 'Bespin &raquo; Welcome to the Cloud City';

    document.title = title;
});

document.observe("bespin:editor:urlchange", function(event) {
    var project = event.memo.project;
    var path    = event.memo.path;

    document.location.hash = "project=" + project + "&path=" + path;
});

document.observe("bespin:cmdline:executed", function(event) {
    var commandname = event.memo.command.name;

    $('message').innerHTML = "last cmd: " + commandname; // set the status message area
});

/*
 * Events subsystem and helpers
 */
var Events = {
    // bespin:cmdline:execute;foo=bar,baz=aps
    // bespin:cmdline:execute
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