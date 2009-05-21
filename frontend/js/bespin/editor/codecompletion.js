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

dojo.provide("bespin.editor.codecompletion");

dojo.declare("bespin.editor.codecompletion.Suggester", null, {
    constructor: function() {},

    complete: function (cursorPos, row) {
        var startIndex  = cursorPos.col - 1;
        var substr = "";
        for (var i = startIndex; i >= 0; --i) {
            var ch = row[i];
            if (this.charMarksStartOfIdentifier(ch) && substr.length >= 1) {
                this.findCompletion(substr);
                break;
            } else {
                substr = ch + substr;
            }
        }
    },
    
    findInArray: function (candidates, substr, array) {
        for (var i = 0, len = array.length; i < len; ++i) {
            var name = array[i].name;
            if (name) {
                if (name.indexOf(substr) == 0 && name != "constructor") {
                    candidates.push(name);
                }
            }
        }
    },

    findCompletion: function (substr) {
        var self = this;
        var candidates = [];
        
        if(self.currentMetaInfo) {
            if(self.currentMetaInfo.outline) {
                this.findInArray(candidates, substr, self.currentMetaInfo.outline);
            }
            if(self.currentMetaInfo.idents) { // complex idents
                var idents = [];
                for(var i in self.currentMetaInfo.idents) {
                    idents.push({
                        name: i
                    })
                }
                this.findInArray(candidates, substr, idents);
            }
        }
        
        if (candidates.length > 0) {
            bespin.publish("message", {
                msg: "Code Completions<br><br>" + candidates.join("<br>"),
                tag: "autohide"
            });
        }
    },

    charMarksStartOfIdentifier: function (char) {
        return char === " " || char === "\t" || char == "\"" || char == "'"; // rough estimation
    },

    subscribe: function () {
        var self = this;
        this.subscription = bespin.subscribe("editor:document:changed", function () {
            self.complete();
        }, 400);
    },

    unsubscribe: function () {
        if (this.subscription) {
            bespin.unsubscribe(this.subscription);
            this.subscription = null;
        }
    },
    
    initialize: function () {
        var self = this;
        
        bespin.subscribe("parser:metainfo", function (evt) {
            self.currentMetaInfo = evt.info
        })
        
        bespin.subscribe("codecomplete:suggest", function (evt) {
            self.complete(evt.cursorPos, evt.row)
        })
    }

});

(function () {
var facade = new bespin.worker.WorkerFacade(new bespin.editor.codecompletion.Suggester());
if(!facade.__hasWorkers__) {
    facade.initialize()
}
var subscription
bespin.subscribe("settings:set:codecomplete", function (data) {
    if (bespin.get("settings").isOn(data.value)) {
        subscription = bespin.subscribe("editor:document:changed", function () {
            var editor = bespin.get("editor");
            var pos    = editor.getCursorPos();
            var row    = editor.model.getRowArray(pos.row);
            
            bespin.publish("codecomplete:suggest", {
                cursorPos: pos,
                row: row
            })
        }, 400);
    } else {
        bespin.unsubscribe(subscription)
    }
});
})()
