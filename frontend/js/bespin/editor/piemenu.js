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

dojo.declare("bespin.editor.piemenu.Window", null, {
    constructor: function() {
        this.isVisible = false;
        this.editor = bespin.get("editor");

        this.canvas = dojo.create("canvas", {
            id: 'piemenu',
            style: "position: absolute; z-index: 100; top: 31px; display: none;",
            tabIndex: -1
        }, dojo.body());
        this.canvas.height = this.editor.canvas.height;
        this.canvas.width = this.editor.canvas.width;
        this.ctx = this.canvas.getContext('2d');

        this.slices = {
            btm: { id: "active_btm", showContents: this.showCommand },
            top: { id: "active_top", showContents: this.showFiles },
            lft: { id: "active_lft", showContents: this.showReference },
            rt:  { id: "active_rt", showContents: this.showContext },
            off: { id: "off", showContents: this.hideDetail }
        };

        for (var dir in this.slices) {
            var slice = this.slices[dir];
            slice.img = dojo.create("img", {
                id: "puck_" + slice.id,
                src: "/images/pie/puck_" + slice.id + ".png",
                alt: "pie menu",
                style: "position:absolute; display:none;"
            }, dojo.body());
        }

        this.border = [];
        var borderIds = [ "lft", "mid", "rt", "top_lft", "top_mid", "top_rt", "btm_lft", "btm_lftb", "btm_rt", "btm_rtb" ];
        dojo.forEach(borderIds, function(id) {
            this.border[id] = dojo.create("img", {
                id: "puck_menu" + id,
                src: "/images/pie/puck_menu_" + id + ".png",
                alt: "pie menu",
                style: "position:absolute; display:none;"
            }, dojo.body());
        }, this);

        var self = this;

        /*
        dojo.connect(window, "mousedown", function(e) {
            if (!self.isVisible) return;

            var pos = dojo.coords(self.canvas);
            if (e.clientX < pos.l
                    || e.clientX > (pos.l + pos.w)
                    || e.clientY < pos.t
                    || e.clientY > (pos.t + pos.h)) {
                self.toggle();
            }
            dojo.stopEvent(e);
        });
        */

        bespin.subscribe("ui:escape", function(e) {
            if (self.isVisible) self.hide();
        });

        dojo.connect(window, 'resize', dojo.hitch(this, function() {
            this.canvas.height = this.editor.canvas.height + 10;
            this.canvas.width = this.editor.canvas.width + 10;
            if (this.isVisible) this.show(true /* don't animate though */);
        }));

        dojo.connect(this.canvas, "keydown", function(e) {
            if (!self.isVisible) return;
            var key = bespin.util.keys.Key;

            console.log("pie keydown", key);

            if (self.keyRunsMe(e) || e.keyCode == bespin.util.keys.Key.ESCAPE) {
                self.hide();
                dojo.stopEvent(e);
            }
            else if (e.keyCode == key.UP_ARROW) {
                self.renderPopout(self.slices.top);
                dojo.stopEvent(e);
            }
            else if (e.keyCode == key.DOWN_ARROW) {
                self.renderPopout(self.slices.btm);
                dojo.stopEvent(e);
            }
            else if (e.keyCode == key.RIGHT_ARROW) {
                self.renderPopout(self.slices.rt);
                dojo.stopEvent(e);
            }
            else if (e.keyCode == key.LEFT_ARROW) {
                self.renderPopout(self.slices.lft);
                dojo.stopEvent(e);
            }
        });
    },

    show: function(dontAnimate) {
        var self = this;

        this.canvas.style.display = 'block';
        this.canvas.focus();

        if (dontAnimate) {
            this.renderPie(1.0);
        } else {
            if (!this.showAnimation) this.showAnimation = dojo.fadeIn({
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
                    console.log("where do you want to go today?");
                    self.canvas.focus();
                }
            });
            this.showAnimation.play();
        }
    },

    hide: function() {
        var self = this;
        if (!this.hideAnimation) this.hideAnimation = dojo.fadeIn({
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
                self.canvas.style.display = 'none';
            },
        });
        this.hideAnimation.play();
    },

    renderPie: function(progress) {
        var ctx = this.ctx;
        var off = this.slices.off.img;

        ctx.save();

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        var alpha = Math.max(progress - 0.4, 0);
        ctx.fillStyle = "rgba(0, 0, 0, " + alpha + ")";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        var height = parseInt(off.height * progress);
        var width = parseInt(off.width * progress);

        var x = parseInt((this.canvas.width / 2) - (width / 2));
        var y = parseInt((off.height - height) / 2) + this.canvas.height - off.height;

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
     * Put stuff in the content area
     * Animate opening content area?
     * Shrink border images
     * Many of the images are dups. we should save load time
     * - Also consider rotational and translational sym??
     */
    renderPopout: function(active) {
        // We can customize how much is visible round the edges
        var margin = 10;

        // How the graphics are laid out
        // [top_lft] [-------- top_mid --------] [top_rt]
        //  ---                                      ---
        //   |                                        |
        //  lft                   mid                rt
        //   |                                        |
        //  ---                                      ---
        // [btm_lft] [btm_lftb] [puck] [btm_trb] [btm_rt]

        // Start again with greying everything out
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Left hand edge of pie. Determined by height of pie
        var offLeft = parseInt((this.canvas.width / 2) - (active.img.width / 2));
        // Top of bottom row. Determined by height of pie
        var btmTop = this.canvas.height - active.img.height;
        // Left hand edge of rightmost column. Assumes all RHS graphics are the same width
        var rightLeft = this.canvas.width - margin - this.border.top_rt.width;
        // Top of all middle rows. Assumes all top graphics are same height
        var midTop = margin + this.border.top_mid.height;
        // Left hand edge of center column. Assumes all LHS graphics are same width
        var cenLeft = margin + this.border.top_lft.width;
        // Height of the middle row. Assumes all top graphics are same height
        var midHeight = btmTop - margin - this.border.top_mid.height;
        // Width of the center column. Assumes left and right columns graphics are same width
        var cenWidth = this.canvas.width - cenLeft - (margin + this.border.top_rt.width);

        // Draw top row
        this.ctx.drawImage(this.border.top_lft, margin, margin);
        this.ctx.drawImage(this.border.top_mid, cenLeft, margin, cenWidth, this.border.top_mid.height);
        this.ctx.drawImage(this.border.top_rt, rightLeft, margin);

        // Middle row
        this.ctx.drawImage(this.border.lft, margin, midTop, this.border.lft.width, midHeight);
        this.ctx.drawImage(this.border.mid, cenLeft, midTop, cenWidth, midHeight);
        this.ctx.drawImage(this.border.rt, rightLeft, midTop, this.border.rt.width, midHeight);

        // Bottom row
        this.ctx.drawImage(this.border.btm_lft, margin, btmTop);
        var lftbWidth = offLeft - (margin + this.border.btm_lft.width);
        this.ctx.drawImage(this.border.btm_lftb, cenLeft, btmTop, lftbWidth, this.border.btm_lftb.height);
        this.ctx.drawImage(active.img, offLeft, btmTop);
        var rtbLeft = offLeft + this.slices.off.img.width;
        var rtbWidth = rightLeft - (rtbLeft);
        this.ctx.drawImage(this.border.btm_rtb, rtbLeft, btmTop, rtbWidth, this.border.btm_rtb.height);
        this.ctx.drawImage(this.border.btm_rt, rightLeft, btmTop);

        // Fill in the center section
        active.showContents.apply(this, [{ l:cenLeft, t:midTop, w:cenWidth, h:midHeight}]);
    },

    showCommand: function(coords) {
        this.ctx.fillStyle = "#bcb9ae";
        this.ctx.font = "10pt Calibri, Arial, sans-serif";
        this.ctx.fillText("Command Line", coords.l + 5, coords.t - 10);

        dojo.byId("footer").style.display = "block";
        // add 32px to bottom to cater for command line (until it is gone from bottom)
        dojo.byId("editor").style.bottom = "32px";
        dojo.byId("info").style.bottom = "32px";
    },

    showFiles: function(coords) {
        this.ctx.fillText("File System", coords.l, coords.t);
    },

    showReference: function(coords) {
        if (!this.refNode) {
            this.refNode = dojo.create("iframe", {
                id: "pie_ref",
                src: "https://developer.mozilla.org/En/Canvas_tutorial/Using_images",
                style: "z-index: 200"
            }, dojo.body());
        }
        this.refNode.left = coords.l;
        this.refNode.top = coords.t;
        this.refNode.width = coords.w;
        this.refNode.height = coords.h;
    },

    showContext: function(coords) {
        console.log("context goes here");
    },

    hideDetail: function() {
        console.log("hideDetail");
    },

    toggle: function() {
        this.isVisible = !this.isVisible;
        if (this.isVisible) {
            this.show();
        } else {
            this.hide();
        }
    },

    keyRunsMe: function(e) {
        return (e.keyCode == 'K'.charCodeAt() && e.altKey && !e.shiftKey);
    }
});
