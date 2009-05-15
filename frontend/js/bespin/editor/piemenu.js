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

dojo.require("dojo._base.fx");
dojo.require("dojo.fx.easing");

// = Pie Menu =
//
// Pie pie pie

dojo.declare("bespin.editor.PieMenu", null, {
    constructor: function() {
        this.pie = dojo.create("canvas", {
            id: 'piemenu',
            style: "position: absolute; z-index: 400; top: 64px; border: 0px solid red;"
        }, dojo.body());
        this.pie.height = bespin.get('editor').canvas.height;
        this.pie.width = bespin.get('editor').canvas.width;
        
        dojo.create("img", {
            id: "puck_off",
            src: "/images/pie/puck_off.png",
            alt: "pie menu",
            style: "position: absolute; display: none;"
        }, dojo.body());
    },

    show: function() {
        var self = this;
        
        var anim = dojo.fadeIn({
            node: {
                style: {}
            },

            duration: 500,

            easing: dojo.fx.easing.backOut,
            onAnimate: function(values) {
                var progress = values.opacity;
                self.renderPie(progress);
            }
        });
        anim.play();
    },

    hide: function() {
        var self = this;
        
        var anim = dojo.fadeIn({
            node: {
                style: {}
            },

            duration: 400,

            easing: dojo.fx.easing.backIn,

            onAnimate: function(values) {
                var progress = Math.max(1 - values.opacity, 0);
                self.renderPie(progress);
            }
        });
        anim.play();
    },

    renderPie: function(progress) {
        var ctx = this.pie.getContext("2d");
        var puck_off = dojo.byId("puck_off");

        ctx.save();

        ctx.clearRect(0, 0, this.pie.width, this.pie.height);

        var alpha = Math.max(progress - 0.4, 0);
        ctx.fillStyle = "rgba(0, 0, 0, " + alpha + ")";
        ctx.fillRect(0, 0, this.pie.width, this.pie.height);

        var height = parseInt(puck_off.height * progress);
        var width = parseInt(puck_off.width * progress);

        var x = parseInt((this.pie.width / 2) - (width / 2));
        var y = parseInt((puck_off.height - height) / 2) + this.pie.height - puck_off.height;

        var xm = x + (width / 2);
        var ym = y + (height / 2);

        ctx.translate(xm, ym);
        ctx.rotate(Math.PI * (0.5 + (1.5 * progress)));
        ctx.translate(-xm, -ym);

        ctx.globalAlpha = progress;
        ctx.drawImage(puck_off, x, y, width, height);

        ctx.restore();
    }
        
    // show: function() {
    //     var ctx = this.pie.getContext("2d");
    //     ctx.fillStyle = "rgba(255, 100, 100, 0.3)";
    //     ctx.fillRect(0, 0, this.pie.width, this.pie.height);
    // },
    // 
    // hide: function() {
    //     var ctx = this.pie.getContext("2d");
    //     ctx.clearRect(0, 0, this.pie.width, this.pie.height);
    // }
});

// change this to watch for the key strokes
bespin.subscribe("settings:init", function() {
    //var piemenu = new bespin.editor.PieMenu();
    //piemenu.show();
    // setTimeout(function() {
    //     piemenu.hide()
    // }, 1000);
    // setTimeout(function() {
    //     piemenu.show()
    // }, 2000);
});