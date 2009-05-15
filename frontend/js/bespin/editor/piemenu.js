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
dojo.require("dojo.fx.easing");

dojo.declare("bespin.editor.piemenu.Window", th.components.Panel, {
    constructor: function() {
        this.isVisible = false;
        this.editor = bespin.get("editor");

        this.menu = dojo.create("canvas", {
            id: 'piemenu',
            style: "position:absolute; z-index:100; top:64px; border:0px solid red; display:none;"
        }, dojo.body());
        this.menu.height = this.editor.canvas.height;
        this.menu.width = this.editor.canvas.width;
        this.ctx = this.menu.getContext('2d');

        this.images = {};
        var ids = [
            "puck_active-btm", "puck_active-lft", "puck_active-rt",
            "puck_active-top", "puck_menu_btm-lft", "puck_menu_btm-lftb",
            "puck_menu_btm-rt", "puck_menu_btm-rtb", "puck_menu_lft",
            "puck_menu_mid", "puck_menu_rt", "puck_off", "puck_menu_top-lft",
            "puck_menu_top-mid", "puck_menu_top-rt"
        ];
        dojo.forEach(ids, function(id) {
            this.images[id] = dojo.create("img", {
                id: id,
                src: "/images/pie/" + id + ".png",
                alt: "pie menu",
                style: "position:absolute; display:none;"
            }, dojo.body());
        }, this);

        /*
        this.input = dojo.create("input", {
            type: "text",
            id: "piemenu_text"
        }, dojo.body());
        */

        var self = this;

        /*
        dojo.connect(this, "mousedown", function(ev) {
            if (!self.isVisible) {
                return;
            }

            var pos = dojo.coords(self.container);
            if (ev.clientX < pos.l
                    || ev.clientX > (pos.l + pos.w)
                    || ev.clientY < pos.t
                    || ev.clientY > (pos.t + pos.h)) {
                self.toggle();
            } else {
                dojo.stopEvent(ev);
            }
        });
        */

        dojo.connect(this, "keydown", function(ev) {
            var key = bespin.util.keys.Key;

            if (!self.isVisible) {
                return;
            }

            console.log("pie keydown", key);

            if (self.keyRunsMe(ev) || ev.keyCode == bespin.util.keys.Key.ESCAPE) {
                self.toggle();
                dojo.stopEvent(ev);
            }
        });
    },

    show: function() {
        var self = this;        
        var anim = dojo.fadeIn({
            node: {
                style:{}
            },
            duration: 500,
            easing: dojo.fx.easing.backOut,
            onAnimate: function(values) {
                var progress = values.opacity;
                self.renderPie(progress);
            }
        });

        this.menu.style.display = 'block';
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
            },
            onEnd: function() {
                self.menu.style.display = 'none';
            },
        });
        anim.play();
    },

    renderPie: function(progress) {
        var ctx = this.menu.getContext("2d");
        var puck_off = this.images.puck_off;

        ctx.save();

        ctx.clearRect(0, 0, this.menu.width, this.menu.height);

        var alpha = Math.max(progress - 0.4, 0);
        ctx.fillStyle = "rgba(0, 0, 0, " + alpha + ")";
        ctx.fillRect(0, 0, this.menu.width, this.menu.height);

        var height = parseInt(puck_off.height * progress);
        var width = parseInt(puck_off.width * progress);

        var x = parseInt((this.menu.width / 2) - (width / 2));
        var y = parseInt((puck_off.height - height) / 2) + this.menu.height - puck_off.height;

        var xm = x + (width / 2);
        var ym = y + (height / 2);

        ctx.translate(xm, ym);
        ctx.rotate(Math.PI * (0.5 + (1.5 * progress)));
        ctx.translate(-xm, -ym);

        ctx.globalAlpha = progress;
        ctx.drawImage(puck_off, x, y, width, height);

        ctx.restore();
    },

    toggle: function() {
        this.isVisible = !this.isVisible;
        if (this.isVisible) {
            this.show();
        } else {
            this.hide();
        }
    },

    keyRunsMe: function(ev) {
        return (ev.keyCode == 'K'.charCodeAt() && ev.altKey && !ev.shiftKey);
    }
});
