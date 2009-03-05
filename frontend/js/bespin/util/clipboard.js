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

dojo.provide("bespin.util.clipboard");

// = Clipboard =
//
// Handle clipboard operations. 
// If using WebKit (I know, feature detection would be nicer, but e.clipboardData is deep) use DOMEvents
// Else try the bad tricks.

// ** {{{ bespin.util.clipboard }}} **
//
// The factory that is used to install, and setup the adapter that does the work

dojo.mixin(bespin.util.clipboard, {
    // ** {{{ install }}} **
    //
    // Given a clipboard adapter implementation, save it, an call install() on it
    install: function(newImpl) {
        if (this.uses && typeof this.uses['uninstall'] == "function") this.uses.uninstall();
        this.uses = newImpl;
        this.uses.install();
    },

    // ** {{{ setup }}} **
    //
    // Do the first setup. Right now checks for WebKit and inits a DOMEvents solution if that is true
    // else install the default.
    setup: function() {
        if (dojo.isWebKit) {
            this.install(new bespin.util.clipboard.DOMEvents());
        } else {
            this.install(new bespin.util.clipboard.HiddenWorld());
        }
    }
});

// ** {{{ bespin.util.clipboard.DOMEvents }}} **
//
// This adapter configures the DOMEvents that only WebKit seems to do well right now.
// There is trickery involved here. The before event changes focus to the hidden
// copynpaster text input, and then the real event does its thing and we focus back

dojo.declare("bespin.util.clipboard.DOMEvents", null, {
    install: function() {
        
        // * Configure the hidden copynpaster element
        var copynpaster = dojo.create("input", {
            type: 'text',
            id: 'copynpaster',
            style: "position: absolute; z-index: -400; top: -100px; left: -100px; width: 0; height: 0; border: none;"
        }, dojo.body());
        
        // Copy
        this.beforecopyHandle = dojo.connect(document, "beforecopy", function(e) {
            e.preventDefault();
            dojo.byId('copynpaster').focus();
        });

        this.copyHandle = dojo.connect(document, "copy", function(e) {
            var selectionText = _editor.getSelectionAsText();
            
            if (selectionText && selectionText != '') {
                e.preventDefault();
                e.clipboardData.setData('text/plain', selectionText);
            }
            
            dojo.byId('canvas').focus();
        });

        // Cut
        this.beforecutHandle = dojo.connect(document, "beforecut", function(e) {
            e.preventDefault();
            dojo.byId('copynpaster').focus();
        });

        this.cutHandle = dojo.connect(document, "cut", function(e) {
            var selectionObject = _editor.getSelection();

            if (selectionObject) {
                var selectionText = _editor.model.getChunk(selectionObject);

                if (selectionText && selectionText != '') {
                    e.preventDefault();
                    e.clipboardData.setData('text/plain', selectionText);
                    _editor.ui.actions.deleteSelection(selectionObject);
                }
            }

            dojo.byId('canvas').focus();
        });

        // Paste
        this.beforepasteHandle = dojo.connect(document, "beforepaste", function(e) {
            e.preventDefault();
            dojo.byId('copynpaster').focus();
        });

        this.pasteHandle = dojo.connect(document, "paste", function(e) {
            e.preventDefault();
            var args = bespin.editor.utils.buildArgs();    
            args.chunk = e.clipboardData.getData('text/plain');
            if (args.chunk) _editor.ui.actions.insertChunk(args);

            dojo.byId('canvas').focus();
            dojo.byId('copynpaster').value = '';
        });

        dojo.connect(document, "dom:loaded", dojo.hitch(this, function() {
            this.keydownHandle = dojo.connect(dojo.byId('copynpaster'), "keydown", function(e) {
                e.stopPropagation();
            });

            this.keypressHandle = dojo.connect(dojo.byId('copynpaster'), "keypress", function(e) {
                e.stopPropagation();
            });
        }));        
    },
    
    uninstall: function() {
        dojo.disconnect(this.keypressHandle);
        dojo.disconnect(this.keydownHandle);
        dojo.disconnect(this.beforepasteHandle);
        dojo.disconnect(this.pasteHandle);
        dojo.disconnect(this.beforecutHandle);
        dojo.disconnect(this.cutHandle);
        dojo.disconnect(this.beforecopyHandle);
        dojo.disconnect(this.copyHandle);
    }
});

// ** {{{ bespin.util.clipboard.HiddenWorld }}} **
//
// Exclusively grab the C, X, and V key combos and use a hidden textarea to move data around

dojo.declare("bespin.util.clipboard.HiddenWorld", null, {
    install: function() {
        // * Configure the hidden copynpaster element
        var copynpaster = dojo.create("textarea", {
            tabIndex: '-1',
            autocomplete: 'off',
            id: 'copynpaster',
            style: "position: absolute; z-index: -400; top: -100px; left: -100px; width: 0; height: 0; border: none;"
        }, dojo.body());
        
        var grabAndGo = function(text) {
            dojo.byId('copynpaster').value = text;
            focusSelectAndGo();
        };
        
        var focusSelectAndGo = function() {
            dojo.byId('copynpaster').focus();
            dojo.byId('copynpaster').select();
            setTimeout(function() {
                dojo.byId('canvas').focus();
            }, 0);
        };
        
        this.keyDown = dojo.connect(document, "keydown", function(e) {
            if ((bespin.util.isMac() && e.metaKey) || e.ctrlKey) {
                // Copy
                if (e.keyCode == 67 /*c*/) {
                    // place the selection into the textarea
                    var selectionText = _editor.getSelectionAsText();

                    if (selectionText && selectionText != '') {
                        grabAndGo(selectionText);
                    }

                // Cut
                } else if (e.keyCode == 88 /*x*/) {
                    // place the selection into the textarea
                    var selectionObject = _editor.getSelection();

                    if (selectionObject) {
                        var selectionText = _editor.model.getChunk(selectionObject);

                        if (selectionText && selectionText != '') {
                            grabAndGo(selectionText);
                            _editor.ui.actions.deleteSelection(selectionObject);
                        }
                    }

                // Paste
                } else if (e.keyCode == 86 /*v*/) {
                    focusSelectAndGo();

                    var args = bespin.editor.utils.buildArgs();    
                    args.chunk = dojo.byId('copynpaster').value;
                    if (args.chunk) _editor.ui.actions.insertChunk(args);
                }
            }
        });
    },
    
    uninstall: function() {
        dojo.disconnect(this.keyDown);
    }
});

// ** {{{ bespin.util.clipboard.EditorOnly }}} **
//
// Turn on the key combinations to access the Bespin.Clipboard.Manual class which basically only works
// with the editor only. Not in favour.

dojo.declare("bespin.util.clipboard.EditorOnly", null, {
    install: function() {
        var copyArgs = bespin.util.keys.fillArguments("CMD C");
        copyArgs.action = "copySelection";
        bespin.publish("bespin:editor:bindkey", copyArgs);

        var pasteArgs = bespin.util.keys.fillArguments("CMD V");
        pasteArgs.action = "pasteFromClipboard";
        bespin.publish("bespin:editor:bindkey", pasteArgs);

        var cutArgs = bespin.util.keys.fillArguments("CMD X");
        cutArgs.action = "cutSelection";
        bespin.publish("bespin:editor:bindkey", cutArgs);
    }
});

// ** {{{ Bespin.Clipboard.Manual }}} **
//
// The ugly hack that tries to use XUL to get work done, but will probably fall through to in-app copy/paste only        
bespin.util.clipboard.Manual = function() {
    var clipdata;
    
    return {
        copy: function(copytext) {
            try {
                if (netscape.security.PrivilegeManager.enablePrivilege) {
                    netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
                } else {
                    clipdata = copytext;
                    return;
                }
            } catch (ex) {
                clipdata = copytext;
                return;
            }

            var str = Components.classes["@mozilla.org/supports-string;1"].
                                      createInstance(Components.interfaces.nsISupportsString);
            str.data = copytext;

            var trans = Components.classes["@mozilla.org/widget/transferable;1"].
                                   createInstance(Components.interfaces.nsITransferable);
            if (!trans) return false;

            trans.addDataFlavor("text/unicode");
            trans.setTransferData("text/unicode", str, copytext.length * 2);

            var clipid = Components.interfaces.nsIClipboard;
            var clip   = Components.classes["@mozilla.org/widget/clipboard;1"].getService(clipid);
            if (!clip) return false;

            clip.setData(trans, null, clipid.kGlobalClipboard);

            /*
            // Flash doesn't work anymore :(
            if (inElement.createTextRange) {
                var range = inElement.createTextRange();
                if (range && BodyLoaded==1)
                    range.execCommand('Copy');
            } else {
                var flashcopier = 'flashcopier';
                if (!document.getElementById(flashcopier)) {
                    var divholder = document.createElement('div');
                    divholder.id = flashcopier;
                    document.body.appendChild(divholder);
                }
                document.getElementById(flashcopier).innerHTML = '';

                var divinfo = '<embed src="_clipboard.swf" FlashVars="clipboard='+escape(inElement.value)+'" width="0" height="0" type="application/x-shockwave-flash"></embed>';
                document.getElementById(flashcopier).innerHTML = divinfo;
            }
            */
        },

        data: function() {
            try {
                if (netscape.security.PrivilegeManager.enablePrivilege) {
                    netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
                } else {
                    return clipdata;
                }
            } catch (ex) {
                return clipdata;
            }

            var clip = Components.classes["@mozilla.org/widget/clipboard;1"].getService(Components.interfaces.nsIClipboard);
            if (!clip) return false;

            var trans = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);
            if (!trans) return false;
            trans.addDataFlavor("text/unicode");

            clip.getData(trans, clip.kGlobalClipboard);

            var str       = {};
            var strLength = {};
            var pastetext = "";

            trans.getTransferData("text/unicode", str, strLength);
            if (str) str = str.value.QueryInterface(Components.interfaces.nsISupportsString);
            if (str) pastetext = str.data.substring(0, strLength.value / 2);
            return pastetext;
        }
    };
}();
