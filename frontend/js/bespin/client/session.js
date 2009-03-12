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

// = Session =
//
// This session module provides functionality that both stores session information
// and handle collaboration.
//
// This module includes:
//
// * {{{ bespin.client.session.EditSession }}}: Wraps a file edit session
// * {{{ bespin.client.session.SyncHelper }}}: Deals with syncing edits back to the server

dojo.provide("bespin.client.session");

// ** {{{ bespin.client.session.EditSession }}} **
//
// EditSession represents a file edit session with the Bespin back-end server. It is responsible for
// sending changes to the server as well as receiving changes from the server and mutating the document
// model with received changes.

dojo.declare("bespin.client.session.EditSession", null, {
    constructor: function(editor) {        
        this.editor = editor;
        this.collaborate = false;
    },

    setUserinfo: function(userinfo) {
        this.username = userinfo.username;
        this.amountUsed = userinfo.amountUsed;
        this.quota = userinfo.quota;
    },

    checkSameFile: function(project, path) {
        return ((this.project == project) && (this.path == path));
    },

    startSession: function(project, path, username) {
        this.project = project;
        this.path = path;
        if (!this.username) this.username = username;

        if (this.collaborate) this.syncHelper = new bespin.client.session.SyncHelper(this.editor);
    },

    stopSession: function() {
        this.project = undefined;
        this.path = undefined;

        if (this.collaborate) this.syncHelper.stop();
    }
});

// ** {{{ bespin.client.session.SyncHelper }}} **
//
// Sends data up to the server (edits), and retrieves updates back and applies them.
// The {{{ bespin.client.session.EditSession }}} starts and stops this process.

dojo.declare("bespin.client.session.SyncHelper", null, {
    constructor: function(editor) {
        this.SEND_INTERVAL = 1000;
        this.UPDATE_INTERVAL = 1000;

        this.editor = editor;
        this.editor.undoManager.syncHelper = this;

        this.server = bespin.get('server');
        this.editSession = bespin.get('editSession');
        
        this.opQueue = [];
        this.lastOp = 0;
        this.stopped = false;

        setTimeout(dojo.hitch(this, function() { this.processSendQueue(); }), this.SEND_INTERVAL );
    },

    retrieveUpdates: function() {
        // TODO: fix global references
        this.server.editAfterActions(this.editSession.project, this.editSession.path, this.lastOp, dojo.hitch(this, function(json) { 

            this.editor.undoManager.syncHelper = undefined; // TODO: document why I do this

            var ops = eval(json);
            this.lastOp += ops.length;

            dojo.forEach(ops, function(op) {
                if (op.username != this.editSession.username) { // don't play operations that have been performed by this user
                    this.playOp(op);
                    _showCollabHotCounter = 20;
                }
            });

            if (!_showCollab) {
                dojo.byId("collaboration").src = (_showCollabHotCounter > 0) ? "images/icn_collab_watching.png" : "images/icn_collab_off.png";
            }

            if (_showCollabHotCounter > 0) _showCollabHotCounter--;

            this.editor.undoManager.syncHelper = this;

            if (!this.stopped) setTimeout(dojo.hitch(this, function() { this.retrieveUpdates(); }), this.UPDATE_INTERVAL );
        }));
    },

    playOp: function(val) {
        var t, ds;
        if (val.redoOp) {
            val.redoOp.queued = undefined;

            this.editor.ui.actions[val.redoOp.action](val.redoOp);
        } else {
            this.editor.ui.actions[val.action](val);
        }
    },

    syncWithServer: function() {
        this.server.editActions(this.editSession.project, this.editSession.path, dojo.hitch(this, function(json) {
            if (json.length > 2) {
                this.editor.undoManager.syncHelper = undefined;

                var ops = eval(json);
                this.lastOp = ops.length;

                this.editor.ui.actions.ignoreRepaints = true;
                ops.each(function(val) {
                    this.playOp(val);
                });
                this.editor.ui.actions.ignoreRepaints = false;
                this.editor.ui.actions.repaint();

                this.editor.undoManager.syncHelper = this;
            }

            setTimeout(dojo.hitch(this, function() { this.retrieveUpdates(); }), this.UPDATE_INTERVAL);
        }));
    },

    stop: function() {
        this.stopped = true;
    },

    processSendQueue: function() {
        if (this.opQueue.length > 0) {
            var sendQueue = this.opQueue.splice(0, this.opQueue.length);
            this.server.doAction(this.editSession.project, this.editSession.path, sendQueue);
        }

        if (!this.stopped) setTimeout(dojo.hitch(this, function() { this.processSendQueue(); }), this.SEND_INTERVAL );
    },

    applyEditOperations: function(ops) {
        this.editor.ui.actions.ignoreRepaints = true;

        for (var i = 0; i < ops.length; i++) {
            var op = ops[i];

            // check if this is an editop or an undoop
            if (op.redoOp) {
                op.redo();
            } else {
                this.editor.ui.actions[this.op.action](this.op);
            }
        }

        this.editor.ui.actions.ignoreRepaints = false;
        this.editor.ui.actions.repaint();
    },

    undo: function(op) {
        this.opQueue.push(dojo.toJson({ username: this.editSession.username, action: 'undo' }));
    },

    redo: function(op) {
        this.opQueue.push(dojo.toJson({ username: this.editSession.username, action: 'redo' }));
    },

    queueUndoOp: function(undoOp) {
        var undoOpJson = {
            username: this.editSession.username,
            undoOp: undoOp.undoOp,
            redoOp: undoOp.redoOp
        };
        this.opQueue.push(dojo.toJson(undoOpJson));
    },

    queueSelect: function(selection) {
        this.opQueue.push(dojo.toJson({ username: this.editSession.username, action: "select", args: { startPos: (selection) ? selection.startPos : undefined, endPos: (selection) ? selection.endPos : undefined }}));
    }
});
