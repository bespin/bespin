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
     * Mobwrite has a set of shareObjs which are designed to wrap DOM nodes.
     * This creates a fake DOM node to be wrapped in a Mobwrite ShareObj.
     */
    createMobwriteShareNode: function(onFirstSync) {
        // Create an ID
        var username = this.username || "[none]";
        var project = this.project;
        var path = this.path;
        if (path.indexOf("/") != 0) {
            path = "/" + path;
        }
        var id;
        parts = project.split("+");
        if (parts.length == 1) {
            // This is our project
            id = username + "/" + project + path;
        }
        else {
            // This is someone else's projects
            id = parts[0] + "/" + parts[1] + path;
        }

        var self = this;
        return {
            id: id,
            isShareNode: true,
            reportCollaborators: function(userEntries) {
                self.reportCollaborators(userEntries);
            },
            getClientText: function() {
                return self.editor.model.getDocument();
            },
            /**
             * Notification used by mobwrite to announce an update.
             * Used by startSession to detect when it is safe to fire onSuccess
             */
            setClientText: function(text) {
                self.editor.model.insertDocument(text);

                // Nasty hack to allow the editor to know that something has changed.
                // In the first instance the use is restricted to calling the loaded
                // callback
                if (this.onFirstSync) {
                    this.onFirstSync();
                }
                this.onFirstSync = null;
            },
            onFirstSync: onFirstSync
        };
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

        if (!mobwrite) {
            if (dojo.isFunction(onFailure)) {
                onFailure({ responseText:"Mobwrite is missing" });
            }
            return;
        }

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

        this.shareNode = this.createMobwriteShareNode(onFirstSync);

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
     * Update the social bar to show the current collaborators.
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
     * Get a textual report on what we are working on
     * TODO: What happens when project == null. Should that ever happen?
     */
    getStatus: function() {
        var file = this.path || 'a new scratch file';
        return 'Hey ' + this.username + ', you are editing ' + file + ' in project ' + this.project;
    },

    /**
     * Set the current project.
     * TODO: I think we should probably get rid of anywhere this is called
     * because it implies being able to set the project separately from the
     * file being edited.
     * TODO: Plus, what's wrong with session.project = "foo"?
     */
    setProject: function(project) {
        this.project = project;
    }
});
