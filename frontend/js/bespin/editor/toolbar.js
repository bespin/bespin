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

dojo.provide("bespin.editor.toolbar");

// = Toolbar =
//
// The editor has the notion of a toolbar which are components that can drive the editor from outside of itself
// Such examples are collaboration views, file browser, undo/redo, cut/copy/paste and more.

dojo.declare("bespin.editor.Toolbar", null, { 
    DEFAULT_TOOLBAR: ["collaboration", "files", "dashboard", "target_browsers", "save",
                      "close", "undo", "redo", "preview", "fontsize"],
    FONT_SIZES: {
        1: 8,  // small
        2: 10, // medium
        3: 14  // large
    },

    constructor: function(editor) {
        this.editor = editor || _editor;
        this.currentFontSize = 2;
    },
    
    setup: function(type, el) {
        if (dojo.isFunction(this.components[type])) this.components[type](this, el);
    },

    /*
     * Go through the default list and try to hitch onto the DOM element
     */
    setupDefault: function() { 
        dojo.forEach(this.DEFAULT_TOOLBAR, dojo.hitch(this, function(item) {
            var item_el = dojo.byId("toolbar_" + item);
            if (item_el) {
                this.setup(item, item_el);
            }
        }));
    },
    
    components: {
        collaboration: function(toolbar, el) {
            var collab = dojo.byId(el) || dojo.byId("toolbar_collaboration");
            dojo.connect(collab, 'click', function() {
                _showCollab = !_showCollab;
                collab.src = "images/" + ( (_showCollab) ? "icn_collab_on.png" : (_showCollabHotCounter == 0) ? "icn_collab_off.png" : "icn_collab_watching.png" );
                if (dojo.isFunction(recalcLayout)) recalcLayout(); // todo fix
            });
            dojo.connect(collab, 'mouseover', function() {
                collab.style.cursor = "pointer";
                collab.src = "images/icn_collab_on.png";
            });
            dojo.connect(collab, 'mouseout', function() {
                collab.style.cursor = "default";
                collab.src = "images/icn_collab_off.png";
            });
        },
        
        files: function(toolbar, el) {
            var files = dojo.byId(el) || dojo.byId("toolbar_files");
            dojo.connect(files, 'click', function() {
                _showFiles = !_showFiles;
                files.src = "images/" + ( (_showFiles) ? "icn_files_on.png" : "icn_files_off.png" );
                if (dojo.isFunction(recalcLayout)) recalcLayout(); // todo fix
            });
            dojo.connect(files, 'mouseover', function() {
                files.style.cursor = "pointer";
                files.src = "images/icn_files_on.png";
            });
            dojo.connect(files, 'mouseout', function() {
                files.style.cursor = "default";
                files.src = "images/icn_files_off.png";
            });
        },

        dashboard: function(toolbar, el) {
            var dashboard = dojo.byId(el) || dojo.byId("toolbar_dashboard");
            dojo.connect(dashboard, 'mouseover', function() {
                dashboard.style.cursor = "pointer";
                dashboard.src = "images/icn_dashboard_on.png";
            });
            dojo.connect(dashboard, 'mouseout', function() {
                dashboard.style.cursor = "default";
                dashboard.src = "images/icn_dashboard_off.png";
            });
        },
        
        target_browsers: function(toolbar, el) {
            var target = dojo.byId(el) || dojo.byId("toolbar_target_browsers");
            dojo.connect(target, 'click', function() {
                _showTarget = !_showTarget;
                target.src = "images/" + ( (_showTarget) ? "icn_target_on.png" : "icn_target_off.png" );
                if (dojo.isFunction(recalcLayout)) recalcLayout(); // todo fix
            });
            dojo.connect(target, 'mouseover', function() {
                target.style.cursor = "pointer";
                target.src = "images/icn_target_on.png";
            });
            dojo.connect(target, 'mouseout', function() {
                target.style.cursor = "default";
                target.src = "images/icn_target_off.png";
            });
        },

        save: function(toolbar, el) {
            var save = dojo.byId(el) || dojo.byId("toolbar_save");
            dojo.connect(save, 'mousedown', function() {
                save.src = "images/icn_save_on.png";
            });

            dojo.connect(save, 'mouseup', function() {
                save.src = "images/icn_save.png";
            });
               
            dojo.connect(save, 'click', function() {   
                bespin.publish("bespin:editor:savefile");  
            });
        },

        close: function(toolbar, el) {
            var close = dojo.byId(el) || dojo.byId("toolbar_close");
            dojo.connect(close, 'mousedown', function() {
                close.src = "images/icn_close_on.png";
            });

            dojo.connect(close, 'mouseup', function() {
                close.src = "images/icn_close.png";
            });

            dojo.connect(close, 'click', function() {
                bespin.publish("bespin:editor:closefile");
            });
        },

        undo: function(toolbar, el) {
            var undo = dojo.byId(el) || dojo.byId("toolbar_undo");
            dojo.connect(undo, 'mousedown', function() {
                undo.src = "images/icn_undo_on.png";
            });

            dojo.connect(undo, 'mouseup', function() {
                undo.src = "images/icn_undo.png";
            });

            dojo.connect(undo, 'click', function() {
                toolbar.editor.ui.actions.undo();
            });
        },

        redo: function(toolbar, el) {
            var redo = dojo.byId(el) || dojo.byId("toolbar_undo");

            dojo.connect(redo, 'mousedown', function() {
                redo.src = "images/icn_redo_on.png";
            });

            dojo.connect(redo, 'mouseup', function() {
                redo.src = "images/icn_redo.png";
            });

            dojo.connect(redo, 'click', function() {
                toolbar.editor.ui.actions.redo();
            });
        },
        
        // -- THESE ARE MORE TROUBLE THAN THEY ARE WORTH
        // Developers are smart enough to know that they can Cmd/Ctrl C X V!
        //
        // cut: function(toolbar, el) {
        //     var cut = dojo.byId(el) || dojo.byId("toolbar_cut");
        // 
        //     dojo.connect(cut, 'mousedown', function() {
        //         cut.src = "images/icn_cut_on.png";
        //     });
        // 
        //     dojo.connect(cut, 'mouseup', function() {
        //         cut.src = "images/icn_cut.png";
        //     });
        // 
        //     dojo.connect(cut, 'click', function() {
        //         toolbar.editor.ui.actions.cutSelection(bespin.editor.utils.buildArgs());
        //     });
        // },
        // 
        // copy: function(toolbar, el) {
        //     var copy = dojo.byId(el) || dojo.byId("toolbar_copy");
        // 
        //     dojo.connect(copy, 'mousedown', function() {
        //         copy.src = "images/icn_copy_on.png";
        //     });
        // 
        //     dojo.connect(copy, 'mouseup', function() {
        //         copy.src = "images/icn_copy.png";
        //     });
        // 
        //     dojo.connect(copy, 'click', function() {
        //         toolbar.editor.ui.actions.copySelection(bespin.editor.utils.buildArgs());
        //     });
        // },
        // 
        // paste: function(toolbar, el) {
        //     var paste = dojo.byId(el) || dojo.byId("toolbar_paste");
        // 
        //     dojo.connect(paste, 'mousedown', function() {
        //         paste.src = "images/icn_paste_on.png";
        //     });
        // 
        //     dojo.connect(paste, 'mouseup', function() {
        //         paste.src = "images/icn_paste.png";
        //     });
        // 
        //     dojo.connect(paste, 'click', function() {
        //         toolbar.editor.ui.actions.pasteFromClipboard(bespin.editor.utils.buildArgs());
        //     });
        // },

        // history: function(toolbar, el) {
        //     var history = dojo.byId(el) || dojo.byId("toolbar_history");
        //     
        //     Element.observe(history, 'mousedown', function() {
        //         history.src = "images/icn_history_on.png";
        //     });
        // 
        //     Element.observe(history, 'mouseup', function() {
        //         history.src = "images/icn_history.png";
        //     });
        //     
        //     Element.observe(history, 'click', function() {
        //         console.log("clicked on history toolbar icon");
        //     });
        // },

        preview: function(toolbar, el) {
            var preview = dojo.byId(el) || dojo.byId("toolbar_preview");
            
            dojo.connect(preview, 'mousedown', function() {
                preview.src = "images/icn_preview_on.png";
            });

            dojo.connect(preview, 'mouseup', function() {
                preview.src = "images/icn_preview.png";
            });
            
            dojo.connect(preview, 'click', function() {
                bespin.publish("bespin:editor:preview"); // use default file                
            });
        },

        fontsize: function(toolbar, el) {
            var fontsize = dojo.byId(el) || dojo.byId("toolbar_fontsize");
            
            dojo.connect(fontsize, 'mousedown', function() {
                fontsize.src = "images/icn_fontsize_on.png";
            });

            dojo.connect(fontsize, 'mouseup', function() {
                fontsize.src = "images/icn_fontsize.png";
            });

            // Change the font size between the small, medium, and large settings
            dojo.connect(fontsize, 'click', function() {
                toolbar.currentFontSize = (toolbar.currentFontSize > 2) ? 1 : toolbar.currentFontSize + 1;
                bespin.publish("bespin:settings:set:fontsize", [{ value: toolbar.FONT_SIZES[toolbar.currentFontSize] }]);
            });
        }
    }
});