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

dojo.provide("bespin.editor.piemenu");

// = Pie Menu =
//
// Pie pie pie

dojo.declare("bespin.editor.PieMenu", null, {
    constructor: function() {
        this.pie = dojo.create("canvas", {
            id: 'piemenu',
            style: "position: absolute; z-index: 400; width: 100px; height: 100px; border: 1px solid red;"
        }, dojo.body());        
    },
    
    show: function() {
        var ctx = this.pie.getContext("2d");
        ctx.fillStyle = "rgba(255, 100, 100, 0.3)";
        ctx.fillRect(0, 0, this.pie.width, this.pie.height);
    },

    hide: function() {
        var ctx = this.pie.getContext("2d");
        ctx.clearRect(0, 0, this.pie.width, this.pie.height);
    }
});

// change this to watch for the key strokes
bespin.subscribe("settings:init", function() {
    var piemenu = new bespin.editor.PieMenu();
    piemenu.show();
    setTimeout(function() {
        piemenu.hide()
    }, 1000);
    setTimeout(function() {
        piemenu.show()
    }, 2000);
})