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
dojo.provide("bespin.editor.component");

dojo.require("bespin.bespin");

dojo.require("bespin.util.canvas");
dojo.require("bespin.util.keys");
dojo.require("bespin.util.navigate");
dojo.require("bespin.util.path");
dojo.require("bespin.util.tokenobject");
dojo.require("bespin.util.util");
dojo.require("bespin.util.mousewheelevent");
dojo.require("bespin.util.urlbar");

dojo.require("bespin.client.filesystem");
dojo.require("bespin.client.settings");
dojo.require("bespin.client.status");
dojo.require("bespin.client.server");
dojo.require("bespin.client.session");

dojo.require("bespin.editor.actions");
dojo.require("bespin.editor.clipboard");
dojo.require("bespin.editor.cursor");
dojo.require("bespin.editor.editor");
dojo.require("bespin.editor.events");
dojo.require("bespin.editor.model");
dojo.require("bespin.editor.toolbar");
dojo.require("bespin.editor.themes");
dojo.require("bespin.editor.undo");

dojo.require("bespin.syntax.syntax");
dojo.require("bespin.syntax.javascript");
dojo.require("bespin.syntax.css");
dojo.require("bespin.syntax.html");
dojo.require("bespin.syntax.php");

dojo.require("bespin.cmd.commandline");
dojo.require("bespin.cmd.commands");
dojo.require("bespin.cmd.editorcommands");

dojo.require("th.helpers"); // -- Thunderhead... hooooo
dojo.require("th.css");
dojo.require("th.th");
dojo.require("th.models");
dojo.require("th.borders");
dojo.require("th.components");

dojo.declare("bespin.editor.Component", null, {
    constructor: function(container, opts) {
        opts.actsAsComponent = true;
        
        var initialcontent;
        if (opts.loadfromdiv) {
            initialcontent = dojo.byId(container).innerHTML
        }

        this.editor = bespin.register('editor', opts.editor || new bespin.editor.API(container, opts));
        this.editSession = bespin.register('editSession', opts.editSession || new bespin.client.session.EditSession(this.editor));
        this.server = bespin.register('server', opts.server || new bespin.client.Server());
        this.files = bespin.register('files', opts.files || new bespin.client.FileSystem());
        bespin.register('settings', opts.settings || new bespin.client.settings.Core(bespin.client.settings.InMemory));
        
        dojo.connect(window, 'resize', opts.resize || dojo.hitch(this, function() {
            this.editor.paint();
        }));

        if (opts.loadfromdiv && initialcontent) {
            this.setContent(initialcontent);
        }

        if (opts.syntax) { // -- turn on syntax highlighting
            bespin.publish("bespin:settings:syntax", { language: opts.syntax });
        }
        
        if (!opts.dontstealfocus) {
            this.editor.canvas.focus();
        }
    },
    
    getContent: function() {
        return this.editor.model.getDocument();
    },

    setContent: function(content) {
        return this.editor.model.insertDocument(content);
    },
    
    set: function(key, value) {
        bespin.publish("bespin:settings:set", {
           key: key,
           value: value 
        });
    }
});

