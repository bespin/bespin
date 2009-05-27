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
            style: "display:none"
        }, dojo.body());

        this.canvas = dojo.create("canvas", {
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
        var borderIds = [ "top_lft", "top_mid", "top_rt", "lft", "mid", "rt", "btm_lft", "btm_lftb", "btm_rt", "btm_rtb" ];
        dojo.forEach(borderIds, function(id) {
            this.border[id] = dojo.create("img", {
                src: "/images/menu/" + id + ".png",
                alt: "pie menu",
                style: "position:absolute; display:none;"
            }, dojo.body());
        }, this);

        // * Load the close button image
        this.closer = dojo.create("img", {
            src: "/images/closer.png",
            alt: "Close the dialog",
            style: "position:absolute; display:none; z-index:210;",
            onclick: dojo.hitch(this, this.hide)
        }, dojo.body());

        var self = this;

        // * Hide on Escape
        bespin.subscribe("ui:escape", function(e) {
            if (self.currentSlice != null) self.hide();
        });

        dojo.connect(window, 'resize', this, this.resize);

        // * Show slices properly
        dojo.connect(this.canvas, 'keydown', function(e) {
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

        dojo.connect(this.canvas, 'click', function(e) {
            var pieRadius = 152 / 2; // self.slices.off.img.width / 2; Take account for the padding on the image
            var fullWidth = self.canvas.width;
            var centerWidth = Math.round(fullWidth / 2);
            var x = e.layerX || e.offsetX;
            var y = e.layerY || e.offsetY;
            var zoneLeft = centerWidth - pieRadius;
            var zoneRight = centerWidth + pieRadius;

            // only do the calculation if you are clicking on the hot zone
            if (x > zoneLeft && x < zoneRight) {
                var p = self.centerPoint(x, y); // change coord scheme to center based

                var degrees = self.angle(p.x, p.y);

                self.showSlice(self.slice(degrees));
            }
        });
    },

    // == Various customizations
    settings: {
        // * How far from the top of the window does the pie go
        canvasTop: 31,
        // * How much space do we leave around the opened slices?
        topMargin: 10,
        leftMargin: 60,
        rightMargin: 60,
    },

    // == Objects that control each of the slices ==
    slices: {
        // === The Command Line Slice ===
        commandLine: {
            id: "active_btm",
            title: "Command Line",
            key: bespin.util.keys.Key.DOWN_ARROW,
            showContents: function(coords) {
                var left = coords.l;
                var bottom = this.piemenu.slices.off.img.height - 10;
                var width = coords.w - 40; // TODO: why -50
                var height = coords.h - 30; // TODO: why -30

                bespin.get("commandLine").showOutput(left, bottom, width, height);
            },
            hideContents: function() {
                bespin.get("commandLine").hideOutput();
            },
            toolbar: [
                {
                    icon: "images/slice_aaa.png",
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
                /*
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
                */
            ]
        },

        // === The File Browser Slice ===
        fileBrowser: {
            id: "active_top",
            title: "File Browser",
            key: bespin.util.keys.Key.UP_ARROW,
            showContents: function(coords) {
            }
        },

        // === The Reference Slice ===
        reference: {
            id: "active_lft",
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
                    zIndex: "200",
                    display: "block"
                });
            },
            hideContents: function() {
                dojo.style(this.piemenu.refNode, "display", "none");
            }
        },

        // === The Context Menu Slice ===
        context: {
            id: "active_rt",
            title: "Context",
            key: bespin.util.keys.Key.RIGHT_ARROW,
            showContents: function(coords) {
                /*
                var piemenu = this.piemenu;

                piemenu.ctx.fillStyle = "#bcb9ae";
                piemenu.ctx.font = "10pt Calibri, Arial, sans-serif";
                piemenu.ctx.fillText("Work in progress", parseInt(d.cenLeft + 10), parseInt(d.midTop + 10));
                */
            }
        },

        // === All Slices closed ===
        off: {
            id: "off",
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

    // == Calculate the top left X and Y coordinates of the pie ==
    getTopLeftXY: function(width, height) {
        return { x: parseInt((this.canvas.width / 2) - (width / 2)),
                 y: parseInt((this.slices.off.img.height - height) / 2) + this.canvas.height - this.slices.off.img.height };
    },

    // == Calculate the center X Y at the middle of the pie ==
    getCenterXY: function() {
        var off = this.slices.off.img;
        var topLeft = this.getTopLeftXY(off.width, off.height);

        return { x: topLeft.x + (off.width / 2),
                 y: topLeft.y + (off.width / 2) };
    },

    // == Render the pie in some opening/closing state ==
    renderPie: function(progress) {
        var ctx = this.ctx;
        var off = this.slices.off.img;

        ctx.save();

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        var alpha = Math.max(progress - 0.9, 0); // Was 0.4
        ctx.fillStyle = "rgba(0, 0, 0, " + alpha + ")";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        var height = parseInt(off.height * progress);
        var width = parseInt(off.width * progress);

        var p = this.getTopLeftXY(width, height);

        var xm = p.x + (width / 2);
        var ym = p.y + (height / 2);

        ctx.translate(xm, ym);
        ctx.rotate(Math.PI * (0.5 + (1.5 * progress)));
        ctx.translate(-xm, -ym);

        ctx.globalAlpha = progress;
        ctx.drawImage(off, p.x, p.y, width, height);

        ctx.restore();
    },

    // == Render {{{ this.currentSlice }}} ==
    renderCurrentSlice: function() {
        // If something else causes us to show a slice directly we need to
        // have focus to do the arrow thing, but we need to do this at the top
        // because slices might have other focus ideas
        this.canvas.focus();

        var d = this.calculateSlicePositions();
        this.renderPopout(d);
        this.renderToolbar(d);

        // * Fill in the center section
        var dimensions = {
            l: d.cenLeft,
            // TODO: Why do we need to push it down 3 extra px?
            t: (d.midTop + this.settings.canvasTop + 3),
            w: d.cenWidth,
            h: d.midHeight
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
        var d = {};
        var pieHeight = this.currentSlice.img.height;
        var pieWidth = this.currentSlice.img.width;

        // Left hand edge of center column. Assumes all LHS graphics are same width
        d.cenLeft = this.settings.leftMargin + this.border.lft.width;
        // Right hand edge of center column. Assumes all RHS graphics are same width
        d.cenRight = this.settings.rightMargin + this.border.rt.width;
        // Width of the center column. Assumes left and right columns graphics are same width
        d.cenWidth = this.canvas.width - d.cenLeft - d.cenRight;
        // Top of bottom row. Determined by height of pie
        d.btmTop = this.canvas.height - pieHeight;
        // Left hand edge of rightmost column. Assumes all RHS graphics are the same width
        d.rightLeft = this.canvas.width - d.cenRight;
        // Top of all middle rows. Assumes all top graphics are same height
        d.midTop = this.settings.topMargin + this.border.top_mid.height;
        // Height of the middle row. Assumes all top graphics are same height
        d.midHeight = d.btmTop - d.midTop;
        // Left hand edge of pie. Determined by width of pie
        d.offLeft = parseInt((this.canvas.width / 2) - (pieWidth / 2));

        return d;
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
    renderPopout: function(d) {
        // * Start again with greying everything out
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.1)"; // was 0.6
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // * The pie
        this.ctx.drawImage(this.currentSlice.img, d.offLeft, d.btmTop);

        // * Don't draw the menu area for the 'off' slice
        if (this.currentSlice == this.slices.off) return;

        // * Draw top row
        this.ctx.drawImage(this.border.top_lft, this.settings.leftMargin, this.settings.topMargin);
        this.ctx.drawImage(this.border.top_mid, d.cenLeft, this.settings.topMargin, d.cenWidth, this.border.top_mid.height);
        // TODO +4 eh?
        this.ctx.drawImage(this.border.top_rt, d.rightLeft, this.settings.topMargin + 4);

        // * Middle row
        this.ctx.drawImage(this.border.lft, this.settings.leftMargin, d.midTop, this.border.lft.width, d.midHeight);
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.85)"; // Was 0.4
        this.ctx.fillRect(d.cenLeft, d.midTop, d.cenWidth, d.midHeight);
        //this.ctx.drawImage(this.border.mid, d.cenLeft, d.midTop, d.cenWidth, d.midHeight);
        this.ctx.drawImage(this.border.rt, d.rightLeft, d.midTop, this.border.rt.width, d.midHeight);

        // * Bottom row
        this.ctx.drawImage(this.border.btm_lft, this.settings.leftMargin, d.btmTop);
        var lftbWidth = d.offLeft - (this.settings.leftMargin + this.border.btm_lft.width);
        this.ctx.drawImage(this.border.btm_lftb, d.cenLeft, d.btmTop, lftbWidth, this.border.btm_lftb.height);

        var rtbLeft = d.offLeft + this.slices.off.img.width;
        var rtbWidth = d.rightLeft - rtbLeft;
        this.ctx.drawImage(this.border.btm_rtb, rtbLeft, d.btmTop, rtbWidth, this.border.btm_rtb.height);
        this.ctx.drawImage(this.border.btm_rt, d.rightLeft, d.btmTop);
    },

    // == Render the toolbar for this slice ==
    renderToolbar: function(d) {
        // * Title
        this.ctx.fillStyle = "#bcb9ae";
        this.ctx.font = "bold 12pt Calibri, Arial, sans-serif";

        var left = d.cenLeft + 5;
        var top = d.midTop - 9;
        this.ctx.fillText(this.currentSlice.title, left, top);
        // 50 - Give some extra space after the title
        left = left + this.ctx.measureText(this.currentSlice.title).width + 50;

        // HACK ALERT we should correctly layout from the right rather than
        // this evil fix which only works because only 1 slice has a toolbar
        left = d.rightLeft - 150;

        dojo.forEach(this.currentSlice.toolbar, function(button) {
            dojo.style(button.img, {
                display: "block",
                // This is DOM so top is relative to top of window not canvas
                // TODO: But why 18 and not this.settings.canvasTop?
                top: (18 + top) + "px",
                left: left + "px"
            });

            left += button.img.width + 5;
        }, this);

        // * Close Button
        dojo.style(this.closer, {
            display: 'block',
            top: (this.settings.topMargin + this.settings.canvasTop + 27) + "px",
            left: (d.rightLeft - 16) + "px"
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
    },

    keyRunsMe: function(e) {
        return (e.charCode == 'm'.charCodeAt() && e.ctrlKey && !e.altKey && !e.shiftKey);
    },

    // == Take the center pie point and migrate the clicked point to be relative to the center ==
    centerPoint: function(x, y) {
        var off = this.slices.off.img;
        var center = this.getCenterXY(off.width, off.height);

        return {
            x: x - center.x,
            y: center.y - y
        };
    },

    // == Calculate the angle of the dangle ==
    angle: function(x, y) {
        return Math.atan2(y, x) * 180 / Math.PI;
    },

    // == Return the slice to activate ==
    slice: function(degrees) {
        if (degrees >= -45 && degrees < 45) { // right
            return this.slices.context;
        } else if (degrees >= 45 && degrees < 135) { // top
            return this.slices.fileBrowser;
        } else if (degrees >= 135 || degrees < -135) { // left
            return this.slices.reference;
        } else { // bottom
            return this.slices.commandLine;
        }
    }
});
