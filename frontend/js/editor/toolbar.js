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

var EditorToolbar = Class.create({
    DEFAULT_TOOLBAR: ["collaboration", "files", "target_browsers", "undo", "redo", "cut", "copy", "paste", "history", "preview", "fontsize"],
    FONT_SIZES: {
        1: 8,  // small
        2: 10, // medium
        3: 14  // large
    },

    initialize: function(editor) {
        this.editor = editor || _editor;
        this.currentFontSize = 2;
    },
    
    setup: function(type, el) {
        if (Object.isFunction(this.components[type])) this.components[type](this, el);
    },

    /*
     * Go through the default list and try to hitch onto the DOM element
     */
    setupDefault: function() {
        this.DEFAULT_TOOLBAR.each(function(item) {
            var item_el = $("toolbar_" + item);
            if (item_el) {
                this.setup(item, item_el);
            }
        }.bind(this));
    },
    
    components: {
        collaboration: function(toolbar, el) {
            var collab = $(el) || $("toolbar_collaboration");
            Element.observe(collab, 'click', function() {
                _showCollab = !_showCollab;
                collab.src = "images/" + ( (_showCollab) ? "icn_collab_on.png" : (_showCollabHotCounter == 0) ? "icn_collab_off.png" : "icn_collab_watching.png" );
                if (Object.isFunction(recalcLayout)) recalcLayout(); // todo fix
            });
        },
        
        files: function(toolbar, el) {
            var files = $(el) || $("toolbar_files");
            Element.observe(files, 'click', function() {
                _showFiles = !_showFiles;
                files.src = "images/" + ( (_showFiles) ? "icn_files_on.png" : "icn_files_off.png" );
                if (Object.isFunction(recalcLayout)) recalcLayout(); // todo fix
            });
        },
        
        target_browsers: function(toolbar, el) {
            var target = $(el) || $("toolbar_target_browsers");
            Element.observe(target, 'click', function() {
                _showTarget = !_showTarget;
                target.src = "images/" + ( (_showTarget) ? "icn_target_on.png" : "icn_target_off.png" );
                if (Object.isFunction(recalcLayout)) recalcLayout(); // todo fix
            });
        },

        undo: function(toolbar, el) {
            var undo = $(el) || $("toolbar_undo");
            Element.observe(undo, 'mousedown', function() {
                undo.src = "images/icn_undo_on.png";
            });

            Element.observe(undo, 'mouseup', function() {
                undo.src = "images/icn_undo.png";
            });

            Element.observe(undo, 'click', function() {
                toolbar.editor.ui.actions.undo();
            });
        },

        redo: function(toolbar, el) {
            var redo = $(el) || $("toolbar_undo");

            Element.observe(redo, 'mousedown', function() {
                redo.src = "images/icn_redo_on.png";
            });

            Element.observe(redo, 'mouseup', function() {
                redo.src = "images/icn_redo.png";
            });

            Element.observe(redo, 'click', function() {
                toolbar.editor.ui.actions.redo();
            });
        },
        
        cut: function(toolbar, el) {
            var cut = $(el) || $("toolbar_cut");

            Element.observe(cut, 'mousedown', function() {
                cut.src = "images/icn_cut_on.png";
            });

            Element.observe(cut, 'mouseup', function() {
                cut.src = "images/icn_cut.png";
            });

            Element.observe(cut, 'click', function() {
                toolbar.editor.ui.actions.cutSelection(EditorUtils.argsWithPos());
            });
        },

        copy: function(toolbar, el) {
            var copy = $(el) || $("toolbar_copy");

            Element.observe(copy, 'mousedown', function() {
                copy.src = "images/icn_copy_on.png";
            });

            Element.observe(copy, 'mouseup', function() {
                copy.src = "images/icn_copy.png";
            });

            Element.observe(copy, 'click', function() {
                toolbar.editor.ui.actions.copySelection(EditorUtils.argsWithPos());
            });
        },

        paste: function(toolbar, el) {
            var paste = $(el) || $("toolbar_paste");

            Element.observe(paste, 'mousedown', function() {
                paste.src = "images/icn_paste_on.png";
            });

            Element.observe(paste, 'mouseup', function() {
                paste.src = "images/icn_paste.png";
            });

            Element.observe(paste, 'click', function() {
                toolbar.editor.ui.actions.pasteFromClipboard(EditorUtils.argsWithPos());
            });
        },

        history: function(toolbar, el) {
            var history = $(el) || $("toolbar_history");
            
            Element.observe(history, 'mousedown', function() {
                history.src = "images/icn_history_on.png";
            });

            Element.observe(history, 'mouseup', function() {
                history.src = "images/icn_history.png";
            });
            
            Element.observe(history, 'click', function() {
                console.log("clicked on history toolbar icon");
            });
        },

        preview: function(toolbar, el) {
            var preview = $(el) || $("toolbar_preview");
            
            Element.observe(preview, 'mousedown', function() {
                preview.src = "images/icn_preview_on.png";
            });

            Element.observe(preview, 'mouseup', function() {
                preview.src = "images/icn_preview.png";
            });
            
            Element.observe(preview, 'click', function() {
                console.log("clicked on preview toolbar icon");
            });
        },

        fontsize: function(toolbar, el) {
            var fontsize = $(el) || $("toolbar_fontsize");
            
            Element.observe(fontsize, 'mousedown', function() {
                fontsize.src = "images/icn_fontsize_on.png";
            });

            Element.observe(fontsize, 'mouseup', function() {
                fontsize.src = "images/icn_fontsize.png";
            });

            // Change the font size between the small, medium, and large settings
            Element.observe(fontsize, 'click', function() {
                toolbar.currentFontSize = (toolbar.currentFontSize > 2) ? 1 : toolbar.currentFontSize + 1;
                document.fire("bespin:settings:set:fontsize", { value: toolbar.FONT_SIZES[toolbar.currentFontSize] });
            });
        }
    }
});