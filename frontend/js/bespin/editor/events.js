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
            var content = event.file.content || "";
            editor.model.insertDocument(content);
            editor.cursorManager.moveCursor({ row: 0, col: 0 });
            editor.setFocus(true);
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

        // ** {{{ Event: editor:openfile }}} **
        //
        // Observe a request for a file to be opened and start the cycle:
        //
        // * Send event that you are opening up something (openbefore)
        // * Ask the file system to load a file (collaborateOnFile)
        // * If the file is loaded send an opensuccess event
        // * If the file fails to load, send an openfail event
        bespin.subscribe("editor:openfile", function(event) {
            var filename = event.filename;
            var editSession = bespin.get('editSession');
            var files = bespin.get('files');

            var project  = event.project || editSession.project;

            if (!(event.reload) && editSession.checkSameFile(project, filename)) {
                if (event.line) {
                    // Jump to the desired line.
                    bespin.get('commandLine').executeCommand('goto ' + event.line, true);
                }
                return; // short circuit
            }

            // if we're changing projects, make sure the new one is set
            if (project != editSession.project) {
                editSession.project = project;
            }

            bespin.publish("editor:openfile:openbefore", { project: project, filename: filename });

            files.collaborateOnFile(project, filename, function(file) {
                if (!file) {
                    bespin.publish("editor:openfile:openfail", { project: project, filename: filename });
                } else {
                    bespin.publish("editor:openfile:opensuccess", { project: project, file: file });
                    if (event.line) {
                        // Jump to the desired line.
                        bespin.get('commandline').executeCommand('goto ' + event.line, true);
                    }

                    var settings = bespin.get("settings");

                    // Get the array of lastused files
                    var lastUsed = settings.getObject("_lastused");
                    if (!lastUsed) {
                        lastUsed = [];
                    }

                    // We want to add this to the top
                    var newItem = {
                        project:project,
                        filename:filename
                    };

                    // Remove newItem from down in the list and place at top
                    var cleanLastUsed = [];
                    dojo.forEach(lastUsed, function(item) {
                        if (item.project != newItem.project || item.filename != newItem.filename) {
                            cleanLastUsed.unshift(item);
                        }
                    });
                    cleanLastUsed.unshift(newItem);
                    lastUsed = cleanLastUsed;

                    // Trim to 10 members
                    if (lastUsed.length > 10) {
                        lastUsed = lastUsed.slice(0, 10);
                    }

                    // Maybe this should have a _ prefix: but then it does not persist??
                    settings.setObject("_lastused", lastUsed);
                }
            });
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

        // ** {{{ Event: editor:reload }}} **
        //
        // Reload the current file from the server.
        bespin.subscribe("editor:reload", function(event) {
            var editSession = bespin.get('editSession');

            bespin.publish("editor:openfile", {
                reload: true,
                project: editSession.project,
                filename: editSession.path
            });
        });

        // ** {{{ Event: editor:newfile }}} **
        //
        // Observe a request for a new file to be created
        bespin.subscribe("editor:newfile", function(event) {
            var project = event.project || bespin.get('editSession').project;
            var newfilename = event.newfilename || "new.txt";
            var content = event.content || " ";

            bespin.get('files').newFile(project, newfilename, function() {
                bespin.publish("editor:openfile:opensuccess", { file: {
                    name: newfilename,
                    content: content,
                    timestamp: new Date().getTime()
                }});

                bespin.publish("editor:dirty");
            });
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
        //
        // TODO: Need to actually check saved status and know if the save worked
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

            bespin.get('files').saveFile(project, file); // it will save asynchronously.
            // TODO: Here we need to add in closure to detect errors and thus fire different success / error

            document.title = filename + ' - editing with Bespin';

            bespin.get("commandLine").showHint('Saved file: ' + file.name);

            bespin.publish("editor:clean");
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
            bespin.publish("editor:openfile", { filename: event.now.get('path') });
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

        // ** {{{ Event: escape }}} **
        //
        // escape key hit, so clear the find
        bespin.subscribe("ui:escape", function(event) {
            if (editor.ui.searchString) {
                editor.ui.setSearchString(false);
                // commented out because this bit of UI does not exist right now
                // dojo.byId('searchresult').style.display = 'none';
            }
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