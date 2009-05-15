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
            "active_btm", "active_lft", "active_rt", "active_top", "off",
            "menu_btm_lft", "menu_btm_lftb", "menu_btm_rt", "menu_btm_rtb",
            "menu_lft", "menu_mid", "menu_rt", "menu_top_lft",
            "menu_top_mid", "menu_top_rt"
        ];
        dojo.forEach(ids, function(id) {
            this.images[id] = dojo.create("img", {
                id: "puck_" + id,
                src: "/images/pie/puck_" + id + ".png",
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
            },
            onEnd: function() {
                self.renderPopout();
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
        var ctx = this.ctx;
        var off = this.images.off;

        ctx.save();

        ctx.clearRect(0, 0, this.menu.width, this.menu.height);

        var alpha = Math.max(progress - 0.4, 0);
        ctx.fillStyle = "rgba(0, 0, 0, " + alpha + ")";
        ctx.fillRect(0, 0, this.menu.width, this.menu.height);

        var height = parseInt(off.height * progress);
        var width = parseInt(off.width * progress);

        var x = parseInt((this.menu.width / 2) - (width / 2));
        var y = parseInt((off.height - height) / 2) + this.menu.height - off.height;

        var xm = x + (width / 2);
        var ym = y + (height / 2);

        ctx.translate(xm, ym);
        ctx.rotate(Math.PI * (0.5 + (1.5 * progress)));
        ctx.translate(-xm, -ym);

        ctx.globalAlpha = progress;
        ctx.drawImage(off, x, y, width, height);

        ctx.restore();
    },

    /*
     * TODO:
     * All keyboard handling is done by editor. we need to take control
     * Render the correct slice
     * Put stuff in the content area
     * Animate opening content area?
     * Hookup a resize event
     * Shrink border images
     * Many of the images are dups. we should save load time
     * - Also consider rotational and translational sym??
     */
    renderPopout: function() {
        var margin = 10;
        var active = this.images.active_btm;

        // Left hand edge of pie. Determined by height of pie
        var offLeft = parseInt((this.menu.width / 2) - (active.width / 2));
        // Top of bottom row. Determined by height of pie
        var btmTop = this.menu.height - active.height;
        // Left hand edge of rightmost column. Assumes all RHS graphics are the same width
        var rightLeft = this.menu.width - margin - this.images.menu_top_rt.width;
        // Top of all middle rows. Assumes all top graphics are same height
        var midTop = margin + this.images.menu_top_mid.height;
        // Left hand edge of center column. Assumes all LHS graphics are same width
        var cenLeft = margin + this.images.menu_top_lft.width;
        // Height of the middle row. Assumes all top graphics are same height
        var midHeight = btmTop - margin - this.images.menu_top_mid.height;
        // Width of the center column. Assumes left and right columns graphics are same width
        var cenWidth = this.menu.width - (margin + this.images.menu_top_lft.width) - (margin + this.images.menu_top_rt.width);

        // top left
        this.ctx.drawImage(this.images.menu_top_lft, margin, margin);

        // top center
        this.ctx.drawImage(this.images.menu_top_mid, cenLeft, margin, cenWidth, this.images.menu_top_mid.height);

        // top right
        this.ctx.drawImage(this.images.menu_top_rt, rightLeft, margin);

        // middle left
        this.ctx.drawImage(this.images.menu_lft, margin, midTop, this.images.menu_lft.width, midHeight);

        // middle center display area
        this.ctx.drawImage(this.images.menu_mid, cenLeft, midTop, cenWidth, midHeight);

        // middle right
        this.ctx.drawImage(this.images.menu_rt, rightLeft, midTop, this.images.menu_rt.width, midHeight);

        // bottom left
        this.ctx.drawImage(this.images.menu_btm_lft, margin, btmTop);

        // bottom (left of pie)
        var lftbWidth = offLeft - (margin + this.images.menu_btm_lft.width);
        this.ctx.drawImage(this.images.menu_btm_lftb, cenLeft, btmTop, lftbWidth, this.images.menu_btm_lftb.height);

        // pie
        this.ctx.drawImage(active, offLeft, btmTop);

        // bottom (right of pie)
        var rtbLeft = offLeft + this.images.off.width;
        var rtbWidth = rightLeft - (rtbLeft);
        this.ctx.drawImage(this.images.menu_btm_rtb, rtbLeft, btmTop, rtbWidth, this.images.menu_btm_rtb.height);

        // bottom right
        this.ctx.drawImage(this.images.menu_btm_rt, rightLeft, btmTop);
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
