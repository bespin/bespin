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
     * Begin editing a given project/path hooking up using mobwrite if needed
     * TODO: There is a disconnect here because if we're not using mobwrite
     * then the text is loaded somewhere else. We should be symmetric.
     * Perhaps the problem is - is session just a wrapper for mobwrite or does
     * it contain the details of the currently edited file?
     */
    startSession: function(project, path, onSuccess, onFailure) {
        // Stop any existing mobwrite session
        this.stopSession();

        this.project = project;
        this.path = path;

        if (mobwrite) {
            this.currentState = this.mobwriteState.starting;
            mobwrite.share(this);

            // Wrap up the onSuccess to clear up after itself
            // TODO: Mobwrite could still fail to load and we would not call
            // onFailure, so we should hook into mobwrite somewhere and push
            // the notification to here. We will need to reset both callbacks
            // when either of them are called
            if (dojo.isFunction(onSuccess)) {
                this._onSuccess = function() {
                    onSuccess({
                        name: path,
                        timestamp: new Date().getTime()
                    });
                    this._onSuccess = null;
                    this.currentState = this.mobwriteState.running;
                };
            }
        } else {
            onFailure({ responseText:"Mobwrite is missing" });
        }
    },

    /**
     * Stop mobwrite working on a file and empty the currently edited document
     */
    stopSession: function() {
        // TODO: Something better if we're told to startup twice in a row
        if (this.currentState == this.mobwriteState.starting) {
            throw new Error("mobwrite is starting up");
        }

        if (this.currentState == this.mobwriteState.running) {
            if (mobwrite) {
                mobwrite.unshare(this);
            }
            // TODO: Should this be set asynchronously when unshare() completes?
            this.currentState = this.mobwriteState.stopped;
        }

        this.editor.model.insertDocument("");

        this.project = undefined;
        this.path = undefined;
    },

    /**
     * Update the social bar to show the current collaborators.
     * TODO: Remove me as a collaborator
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
    },

    /**
     * Notification used by mobwrite to announce an update.
     * Used by startSession to detect when it is safe to fire onSuccess
     */
    fireUpdate: function() {
        if (this._onSuccess) {
            this._onSuccess();
        }
    }
});
