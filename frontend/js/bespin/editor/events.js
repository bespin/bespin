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

dojo.require("bespin.util.util");

dojo.provide("bespin.editor.events");

// ** {{{ bespin.editor.Events }}} **
//
// Handle custom events aimed at, and for the editor
dojo.declare("bespin.editor.Events", null, {
    constructor: function(editor) {
        bespin.subscribe("editor:openfile:opensuccess", function(event) {
            // If collaboration is turned on, we won't know the file contents
            if (event.file.content) {
                editor.model.insertDocument(event.file.content);
                editor.cursorManager.moveCursor({ row: 0, col: 0 });
                editor.setFocus(true);
            }
        });

        // -- fire an event here and you can run any editor action
        bespin.subscribe("editor:doaction", function(event) {
            var action = event.action;
            var args   = event.args || bespin.editor.utils.buildArgs();

            if (action) editor.ui.actions[action](args);
        });

        // -- fire an event to setup any new or replace actions
        bespin.subscribe("editor:setaction", function(event) {
            var action = event.action;
            var code   = event.code;
            if (action && dojo.isFunction(code)) editor.ui.actions[action] = code;
        });

        // ** {{{ Event: editor:forceopenfile }}} **
        //
        // Open an existing file, or create a new one.
        bespin.subscribe("editor:forceopenfile", function(event) {
            var filename = event.filename;
            var project  = event.project;
            var content  = event.content || " ";
            var reload = event.reload;

            var editSession = bespin.get('editSession');

            if (editSession) {
                if (!project) project = editSession.project;
                if (!reload) {
                    if (editSession.checkSameFile(project, filename)) return; // short circuit
                } else {
                    if (!filename) filename = editSession.path;
                }
            }

            if (!project) return; // short circuit

            bespin.get('files').forceOpenFile(project, filename, content);
        });

        // ** {{{ Event: editor:savefile }}} **
        //
        // Observe a request for a file to be saved and start the cycle:
        //
        // * Send event that you are about to save the file (savebefore)
        // * Get the last operation from the sync helper if it is up and running
        // * Ask the file system to save the file
        // * Change the page title to have the new filename
        // * Tell the command line to show the fact that the file is saved
        bespin.subscribe("editor:savefile", function(event) {
            var project = event.project || bespin.get('editSession').project;
            var filename = event.filename || bespin.get('editSession').path; // default to what you have

            bespin.publish("editor:savefile:before", { filename: filename });

            // saves the current state of the editor to a cookie
            dojo.cookie('viewData_' + project + '_' + filename.split('/').join('_'), dojo.toJson(bespin.get('editor').getCurrentView()), { expires: 7 });

            var file = {
                name: filename,
                content: editor.model.getDocument(),
                timestamp: new Date().getTime()
            };

            if (editor.undoManager.syncHelper) { // only if ops are on
                file.lastOp = editor.undoManager.syncHelper.lastOp;
            }

            var commandLine = bespin.get("commandLine");

            var onSuccess = function() {
                document.title = filename + ' - editing with Bespin';

                if (commandLine) commandLine.showHint('Saved file: ' + file.name);

                bespin.publish("editor:clean");

                if (dojo.isFunction(event.onSuccess)) {
                    event.onSuccess();
                }
            };

            var onFailure = function(xhr) {
                if (commandLine) commandLine.showHint('Save failed: ' + xhr.responseText);

                if (dojo.isFunction(event.onFailure)) {
                    event.onFailure();
                }
            };

            bespin.get('files').saveFile(project, file, onSuccess, onFailure);
        });

        // ** {{{ Event: editor:moveandcenter }}} **
        //
        // Observe a request to move the editor to a given location and center it
        bespin.subscribe("editor:moveandcenter", function(event) {
            var row = event.row;

            if (!row) return; // short circuit

            var linenum = row - 1; // move it up a smidge

            editor.cursorManager.moveCursor({ row: linenum, col: 0 });

            // If the line that we are moving to is off screen, center it, else just move in place
            if ( (linenum < editor.ui.firstVisibleRow) || (linenum >= editor.ui.firstVisibleRow + editor.ui.visibleRows) ) {
                bespin.publish("editor:doaction", {
                    action: 'moveCursorRowToCenter'
                });
            }
        });

        // == Shell Events: Header, Chrome, etc ==
        //
        // ** {{{ Event: editor:openfile:opensuccess }}} **
        //
        // When a file is opened successfully change the project and file status area.
        // Then change the window title, and change the URL hash area
        bespin.subscribe("editor:openfile:opensuccess", function(event) {
            var project = event.project || bespin.get('editSession').project;
            var filename = event.file.name;

            try {
                // reset the state of the editor based on saved cookie
                var data = dojo.cookie('viewData_' + project + '_' + filename.split('/').join('_'));
                if (data) {
                    bespin.get('editor').resetView(dojo.fromJson(data));
                } else {
                    bespin.get('editor').basicView();
                }
            } catch (e) {
                console.log("Error setting in the view: ", e);
            }

            document.title = filename + ' - editing with Bespin';

            bespin.publish("url:change", { project: project, path: filename });
        });

        // ** {{{ Event: editor:urlchange }}} **
        //
        // Observe a urlchange event and then... change the location hash
        bespin.subscribe("url:change", function(event) {
            var hashArguments = dojo.queryToObject(location.hash.substring(1));
            hashArguments.project = event.project;
            hashArguments.path    = event.path;

            // window.location.hash = dojo.objectToQuery() is not doing the right thing...
            var pairs = [];
            for (var name in hashArguments) {
                var value = hashArguments[name];
                pairs.push(name + '=' + value);
            }
            window.location.hash = pairs.join("&");
        });

        // ** {{{ Event: url:changed }}} **
        //
        // Observe a request for session status
        // This should kick in when the user uses the back button, otherwise
        // editor:openfile will check and see that the current file is the same
        // as the file from the urlbar
        bespin.subscribe("url:changed", function(event) {
            editor.openFile(null, event.now.get('path'));
        });

        // ** {{{ Event: cmdline:focus }}} **
        //
        // If the command line is in focus, unset focus from the editor
        bespin.subscribe("cmdline:focus", function(event) {
            editor.setFocus(false);
        });

        // ** {{{ Event: cmdline:blur }}} **
        //
        // If the command line is blurred, take control in the editor
        bespin.subscribe("cmdline:blur", function(event) {
            editor.setFocus(true);
        });

        // ** {{{ Event: editor:document:changed }}} **
        //
        // Track whether a file is dirty (hasn't been saved)
        bespin.subscribe("editor:document:changed", function(event) {
            bespin.publish("editor:dirty");
        });

        bespin.subscribe("editor:dirty", function(event) {
            editor.dirty = true;
        });

        bespin.subscribe("editor:clean", function(event) {
            editor.dirty = false;
        });

    }
});