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

// = Pie Menu Handling =
//
// Display a pie and allow users to select a slice for display
//
// Additional work that we should consider at some stage:
// * Animate opening content area?
// * Shrink border images
// * Many of the images are duplicates. We should save load time
//   (Also consider rotational and translational symmetry?)
dojo.declare("bespin.editor.piemenu.Window", null, {
    // == Constructor ==
    constructor: function() {
        this.editor = bespin.get("editor");

        // * The reference pane takes a while to load so we create it here
        this.refNode = dojo.create("iframe", {
            id: "pie_ref",
            style: "display:none"
        }, dojo.body());

        this.canvas = dojo.create("canvas", {
            id: 'piemenu',
            style: "position: absolute; z-index: 100; top: " + this.settings.canvasTop + "px; display: none;",
            tabIndex: -1
        }, dojo.body());
        this.canvas.height = this.editor.canvas.height;
        this.canvas.width = this.editor.canvas.width;
        this.ctx = this.canvas.getContext('2d');
        th.fixCanvas(this.ctx);

        // * Load the slice images
        for (var dir in this.slices) {
            var slice = this.slices[dir];
            slice.img = dojo.create("img", {
                id: slice.id,
                src: "/images/pie/" + slice.id + ".png",
                alt: "pie menu border",
                style: "position:absolute; display:none;"
            }, dojo.body());
            slice.piemenu = this;

            // * Load the toolbar images
            dojo.forEach(slice.toolbar, function(button) {
                button.img = dojo.create("img", {
                    src: button.icon,
                    alt: button.alt,
                    title: button.alt,
                    style: "position:absolute; display:none; z-index:210; vertical-align:top;",
                    onclick: dojo.hitch(slice, button.onclick)
                }, dojo.body());
            });
        }
        this.currentSlice = null;

        // * Load the menu border images
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

        // * Load the close button image
        this.closer = dojo.create("img", {
            id: "closer",
            src: "/images/closer.png",
            alt: "Close the dialog",
            style: "position:absolute; display:none; z-index:210;",
            onclick: dojo.hitch(this, this.hide)
        }, dojo.body());

        var self = this;

        /*
        dojo.connect(window, "mousedown", function(e) {
            if (self.currentSlice == null) return;

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

        // * Hide on Escape
        bespin.subscribe("ui:escape", function(e) {
            if (self.currentSlice != null) self.hide();
        });

        dojo.connect(window, 'resize', this, this.resize);

        // * Show slices properly
        dojo.connect(this.canvas, "keydown", function(e) {
            if (self.currentSlice == null) return;

            if (self.keyRunsMe(e)) {
                self.show();
                dojo.stopEvent(e);
                return;
            } else if (e.keyCode == bespin.util.keys.Key.ESCAPE) {
                self.hide();
                dojo.stopEvent(e);
                return;
            }

            for (var dir in self.slices) {
                var slice = self.slices[dir];
                if (e.keyCode == slice.key) {
                    self.showSlice(slice);
                    dojo.stopEvent(e);
                    return;
                }
            }
        });
    },

    // == Various customizations
    settings: {
        // * How far from the top of the window does the pie go
        canvasTop: 31,
        // * How much space do we leave around the opened slices?
        contentsMargin: 10
    },

    keyRunsMe: function(e) {
        return (e.charCode == 'm'.charCodeAt() && e.ctrlKey && !e.altKey && !e.shiftKey);
    },

    // == Objects that control each of the slices ==
    slices: {
        // === The Command Line Slice ===
        commandLine: {
            id: "puck_active_btm",
            title: "Command Line",
            key: bespin.util.keys.Key.DOWN_ARROW,
            showContents: function(coords) {

                var left = coords.l;
                var bottom = this.piemenu.slices.off.img.height;
                var width = coords.w - 50; // TODO: why -50
                var height = coords.h - 30; // TODO: why -30

                bespin.get("commandLine").showOutput(left, bottom, width, height);
            },
            hideContents: function() {
                bespin.get("commandLine").hideOutput();
            },
            toolbar: [
                {
                    icon: "images/icn_fontsize.png",
                    alt: "Font Size",
                    onclick: function() {
                        bespin.get("commandLine").toggleFontSize();
                    }
                },
                {
                    icon: "images/clock_hash.png",
                    alt: "Toggle History/Time Mode",
                    onclick: function() {
                        bespin.get("commandLine").toggleHistoryTimeMode();
                    }
                },
                {
                    icon: "images/plus.png",
                    alt: "Expand all the output areas",
                    onclick: function() {
                        bespin.get("commandLine").expandAllInstructions();
                    }
                },
                {
                    icon: "images/minus.png",
                    alt: "Contract all the output areas",
                    onclick: function() {
                        bespin.get("commandLine").contractAllInstructions();
                    }
                }
            ]
        },

        // === The File Browser Slice ===
        fileBrowser: {
            id: "puck_active_top",
            title: "File Browser",
            key: bespin.util.keys.Key.UP_ARROW,
            showContents: function(coords) {
            }
        },

        // === The Reference Slice ===
        reference: {
            id: "puck_active_lft",
            title: "Reference",
            key: bespin.util.keys.Key.LEFT_ARROW,
            showContents: function(coords) {
                this.piemenu.refNode.src = "https://wiki.mozilla.org/Labs/Bespin";
                dojo.style(this.piemenu.refNode, {
                    left: coords.l + "px",
                    top: coords.t + "px",
                    width: coords.w + "px",
                    height: coords.h + "px",
                    position: "absolute",
                    borderWidth: "0",
                    zIndex:"200",
                    display: "block"
                });
            },
            hideContents: function() {
                dojo.style(this.piemenu.refNode, "display", "none");
            }
        },

        // === The Context Menu Slice ===
        context: {
            id: "puck_active_rt",
            title: "Context",
            key: bespin.util.keys.Key.RIGHT_ARROW,
            showContents: function(coords) {
                /*
                var piemenu = this.piemenu;

                piemenu.ctx.fillStyle = "#bcb9ae";
                piemenu.ctx.font = "10pt Calibri, Arial, sans-serif";
                piemenu.ctx.fillText("Work in progress", parseInt(this.cenLeft + 10), parseInt(this.midTop + 10));
                */
            }
        },

        // === All Slices closed ===
        off: {
            id: "puck_off",
            title: "",
            key: bespin.util.keys.Key.ESCAPE,
            showContents: function() { }
        }
    },

    // == Show a specific slice ==
    showSlice: function(slice) {
        if (this.currentSlice == slice) return;
        if (this.currentSlice) this.unrenderCurrentSlice();
        this.currentSlice = slice;
        this.renderCurrentSlice();
    },

    // == Toggle whether the pie menu is visible ==
    toggle: function() {
        if (this.currentSlice == null) {
            this.show();
        } else {
            this.hide();
        }
    },

    // == Resize the pie menu ==
    // To be called from a window.onresize event
    resize: function() {
        if (this.currentSlice == null) return;

        // TODO: we did have +10 on both of these. Why?
        this.canvas.height = this.editor.canvas.height;
        this.canvas.width = this.editor.canvas.width;
        this.canvas.style.display = 'block';

        this.renderCurrentSlice();
    },

    // == Begin a show animation ==
    show: function(withSlice) {
        var self = this;

        this.canvas.style.display = 'block';
        this.canvas.focus();

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
                self.canvas.focus();
                self.currentSlice = self.slices.off;
                if (withSlice) self.showSlice(withSlice);
            }
        });

        this.showAnimation.play();
    },

    // == Begin a hide animation ==
    hide: function() {
        this.unrenderCurrentSlice();

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
                self.currentSlice = null;
                bespin.get("editor").setFocus(true);
            },
        });
        this.hideAnimation.play();
    },

    // == Render the pie in some opening/closing state ==
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

    // == Render {{{ this.currentSlice }}} ==
    renderCurrentSlice: function() {
        // If something else causes us to show a slice directly we need to
        // have focus to do the arrow thing, but we need to do this at the top
        // because slices might have other focus ideas
        this.canvas.focus();

        this.calculateSlicePositions();
        this.renderPopout();
        this.renderToolbar();

        // * Fill in the center section
        var dimensions = {
            l: this.cenLeft,
            // TODO: Why do we need to push it down 3 extra px?
            t: (this.midTop + this.settings.canvasTop + 3),
            w: this.cenWidth,
            h: this.midHeight
        };
        this.currentSlice.showContents(dimensions);
    },

    // == Unrender {{{ this.currentSlice }}} ==
    unrenderCurrentSlice: function() {
        if (dojo.isFunction(this.currentSlice.hideContents)) {
            this.currentSlice.hideContents();
        }
        this.unrenderToolbar();
    },

    // == Calculate slice border positions ==
    calculateSlicePositions: function() {
        // Left hand edge of center column. Assumes all LHS graphics are same width
        this.cenLeft = this.settings.contentsMargin + this.border.lft.width;
        // Right hand edge of center column. Assumes all RHS graphics are same width
        this.cenRight = this.settings.contentsMargin + this.border.rt.width;
        // Width of the center column. Assumes left and right columns graphics are same width
        this.cenWidth = this.canvas.width - this.cenLeft - this.cenRight;
        // Top of bottom row. Determined by height of pie
        this.btmTop = this.canvas.height - this.currentSlice.img.height;
        // Left hand edge of rightmost column. Assumes all RHS graphics are the same width
        this.rightLeft = this.canvas.width - this.cenRight;
        // Top of all middle rows. Assumes all top graphics are same height
        this.midTop = this.settings.contentsMargin + this.border.top_mid.height;
        // Height of the middle row. Assumes all top graphics are same height
        this.midHeight = this.btmTop - this.settings.contentsMargin - this.border.top_mid.height;
        // Left hand edge of pie. Determined by width of pie
        this.offLeft = parseInt((this.canvas.width / 2) - (this.currentSlice.img.width / 2));
    },

    // == Render an open slice ==
    // How the graphics are laid out
    // {{{
    // [top_lft] [-------- top_mid --------] [top_rt]
    // --                                          --
    // |                                            |
    // lft                   mid                   rt
    // |                                            |
    // --                                          --
    // [btm_lft] [btm_lftb] [puck] [btm_trb] [btm_rt]
    // }}}
    renderPopout: function() {
        // Cache to shorten the commands below
        var margin = this.settings.contentsMargin;

        // * Start again with greying everything out
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // * The pie
        this.ctx.drawImage(this.currentSlice.img, this.offLeft, this.btmTop);

        // * Don't draw the menu area for the 'off' slice
        if (this.currentSlice == this.slices.off) return;

        // * Draw top row
        this.ctx.drawImage(this.border.top_lft, margin, margin);
        this.ctx.drawImage(this.border.top_mid, this.cenLeft, margin, this.cenWidth, this.border.top_mid.height);
        this.ctx.drawImage(this.border.top_rt, this.rightLeft, margin);

        // * Middle row
        this.ctx.drawImage(this.border.lft, margin, this.midTop, this.border.lft.width, this.midHeight);
        this.ctx.drawImage(this.border.mid, this.cenLeft, this.midTop, this.cenWidth, this.midHeight);
        this.ctx.drawImage(this.border.rt, this.rightLeft, this.midTop, this.border.rt.width, this.midHeight);

        // * Bottom row
        this.ctx.drawImage(this.border.btm_lft, margin, this.btmTop);
        var lftbWidth = this.offLeft - (margin + this.border.btm_lft.width);
        this.ctx.drawImage(this.border.btm_lftb, this.cenLeft, this.btmTop, lftbWidth, this.border.btm_lftb.height);

        var rtbLeft = this.offLeft + this.slices.off.img.width;
        var rtbWidth = this.rightLeft - rtbLeft;
        this.ctx.drawImage(this.border.btm_rtb, rtbLeft, this.btmTop, rtbWidth, this.border.btm_rtb.height);
        this.ctx.drawImage(this.border.btm_rt, this.rightLeft, this.btmTop);
    },

    // == Render the toolbar for this slice ==
    renderToolbar: function() {
        if (this.currentSlice.toolbar) {
            // * Title
            this.ctx.fillStyle = "#bcb9ae";
            this.ctx.font = "bold 12pt Calibri, Arial, sans-serif";

            var left = this.cenLeft + 5;
            var top = this.midTop - 9;
            this.ctx.fillText(this.currentSlice.title, left, top);
            // 50 - Give some extra space after the title
            left = left + this.ctx.measureText(this.currentSlice.title).width + 50;

            dojo.forEach(this.currentSlice.toolbar, function(button) {
                dojo.style(button.img, {
                    display: "block",
                    // This is DOM so top is relative to top of window not canvas
                    // TODO: But why 18 and not this.settings.canvasTop?
                    top: (18 + top) + "px",
                    left: left + "px"
                });

                left += button.img.width + 10;
            }, this);
        }

        // * Close Button
        dojo.style(this.closer, {
            display: 'block',
            top: (this.settings.contentsMargin + this.settings.canvasTop + 27) + "px",
            left: (this.rightLeft - 16) + "px"
        });
    },

    // == Unrender the toolbar for this slice ==
    unrenderToolbar: function() {
        if (this.currentSlice.toolbar) {
            dojo.forEach(this.currentSlice.toolbar, function(button) {
                dojo.style(button.img, "display", "none");
            });
        }

        dojo.style(this.closer, 'display', 'none');
    }
});
