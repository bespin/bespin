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

/**
 * This session module provides functionality that both stores session
 * information and handle collaboration.
 */
dojo.provide("bespin.client.session");

/**
 * EditSession represents a file edit session with the Bespin back-end server.
 * It is responsible for sending changes to the server as well as receiving
 * changes from the server and mutating the document model with received
 * changes.
 */
dojo.declare("bespin.client.session.EditSession", null, {
    constructor: function(editor) {
        this.editor = editor;
        this.currentState = this.mobwriteState.stopped;

        this.fileHistory = [];
        this.fileHistoryIndex = -1;

        // Take note of in-flight collaboration status changes
        var self = this;
        bespin.fireAfter([ "settings:loaded" ], function() {
            bespin.subscribe("settings:set:collaborate", function(ev) {
                if (bespin.get("settings").isOn(ev.value) && !self.bailingOutOfCollaboration) {
                    if (editor.dirty) {
                        var msg = "Collaboration enabled on edited file.\n" +
                                "To avoid losing changes, save before collaborating.\n" +
                                "Save now?";
                        var reply = confirm(msg);
                        if (reply) {
                            // User OKed the save
                            bespin.publish("editor:savefile", {
                                project: self.project,
                                filename: self.path,
                                onSuccess: function() {
                                    self.startSession(self.project, self.path);
                                }
                            });
                        } else {
                            // Not OK to save, bail out of collaboration
                            self.bailingOutOfCollaboration = true;
                            bespin.get("settings").set("collaborate", "off");
                            delete self.bailingOutOfCollaboration;

                            // We have reset the collaborate setting, but the
                            // output has not yet hit the screen, so we hack the
                            // message somewhat, and show a hint later when the
                            // display has happened. Yuck.
                            var commandLine = bespin.get("commandLine");
                            commandLine.addOutput("Reverting the following collaboration setting:");

                            setTimeout(function() {
                                commandLine.showHint("Collaborate is off");
                            }, 10);
                        }
                    } else {
                        self.startSession(self.project, self.path);
                    }
                } else {
                    self.stopSession();
                }
            });
        });
    },

    /**
     * Opens the previous file within the fileHistoryList related to the
     * current opened file / current position within the fileHistoryList
     * The real opening of the file is done within openFromHistory()
     */
    goToPreviousFile: function() {
        if (this.fileHistoryIndex != 0) {
            this.fileHistoryIndex --;
            this.openFromHistory();
        }
    },

    /**
     * Opens the next file within the fileHistoryList related to the current
     * opened file / current position within the fileHistoryList
     * The real opening of the file is done within openFromHistory()
     */
    goToNextFile: function() {
        if (this.fileHistoryIndex != this.fileHistory.length - 1) {
            this.fileHistoryIndex ++;
            this.openFromHistory();
        }
    },

    /**
     * Opens a file from the fileHistoryList.
     * The file to be opened is set by the variable this.fileHistoryIndex,
     * which is the index for the this.fileHistory array
     */
    openFromHistory: function() {
        var historyItem = this.fileHistory[this.fileHistoryIndex];

        bespin.publish("editor:savefile", {});
        this.editor.openFile(historyItem.project, historyItem.filename, { fromFileHistory: true });
    },

    /**
     * Adds a new file to the fileHistoryList
     * There are two possible cases:<ul>
     * <li>a) the current opened file is the last one in the fileHistoryList.
     *        If so, just add the file to the end
     * <li>b) the current opened file is *not* at the end of the fileHistoryList.
     *        In this case, we will have to delete the files after the current
     *        one in the list and add then the new one
     * </ul>
     */
    addFileToHistory: function(newItem) {
        this.fileHistoryIndex++;
        var end = this.fileHistory.length - this.fileHistoryIndex;
        this.fileHistory.splice(this.fileHistoryIndex, end, newItem);
    },

    /**
     * Allow us to detect what is going on with mobwrite
     */
    mobwriteState: {
        stopped: 0,
        starting: 1,
        running: 2
    },

    /**
     * Set on login from editor/init.js
     * TODO: Is this is best place for this information?
     */
    setUserinfo: function(userinfo) {
        this.username = userinfo.username;
        this.amountUsed = userinfo.amountUsed;
        this.quota = userinfo.quota;
    },

    /**
     * Is the passed project/path what we are currently working on?
     */
    checkSameFile: function(project, path) {
        return ((this.project == project) && (this.path == path));
    },

    /**
     * Set the current project.
     * TODO: I think we should probably get rid of anywhere this is called
     * because it implies being able to set the project separately from the
     * file being edited.
     */
    setProject: function(project) {
        this.project = project;
    },

    /**
     * Set the current project and path.
     * This method should be used in preference to editSession.setProject(x) or
     * simply editSession.project = x;
     */
    setProjectPath: function(project, path) {
        this.project = project;
        this.parh = path;
    },

    /**
     * Begin editing a given project/path hooking up using mobwrite if needed
     * TODO: There is a disconnect here because if we're not using mobwrite
     * then the text is loaded somewhere else. We should be symmetric.
     * Perhaps the problem is - is session just a wrapper for mobwrite or does
     * it contain the details of the currently edited file?
     */
    startSession: function(project, path, onSuccess, onFailure) {
        if (this.currentState == this.mobwriteState.starting) {
            console.warn("Asked to start in the middle of starting. this.shareNode=", this.shareNode);
            return;
        }

        // Stop any existing mobwrite session
        if (this.shareNode) {
            this.stopSession();
        }

        // Remove the current document so we can see that the sync is happening
        this.editor.model.insertDocument("");

        if (project !== undefined) this.project = project;
        if (path !== undefined) this.path = path;

        this.currentState = this.mobwriteState.starting;

        // Wrap up the onSuccess to clear up after itself
        // TODO: Mobwrite could still fail to load and we would not call
        // onFailure, so we should hook into mobwrite somewhere and push
        // the notification to here. We will need to reset both callbacks
        // when either of them are called
        var self = this;
        var onFirstSync = function() {
            if (dojo.isFunction(onSuccess)) {
                onSuccess({
                    name: self.path,
                    timestamp: new Date().getTime()
                });
            }

            // Voodoo needed to make the editor redraw.
            // TODO: There must be a better way
            self.editor.cursorManager.moveCursor({ row: 0, col: 0 });

            self.currentState = self.mobwriteState.running;
            dojo.attr("toolbar_collaboration", "src", "images/icn_collab_on.png");
        };

        this.shareNode = new bespin.client.session.ShareNode(this, onFirstSync);
        mobwrite.share(this.shareNode);
    },

    /**
     * Stop mobwrite working on a file.
     * <p>This leaves the editor state and mobwrite in whatever state they
     * were in after a final sync.
     */
    stopSession: function() {
        // TODO: Something better if we're told to stop while starting?
        if (this.currentState == this.mobwriteState.starting) {
            console.error("Asked to stop in the middle of starting. I can't let you do that Dave.");
            return;
        }

        dojo.attr("toolbar_collaboration", "src", "images/icn_collab_off.png");

        if (this.currentState == this.mobwriteState.running) {
            if (mobwrite) {
                mobwrite.unshare(this.shareNode);
            }

            // TODO: Should this be set asynchronously when unshare() completes?
            this.currentState = this.mobwriteState.stopped;
            this.shareNode = null;
        }
    },

    /**
     * Get a textual report on what we are working on
     * TODO: What happens when project == null. Should that ever happen?
     */
    getStatus: function() {
        var file = this.path || 'a new scratch file';
        return 'Hey ' + this.username + ', you are editing ' + file + ' in project ' + this.project;
    }
});

/**
 * Mobwrite has a set of shareObjs which are designed to wrap DOM nodes.
 * This creates a fake DOM node to be wrapped in a Mobwrite ShareObj.
 * @param onFirstSync a function to call when the first sync has happened
 * This allows us to support onSuccess. onFirstSync should NOT be null or
 * some of the logic below might break.
 */
dojo.declare("bespin.client.session.ShareNode", null, {
    constructor: function(session, onFirstSync) {
        this.session = session;
        this.editor = session.editor;
        this.onFirstSync = onFirstSync;
        this.username = session.username || "[none]";

        // Create an ID
        var project = session.project;
        var path = session.path;
        if (path.indexOf("/") != 0) {
            path = "/" + path;
        }
        parts = project.split("+");
        if (parts.length == 1) {
            // This is our project
            this.id = this.username + "/" + project + path;
        }
        else {
            // This is someone else's projects
            this.id = parts[0] + "/" + parts[1] + path;
        }
    },

    /**
     * When mobwrite/integrate.js/shareObj is assigned to us it lets us know
     * so that we can share the dmp object.
     */
    setShareObj: function(shareObj) {
        this.shareObj = shareObj;
    },

    /**
     * A way for integrate.js to recognize us
     */
    isShareNode: true,

    /**
     * Update the social bar to show the current collaborators.
     * Called by mobwrite/core.js to update the display of collaborators
     */
    reportCollaborators: function(userEntries) {
        var collabList = dojo.byId("collab_list");
        var self = this;

        dojo.empty(collabList);
        dojo.forEach(userEntries, function(userEntry) {
            var parts = userEntry.split(":");
            var username = parts[0];
            var address = parts[1];
            var id = parts[2];
            parent = dojo.create("div", { className:'collab_person' }, collabList);

            dojo.create("div", { className:'collab_icon' }, parent);
            var extra = (self.username == username) ? " <small>(You)</small>" : "";
            dojo.create("div", {
                className: 'collab_name',
                innerHTML: username + extra
            }, parent);

            extra = (mobwrite.syncUsername == id) ? "This window" : address;
            dojo.create("div", {
                className: 'collab_description',
                innerHTML: extra
            }, parent);
        });
    },

    /**
     * What is the contents of the editor?
     */
    getClientText: function(allowUnsynced) {
        if (!allowUnsynced && this.onFirstSync) {
            console.trace();
            throw new Error("Attempt to getClientText() before onFirstSync() called.");
        }
        return this.editor.model.getDocument();
    },

    /**
     * Called by mobwrite when it (correctly) assumes that we start blank and
     * that there are therefore no changes to make, however we need call
     * things like onSuccess.
     */
    syncWithoutChange: function() {
        this.checkFirstSyncDone();
    },

    /**
     * Notification used by mobwrite to announce an update.
     * Used by startSession to detect when it is safe to fire onSuccess
     */
    setClientText: function(text) {
        //var cursor = this.captureCursor();
        this.editor.model.insertDocument(text);
        //this.restoreCursor(cursor);

        this.checkFirstSyncDone();
    },

    /**
     * Called by mobwrite to apply patches
     */
    patchClientText: function(patches) {
        // Set some constants which tweak the matching behavior.
        // Tweak the relative importance (0.0 = accuracy, 1.0 = proximity)
        this.shareObj.dmp.Match_Balance = 0.5;
        // At what point is no match declared (0.0 = perfection, 1.0 = very loose)
        this.shareObj.dmp.Match_Threshold = 0.6;

        var oldClientText = this.getClientText(true);
        var result = this.shareObj.dmp.patch_apply(patches, oldClientText);
        // Set the new text only if there is a change to be made.
        if (oldClientText != result[0]) {
            // setClientText looks after restoring the cursor position
            this.setClientText(result[0]);
        } else {
            this.checkFirstSyncDone();
        }

        for (var x = 0; x < result[1].length; x++) {
            if (result[1][x]) {
                console.info('Patch OK.');
            } else {
                console.warn('Patch failed: ' + patches[x]);
            }
        }
    },

    /**
     * Nasty hack to allow the editor to know that something has changed.
     * In the first instance the use is restricted to calling the loaded
     * callback
     */
    checkFirstSyncDone: function() {
        if (this.onFirstSync) {
            this.onFirstSync();
            delete this.onFirstSync;
        }
    },

    /**
     * Record information regarding the current cursor.
     * @return {Object?} Context information of the cursor.
     * @private
     */
    captureCursor: function() {
        var ui = this.editor.ui;
        var padLength = this.shareObj.dmp.Match_MaxBits / 2;    // Normally 16.
        var text = this.editor.model.getDocument();

        var selection = this.editor.getSelection();
        var cursor = this.editor.getCursorPos();

        var start = selection ? selection.startPos : cursor;
        var selectionStart = this.convertRowColToOffset(start);

// TODO: These just check that we've log the logic right
// We should have some unit tests and delete these
var test = this.convertOffsetToRowCol(selectionStart);
if (test.row != start.row || test.col != start.col) {
    console.error("start", start, "test", test, "selectionStart", selectionStart);
}

        var end = selection ? selection.endPos : cursor;
        var selectionEnd = this.convertRowColToOffset(end);

var test = this.convertOffsetToRowCol(selectionEnd);
if (test.row != end.row || test.col != end.col) {
    console.error("end", end, "test", test, "selectionEnd", selectionEnd);
}

        var cursor = {
            startPrefix: text.substring(selectionStart - padLength, selectionStart),
            startSuffix: text.substring(selectionStart, selectionStart + padLength),
            startPercent: text.length == 0 ? 0 : selectionStart / text.length,
            collapsed: (selectionStart == selectionEnd),

            // HTMLElement.scrollTop = editor.ui.yoffset
            // HTMLElement.scrollHeight = editor.ui.yscrollbar.extent
            // cursor.scroll[Top|Left] are decimals from 0 - 1
            scrollTop: ui.yoffset / ui.yscrollbar.extent,

            // HTMLElement.scrollLeft = editor.ui.xoffset
            // HTMLElement.scrollWidth = editor.ui.xscrollbar.extent
            scrollLeft: ui.xoffset / ui.xscrollbar.extent
        };

        if (!cursor.collapsed) {
            cursor.endPrefix = text.substring(selectionEnd - padLength, selectionEnd);
            cursor.endSuffix = text.substring(selectionEnd, selectionEnd + padLength);
            cursor.endPercent = selectionEnd / text.length;
        }

        console.log("captureCursor", cursor);
        return cursor;
    },

    /**
     * Attempt to restore the cursor's location.
     * @param {Object} cursor Context information of the cursor.
     * @private
     */
    restoreCursor: function(cursor) {
        // TODO: There are 2 ways to optimize this if we need to.
        // The first is to do simple checks like checking the current line is
        // the same before and after insert, and then skipping the whole thing
        // (We perhaps need to do something to avoid duplicate matches like
        // ignoring blank lines or matching 3 lines or similar)
        // OR we could make the restore use row/col positioning rather than
        // offset from start. The latter could be lots of work

        var dmp = this.shareObj.dmp;
        // Set some constants which tweak the matching behavior.
        // Tweak the relative importance (0.0 = accuracy, 1.0 = proximity)
        dmp.Match_Balance = 0.4;
        // At what point is no match declared (0.0 = perfection, 1.0 = very loose)
        dmp.Match_Threshold = 0.9;

        var padLength = dmp.Match_MaxBits / 2; // Normally 16.
        var newText = this.editor.model.getDocument();

        // Find the start of the selection in the new text.
        var pattern1 = cursor.startPrefix + cursor.startSuffix;

        var cursorStartPoint = cursor.startPercent * newText.length - padLength;
        cursorStartPoint = Math.min(newText.length, cursorStartPoint);
        cursorStartPoint = Math.round(Math.max(0, cursorStartPoint));
        cursorStartPoint = dmp.match_main(newText, pattern1, cursorStartPoint);

        if (cursorStartPoint !== null) {
            var pattern2 = newText.substring(cursorStartPoint, cursorStartPoint + pattern1.length);
            //alert(pattern1 + '\nvs\n' + pattern2);
            // Run a diff to get a framework of equivalent indices.
            var diff = dmp.diff_main(pattern1, pattern2, false);
            cursorStartPoint += dmp.diff_xIndex(diff, cursor.startPrefix.length);
        }

        var cursorEndPoint = null;
        if (!cursor.collapsed) {
            // Find the end of the selection in the new text.
            pattern1 = cursor.endPrefix + cursor.endSuffix;

            cursorEndPoint = cursor.endPercent * newText.length - padLength;
            cursorEndPoint = Math.min(newText.length, cursorEndPoint);
            cursorEndPoint = Math.round(Math.max(0, cursorEndPoint));
            cursorEndPoint = dmp.match_main(newText, pattern1, cursorEndPoint);

            if (cursorEndPoint !== null) {
                var pattern2 = newText.substring(cursorEndPoint, cursorEndPoint + pattern1.length);
                //alert(pattern1 + '\nvs\n' + pattern2);
                // Run a diff to get a framework of equivalent indices.
                var diff = dmp.diff_main(pattern1, pattern2, false);
                cursorEndPoint += dmp.diff_xIndex(diff, cursor.endPrefix.length);
            }
        }

        // Deal with loose ends
        if (cursorStartPoint === null && cursorEndPoint !== null) {
            // Lost the start point of the selection, but we have the end point.
            // Collapse to end point.
            cursorStartPoint = cursorEndPoint;
        } else if (cursorStartPoint === null && cursorEndPoint === null) {
            // Lost both start and end points.
            // Jump to the approximate percentage point of start.
            cursorStartPoint = Math.round(cursor.startPercent * newText.length);
        }
        if (cursorEndPoint == null) {
            // End not known, collapse to start.
            cursorEndPoint = cursorStartPoint;
        }

        // Cursor position
        var startPos = this.convertOffsetToRowCol(cursorStartPoint);
        this.editor.moveCursor(startPos);

        // Selection: null means no selection
        var selectionPos = null;
        if (cursorEndPoint != cursorStartPoint) {
            selectionPos = {
                startPos: startPos,
                endPos: this.convertOffsetToRowCol(cursorEndPoint)
            };
        }
        this.editor.setSelection(selectionPos);

        // Scroll bars
        var ui = this.editor.ui;
        ui.yscrollbar.setValue(-(cursor.scrollTop * ui.yscrollbar.extent));
        ui.xscrollbar.setValue(-(cursor.scrollLeft * ui.xscrollbar.extent));
    },

    /**
     * Convert a row/col cursor position into an offset from file start
     */
    convertRowColToOffset: function(pos) {
        var offset = 0;
        var rows = this.editor.model.rows;
        for (var i = 0; i < pos.row; i++) {
            offset += rows[i].length + 1; // +1 for LF
        }
        offset += pos.col;
        return offset;
    },

    /**
     * Convert an offset from file start into a row/col cursor position
     */
    convertOffsetToRowCol: function(offset) {
        var pos = { row: 0, col: 0 };
        var rows = this.editor.model.rows;
        while (true) {
            var len = rows[pos.row].length;
            if (offset <= len) {
                pos.col = offset;
                break;
            }

            offset -= len + 1;
            pos.row += 1;

            if (pos.row >= rows.length) {
                console.warn("convertOffsetToRowCol(", offset, ") has run out of editor characters.");
                pos.row -= 1;
                pos.col = rows[pos.row].length;
                break;
            }
        }
        return pos;
    }
});
