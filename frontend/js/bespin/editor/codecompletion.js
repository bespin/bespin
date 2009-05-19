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
    constructor: function(parms) {},

    complete: function () {
        var self = this;
        var editor = bespin.get("editor");

        var pos    = editor.getCursorPos();

        var row    = editor.model.getRowArray(pos.row);
        var startIndex  = pos.col - 1;
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

    findCompletion: function (substr) {
        var parser = bespin.get("parser");
        var functions = parser.getFunctions();
        var candidates = [];
        for (var i = 0, len = functions.length; i < len; ++i) {
            var name = functions[i].name;
            if (name) {
                if (name.indexOf(substr) == 0 && name != "constructor") {
                    candidates.push(name);
                }
            }
        }
        if (candidates.length > 0) {
            bespin.publish("message", {
                msg: "Code Completions<br><br>" + candidates.join("<br>"),
                tag: "autohide"
            });
        }
    },

    charMarksStartOfIdentifier: function (ch) {
        return ch === "." || ch === " " || ch === "\t"; // rough estimation
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
    }

});

(function () {
var suggester = new bespin.editor.codecompletion.Suggester();

bespin.subscribe("settings:set:codecomplete", function (data) {
    var settings = bespin.get("settings");
    if (settings.isOn(data.value)) {
        suggester.subscribe();
    } else {
        suggester.unsubscribe();
    }
});

})()
