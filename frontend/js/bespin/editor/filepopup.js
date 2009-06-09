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

dojo.provide("bespin.editor.filepopup");

dojo.declare("bespin.editor.filepopup.MainPanel", null, {
    setup: function() {
        // if we've already setup the scene, bail
        if (this.scene) return;

        this.canvas = document.getElementById("piefilepopupcanvas");

        if (!this.canvas) {
            this.canvas = dojo.create("canvas", {
                id: "piefilepopupcanvas",
                tabIndex: -1,
                style: {
                    position: "absolute",
                    zIndex: 101,
                    display: "none"
                }
            }, dojo.body());
        }

        var scene = new th.Scene(this.canvas);

        scene.root.addCss("background-color", "blue");

        // make the root transparent
        //scene.root.paintSelf = function() {}

        

        this.scene = scene;
    },

    show: function(coords) {
        this.setup();

        console.log(coords);

        this.canvas.width = coords.w;
        this.canvas.height = coords.h;

        dojo.style(this.canvas, {
            display: "block",
            top: coords.t + "px",
            left: coords.l + "px"
        });
        
        this.scene.render();
    },

    hide: function() {
        this.canvas.style.display = "none";
    }
});