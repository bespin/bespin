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

//** {{{ bespin.editor.codecompletion }}} **
//
// Utilizes the bespin.parser infrastructure to suggest possible source 
// completions for user input.
// Activate completions by setting codecompletion to on.
dojo.provide("bespin.editor.codecompletion");

dojo.declare("bespin.editor.codecompletion.Suggester", null, {
    constructor: function() {},
    
    // Look back from the cursor col in the current row
    // to find something that can be completed.
    complete: function (cursorPos, row) {
        var self = this;
        var startIndex  = cursorPos.col - 1;
        var substr = "";
        var find = function () {
            if (substr.length >= 1) {
                self.findCompletion(substr);
            }
        };
        for (var i = startIndex; i >= 0; --i) { // looking back
            var ch = row[i];
            if (this.charMarksStartOfIdentifier(ch)) {
                find();
                return
            } else {
                substr = ch + substr;
            }
        }
        // start of line reached
        find();
    },
    
    findInArray: function (candidates, substr, array) {
        for (var i = 0, len = array.length; i < len; ++i) {
            var name = array[i].name;
            if (name) {
                if (name.indexOf(substr) === 0 && substr !== name && name !== "constructor") {
                    candidates.push(name);
                }
            }
        }
    },

    findCompletion: function (substr) {
        var self = this;
        var candidates = [];

        if (self.currentMetaInfo) {
            // use elements from outline like functions, class names and event names
            if(self.currentMetaInfo.outline) {
                this.findInArray(candidates, substr, self.currentMetaInfo.outline);
            }
            // try complex identifier chains like bespin.foo.bar
            if (self.currentMetaInfo.idents) { // complex idents
                var idents = [];
                for(var i in self.currentMetaInfo.idents) {
                    idents.push({ name: i });
                }
                this.findInArray(candidates, substr, idents);
            }
        }

        // If there are any candidates, display a message
        // We should probably just send a custom event with the candidates here.
        // Can do that once we have fancy UI
        if (candidates.length > 0) {
            bespin.get("commandLine").showHint("Code Completions<br><br>" + candidates.join("<br>"));
        }
    },
    
    // find something that we might be able to complete
    // Works for JS. Need to extend this to support for languages
    charMarksStartOfIdentifier: function (ch) {
        return ch === " " || ch === "\t" || ch == "\"" || ch == "'"; // rough estimation
    },

    // This is called after we are loaded into a worker.
    initialize: function () {
        var self = this;

        bespin.subscribe("parser:metainfo", function (evt) {
            self.currentMetaInfo = evt.info;
        });
        
        // ** {{{ Event: codecomplete:suggest }}} **
        //
        // Fire to make the code completion engine provide suggestions
        bespin.subscribe("codecomplete:suggest", function (evt) {
            self.complete(evt.cursorPos, evt.row);
        });
    }

});

(function () {
    // put facade into a worker
    var facade = new bespin.worker.WorkerFacade(new bespin.editor.codecompletion.Suggester());
    if (!facade.__hasWorkers__) {
        facade.initialize();
    }
    var subscription;
    
    // for now we do suggestions upon every doc change
    // could change this to be more unobtrusive
    bespin.subscribe("settings:set:codecomplete", function (data) {
        if (bespin.get("settings").isOn(data.value)) {
            subscription = bespin.subscribe("editor:document:changed", function () {
                var editor = bespin.get("editor");
                var pos    = editor.getCursorPos();
                var row    = editor.model.getRowArray(pos.row);
                
                bespin.publish("codecomplete:suggest", {
                    cursorPos: pos,
                    row: row
                });
            }, 400);
        } else {
            bespin.unsubscribe(subscription);
        }
    });
})();
