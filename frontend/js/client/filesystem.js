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
 
// = FileSystem =
//
// This abstracts the remote Web Service file system, and in the future
// local file systems too.
// 
// It ties into the {{{Server}}} object for remote access

if (typeof Bespin == "undefined") Bespin = {};

Bespin.FileSystem = Class.create({

    // ** {{{ FileSystem.newFile(project, path, callback) }}}
    //
    // Create a new file in the file system using:
    //
    // * {{{project}}} is the name of the project to create the file in
    // * {{{path}}} is the full path to save the file into
    // * {{{onSuccess}}} is a callback to fire if the file is created
    newFile: function(project, path, onSuccess) {
        this.whenFileDoesNotExist(project, path, {
            execute: function() {
                _editSession.startSession(project, path || "new.txt");
                onSuccess();
            },
            elseFailed: function() {
                document.fire("bespin:cmdline:showinfo", { msg: 'The file ' + path + ' already exists my friend.'});
            }
        });
    },

    // ** {{{ FileSystem.loadFile(project, path, callback) }}}
    //
    // Load the file in the given project and path and get going
    //
    // * {{{project}}} is the name of the project that houses the file
    // * {{{path}}} is the full path to load the file into
    // * {{{onSuccess}}} is a callback to fire if the file is loaded
    // * {{{dontStartSession}}} is a flag to turn off starting a session. Used in the config loading for example
    loadFile: function(project, path, onSuccess, dontStartSession) {
        if (!dontStartSession) _editSession.startSession(project, path);

        _server.loadFile(project, path, function(content) {
            if (content.endsWith("\n")) content = content.substr(0, content.length - 1);

            onSuccess({
                name: path,
                content: content,
                timestamp: new Date().getTime()
            });
        });
    },

    // ** {{{ FileSystem.projects(callback) }}}
    //
    // Return a JSON representation of the projects that the user has access too
    //
    // * {{{callback}}} is a callback that fires given the project list
    projects: function(callback) {
        _server.projects(callback);
    },

    // ** {{{ FileSystem.fileNames(callback) }}}
    //
    // Return a JSON representation of the files at the root of the given project
    //
    // * {{{callback}}} is a callback that fires given the files
    fileNames: function(project, callback) {
        _server.list(project, '', callback);
    },

    // ** {{{ FileSystem.saveFile(project, file) }}}
    //
    // Save a file to the given project
    //
    // * {{{project}}} is the name of the project to save into
    // * {{{file}}} is the file object that contains the path and content to save
    saveFile: function(project, file) {
        // Unix files should always have a trailing new-line; add if not present
        if (!file.content.endsWith("\n")) file.content += "\n";

        _server.saveFile(project, file.name, file.content, file.lastOp);
    },

    // ** {{{ FileSystem.removeFile(project, path, onSuccess, onFailure) }}}
    //
    // Remove the file from the file system
    //
    // * {{{project}}} is the name of the project to delete the file from
    // * {{{path}}} is the full path to the file to delete
    // * {{{onSuccess}}} is the callback to fire if the remove works
    // * {{{onFailure}}} is the callback to fire if the remove fails
    removeFile: function(project, path, onSuccess, onFailure) {
        _server.removeFile(project, path, onSuccess, onFailure);
    },

    // ** {{{ FileSystem.removeFile(project, path, onSuccess, onFailure) }}}
    //
    // Close the open session for the file
    //
    // * {{{project}}} is the name of the project to close the file from
    // * {{{path}}} is the full path to the file to close
    // * {{{callback}}} is the callback to fire when closed
    closeFile: function(project, path, callback) {
        _server.closeFile(project, path, callback);
    },

    // ** {{{ FileSystem.whenFileExists(project, path, callbacks) }}}
    //
    // Check to see if the file exists and then run the appropriate callback
    //
    // * {{{project}}} is the name of the project
    // * {{{path}}} is the full path to the file
    // * {{{callbacks}}} is the pair of callbacks:
    //   execute (file exists)
    //   elseFailed (file does not exist)
    whenFileExists: function(project, path, callbacks) {
        _server.list(project, Bespin.Path.directory(path), function(files) {
            if (files && files.map(function(file) { return file.name; }).include(path)) {
                callbacks['execute']();
            } else {
                if (callbacks['elseFailed']) callbacks['elseFailed']();
            }
        });
    },

    // ** {{{ FileSystem.whenFileDoesNotExist(project, path, callbacks) }}}
    //
    // The opposite of {{{ FileSystem.whenFileExists() }}}
    //
    // * {{{project}}} is the name of the project
    // * {{{path}}} is the full path to the file
    // * {{{callbacks}}} is the pair of callbacks:
    //   execute (file does not exist)
    //   elseFailed (file exists)
    whenFileDoesNotExist: function(project, path, callbacks) {
        _server.list(project, Bespin.Path.directory(path), function(files) {
            if (!files || !files.map(function(file) { return file.name; }).include(path)) {
                callbacks['execute']();
            } else {
                if (callbacks['elseFailed']) callbacks['elseFailed']();
            }
        });
    }
});
