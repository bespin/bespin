//  ***** BEGIN LICENSE BLOCK *****
// Version: MPL 1.1
// 
// The contents of this file are subject to the Mozilla Public License  
// Version
// 1.1 (the "License"); you may not use this file except in compliance  
// with
// the License. You may obtain a copy of the License at
// http://www.mozilla.org/MPL/
// 
// Software distributed under the License is distributed on an "AS IS"  
// basis,
// WITHOUT WARRANTY OF ANY KIND, either express or implied. See the  
// License
// for the specific language governing rights and limitations under the
// License.
// 
// The Original Code is Bespin.
// 
// The Initial Developer of the Original Code is Mozilla.
// Portions created by the Initial Developer are Copyright (C) 2009
// the Initial Developer. All Rights Reserved.
// 
// Contributor(s):
// 
// ***** END LICENSE BLOCK *****
// 

// - Global Constants
var _ = Bespin; // alias away!

// -- Globals
var _editor;
var _editSession;
var _commandLine;
var _files;
var _settings;
var _server;
var _toolbar;

var _showCollab = _showFiles = _showTarget = false; // for layout
var _showCollabHotCounter = 0;

Element.observe(window, 'load', function() {    
    _editor      = new Editor($('editor'));
    _editSession = new EditSession(_editor);
    _server      = new Server();
    _settings    = new Settings();
    _files       = new FileSystem();
    _commandLine = new Bespin.CommandLine.Interface($('command'), Bespin.Commands.Default);
    _toolbar     = new EditorToolbar();

    _toolbar.setupDefault();

    _editor.setFocus(true);
    
    _server.currentuser(isLoggedIn, isNotLoggedIn);

    // Get going when settings are loaded
    document.observe("bespin:settings:loaded", function(event) {
        _settings.loadSession();  // load the last file or what is passed in
        doResize();
    });

    Element.observe(window, 'resize', doResize);
});

// Handle Login
function isLoggedIn(userinfo) {
    _editSession.userproject = userinfo.project; // the special user project
}
function isNotLoggedIn() {
    Navigate.home(); // go back
}    

function recalcLayout() {
    var subheader = $("subheader");
    var footer = $("footer");
    var editor = $("editor");
    var files = $("files");
    var collab = $("collab");
    var target = $("target_browsers");

    var move = [ subheader, footer, editor ];

    if (_showFiles) {
        files.style.display = "block";
        move.each(function(item) { item.style.left = "201px" });
    } else {
        files.style.display = "none";
        move.each(function(item) { item.style.left = "0" });
    }

    move.pop();   // ed shouldn't have its right-hand side set

    if (_showCollab) {
        collab.style.display = "block";
        move.each(function(item) { item.style.right = "201px" });
    } else {
        collab.style.display = "none";
        move.each(function(item) { item.style.right = "0" });
    }

    if (_showTarget) {
        target.style.display = "block";
    } else {
        target.style.display = "none";
    }

    doResize();
}

function doResize() {
    var left = $("subheader").style.left;
    left = (left != "") ? parseInt(left) : 0;
    var right = $("subheader").style.right;
    right = (right != "") ? parseInt(right) : 0;

    Element.writeAttribute($('editor'), {
        width: window.innerWidth - left - right,
        height: window.innerHeight - Bespin.commandlineHeight
    });

    _editor.paint();
}