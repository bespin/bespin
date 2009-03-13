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

dojo.provide("bespin.bootstrap");

// = Bootstrap =
//
// This file is the editor bootstrap code that is loaded via script src
// from /editor.html.
//
// It handles setting up the objects that are to be used on the editor
// and deals with layout changes.

// ** {{{ Globals }}}
//
// One day we will get rid of all of these bar the core bespin object.

// pieces in the scene
var _projectLabel;
var _fileLabel;
var _scene;

dojo.mixin(bespin.bootstrap, {
    // ** {{{ whenLoggedIn(userinfo) }}} **
    //
    // * {{{userinfo}}} is an object containing user specific info (project etc)
    //
    // Save the users magic project into the session
    whenLoggedIn: function(userinfo) {
        bespin.get('editSession').setUserinfo(userinfo);

        bespin.register('settings', new bespin.client.settings.Core());
        bespin.register('commandLine', new bespin.cmd.commandline.Interface('command', bespin.cmd.editorcommands.Commands));
    },

    // ** {{{ whenNotLoggedIn() }}} **
    //
    // Send the user back to the front page as they aren't logged in.
    // The server should stop this from happening, but JUST in case.
    whenNotLoggedIn: function() {
        bespin.util.navigate.home(); // go back
    },

    // ** {{{ recalcLayout() }}} **
    //
    // When a change to the UI is needed due to opening or closing a feature
    // (e.g. file view, session view) move the items around
    recalcLayout: function() {
        var subheader = dojo.byId("subheader");
        var footer = dojo.byId("footer");
        var editor = dojo.byId("editor");
        var files = dojo.byId("files");
        var collab = dojo.byId("collab");
        var target = dojo.byId("target_browsers");

        var move = [ subheader, footer, editor ];

        if (bespin.get('toolbar').showFiles) {
            files.style.display = "block";
            dojo.forEach(move, function(item) { item.style.left = "201px"; });
        } else {
            files.style.display = "none";
            dojo.forEach(move, function(item) { item.style.left = "0"; });
        }

        move.pop();   // editor shouldn't have its right-hand side set

        if (bespin.get('toolbar').showCollab) {
            collab.style.display = "block";
            dojo.forEach(move, function(item) { item.style.right = "201px"; });
        } else {
            collab.style.display = "none";
            dojo.forEach(move, function(item) { item.style.right = "0"; });
        }

        if (bespin.get('toolbar').showTarget) {
            target.style.display = "block";
        } else {
            target.style.display = "none";
        }

        this.doResize();
    },

    showFilelist: function() {
        var filelist =  dojo.byId('filelist');
        var editor = dojo.byId("editor");
        
        if (bespin.get('toolbar').showFiles) {                
            filelist.style.display = "block";
            editor.style.left = bespin.get('filelist').getWidth()+'px';
        } else {
            filelist.style.display = "none";
            editor.style.left = "0px";
        }
        
        this.doResize();
    },

    // ** {{{ doResize() }}} **
    //
    // When a user resizes the window, deal with resizing the canvas and repaint
    doResize: function() {
        var d = dojo.coords('status');
        
        if (bespin.get('toolbar').showFiles) {
            filelist = bespin.get('filelist');
            filelist.fitAndRepaint();
            editor.style.left = filelist.getWidth()+'px';
        }
        
        dojo.attr('projectLabel', { width: d.w, height: d.h });

        bespin.get('editor').paint();        
        _scene.render();
    }
})

// ** {{{ window.load time }}} **
//
// Loads and configures the objects that the editor needs
dojo.addOnLoad(function() {
    bespin.register('quickopen', new bespin.editor.quickopen.API('quickopen'));

    var editor = bespin.register('editor', new bespin.editor.API('editor'));
    var editSession = bespin.register('editSession', new bespin.client.session.EditSession(editor));
    var server = bespin.register('server', new bespin.client.Server());
    var files = bespin.register('files', new bespin.client.FileSystem());
    var filelist = bespin.register('filelist', new bespin.editor.filelist.UI('filelist'));

    bespin.register('toolbar', new bespin.editor.Toolbar(editor, { setupDefault: true }));

    // Force a login just in case the user session isn't around
    server.currentuser(bespin.bootstrap.whenLoggedIn, bespin.bootstrap.whenNotLoggedIn);

    // Set the version info
    bespin.displayVersion();

    // Get going when settings are loaded
    bespin.subscribe("bespin:settings:loaded", function(event) {
        bespin.get('settings').loadSession();  // load the last file or what is passed in
        bespin.bootstrap.doResize();
    });

    dojo.connect(window, 'resize', bespin.bootstrap, "doResize");

    _scene = new th.Scene(dojo.byId("projectLabel"));

    var panel = new th.components.Panel();
    _scene.root.add(panel);

    _projectLabel = new th.components.Label({ style: {
        color: "white",
        font: "12pt Calibri, Arial, sans-serif"
    }});
    var symbolThingie = new th.components.Label({ text: ":", style: {
        color: "gray",
        font: "12pt Calibri, Arial, sans-serif"
    }});
    _fileLabel = new th.components.Label({ style: {
        color: "white",
        font: "12pt Calibri, Arial, sans-serif"
    }});

    panel.add([ _projectLabel, symbolThingie, _fileLabel ]);
    panel.layout = function() {
        var d = this.d();

        var x = 0;
        for (var i = 0; i < 2; i++) {
            var width = this.children[i].getPreferredWidth(d.b.h);
            this.children[i].bounds = { x: x, y: 0, width: width, height: d.b.h };
            x += width;
        }

        this.children[2].bounds = { x: x, y: 0, width: d.b.w - d.i.w - x, height: d.b.h };
    };

    _scene.render();
});
