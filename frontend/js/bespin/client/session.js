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
    },

    setUserinfo: function(userinfo) {
        this.username = userinfo.username;
        this.amountUsed = userinfo.amountUsed;
        this.quota = userinfo.quota;
    },

    checkSameFile: function(project, path) {
        return ((this.project == project) && (this.path == path));
    },

    startSession: function(project, path, onSuccess) {
        this.project = project;
        this.path = path;

        if (typeof mobwrite !== "undefined") mobwrite.share(this); // was causing an error!

        if (dojo.isFunction(onSuccess)) onSuccess({
            name: path,
            timestamp: new Date().getTime()
        });
    },

    reportCollaborators: function(usernames) {
        var contents = "";
        dojo.forEach(usernames, function(username) {
            contents += "<div class='collab_person'>";
            contents += "  <div class='collab_icon'></div>";
            contents += "  <div class='collab_name'>" + username + "</div>";
            contents += "  <div class='collab_description'>Editing</div>";
            contents += "</div>";
        });
        dojo.byId("collab_list").innerHTML = contents;
    },

    stopSession: function() {
        this.project = undefined;
        this.path = undefined;
    },

    getStatus: function() {
        var file = this.path || 'a new scratch file';
        return 'Hey ' + this.username + ', you are editing ' + file + ' in project ' + this.project;
    },

    setProject: function(project) {
        this.project = project;
    }
});
