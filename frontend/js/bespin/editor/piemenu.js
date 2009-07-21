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

/**
 * <p>Pie Menu Handling
 *
 * <p>Display a pie and allow users to select a slice for display
 *
 * <p>Additional work that we should consider at some stage:<ul>
 * <li>Animate opening content area?
 * <li>Shrink border images
 * <li>Many of the images are duplicates. We should save load time
 *   (Also consider rotational and translational symmetry?)
 * </ul>
 */
exports.Window = Class.define({
members:
{
    /**
     * Construct a piemenu window
     */
    init: function() {
        this.nodes = [];
        this.subscriptions = [];
        this.connections = [];
        
        this.editor = bespin.get("editor");

        // The reference pane takes a while to load so we create it here
        this.refNode = dojo.create("iframe", {
            style: "display:none",
            id: "piemenu_refNode"
        }, dojo.body());
        this.nodes.push("piemenu_refNode");

        this.canvas = dojo.create("canvas", {
            id: "piemenu",
            tabIndex: -1,
            height: window.innerHeight, // See comments on resize()
            width: window.innerWidth,
            style: {
                position: "absolute",
                zIndex: 100,
                top: this.settings.canvasTop + "px",
                left: "0px",
                display: "none"
            }
        }, dojo.body());
        this.nodes.push("piemenu");
        
        
        this.ctx = this.canvas.getContext('2d');
        th.fixCanvas(this.ctx);

        // Load the slice images
        for (var dir in this.slices) {
            var slice = this.slices[dir];
            slice.img = dojo.create("img", {
                src: "/images/pie/" + slice.id + ".png",
                alt: "pie menu border",
                style: "position:absolute; display:none;",
                id: "piemenu_slice_" + slice.id
            }, dojo.body());
            this.nodes.push("piemenu_slice_" + slice.id);
            slice.piemenu = this;
            
            var counter = 0;
            
            // Load the toolbar images
            dojo.forEach(slice.toolbar, function(button) {
                button.img = dojo.create("img", {
                    src: button.icon,
                    alt: button.alt,
                    title: button.alt,
                    onclick: dojo.hitch(slice, button.onclick),
                    style: {
                        position: "absolute",
                        display: "none",
                        zIndex: 210,
                        verticalAlign: "top",
                        cursor: "pointer"
                    },
                    id: "piemenu_button_" + counter
                }, dojo.body());
                this.nodes.push("piemenu_button" + counter);
                counter += 1;
            }, this);
        }

        // When currentSlice is null, we are not visible, there are slices
        // for all the other states
        this.currentSlice = null;

        // Load the menu border images
        this.border = [];
        var borderIds = [ "top_lft", "top_mid", "top_rt", "lft", "mid", "rt", "btm_lft", "btm_lftb", "btm_rt", "btm_rtb" ];
        dojo.forEach(borderIds, function(id) {
            this.border[id] = dojo.create("img", {
                src: "/images/menu/" + id + ".png",
                alt: "pie menu",
                style: "position:absolute; display:none;",
                id: "piemenu_border_" + id,
            }, dojo.body());
            this.nodes.push("piemenu_border_" + id);
        }, this);

        // Load the close button image
        this.closer = dojo.create("img", {
            src: "/images/closer.png",
            alt: "Close the dialog",
            title: "Close the dialog",
            id: "piemenu_closer",
            style: {
                position: "absolute",
                display: "none",
                zIndex: 210,
                cursor: "pointer"
            },
            onclick: dojo.hitch(this, this.hide)
        }, dojo.body());
        this.nodes.push("piemenu_closer");

        var self = this;

        // Hide on Escape
        this.subscriptions.push(bespin.subscribe("ui:escape", function(e) {
            if (self.visible()) self.hide();
        }));

        this.connections.push(dojo.connect(window, 'resize', this, this.resize));

        // Show slices properly
        this.connections.push(dojo.connect(this.canvas, 'keydown', function(e) {
            if (!self.visible()) {
                // The popup keyboard handling is done in commandline.js. Ug
                return;
            }

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
                    self.show(slice);
                    dojo.stopEvent(e);
                    return;
                }
            }
        }));

        this.connections.push(dojo.connect(this.canvas, 'click', function(e) {
            var pieRadius = 152 / 2; // self.slices.off.img.width / 2; Take account for the padding on the image
            var x = e.layerX || e.offsetX;
            var y = e.layerY || e.offsetY;

            // only do the calculation if you are clicking on the hot zone
            var p = self.centerPoint(x, y); // change coord scheme to center based

            var distanceFromCenter = Math.sqrt(Math.pow(p.x, 2) + Math.pow(p.y, 2));

            if (distanceFromCenter < pieRadius - 4) {
                var degrees = self.angle(p.x, p.y);
                self.show(self.slice(degrees));
            }
        }));

        // stop context menu on canvas, because for some reason, WebKit's oncontextmenu doesn't
        // realize when it has been hidden.
        this.connections.push(dojo.connect(this.canvas, "oncontextmenu", dojo.stopEvent));
    },
    
    destroy: function() {
        dojo.forEach(this.subscriptions, function(sub) {
            bespin.unsubscribe(sub);
        });
        
        dojo.forEach(this.connections, function(conn) {
            dojo.disconnect(conn);
        });
        
        dojo.forEach(this.nodes, function(nodeId) {
            dojo.query("#" + nodeId).orphan();
        });
    },

    /**
     * Holder for various settings that we might want to customize
     */
    settings: {
        // How far from the top of the window does the pie go
        canvasTop: 0,
        // How much space do we leave around the opened slices?
        topMargin: 10,
        leftMargin: 60,
        rightMargin: 60,
        showMenuDuration: 200,
        hideMenuDuration: 400
    },

    /**
     * Is this event a 'show pie' event?
     */
    keyRunsMe: function(e) {
        return (e.charCode == 'm'.charCodeAt() && e.ctrlKey && !e.altKey && !e.shiftKey);
    },

    /**
     * Objects that control each of the slices
     */
    slices: {
        /**
         * The Command Line Slice
         */
        commandLine: {
            id: "active_btm",
            title: "Command Line",
            key: bespin.util.keys.Key.DOWN_ARROW,
            show: function() {
                bespin.getComponent("popup", function(popup) {
                    popup.show("output");
                });
            },
            tbar: [
                {
                    icon: "images/slice_aaa.png",
                    alt: "Toggle Font Size",
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
                }
            ]
        },

        /**
         * The File Browser Slice
         */
        fileBrowser: {
            id: "active_top",
            title: "File Browser",
            key: bespin.util.keys.Key.UP_ARROW,

            show: function() {
                bespin.getComponent("popup", function(popup) {
                    popup.show("files");
                });
            }
        },

        /**
         * The Reference Slice
         */
        reference: {
            id: "active_lft",
            title: "Reference",
            key: bespin.util.keys.Key.LEFT_ARROW,
            show: function() {
                bespin.getComponent("popup", function(popup) {
                    popup.show("reference");
                });
            }
        },

        /**
         * The Context Menu Slice
         */
        context: {
            id: "active_rt",
            title: "Context",
            key: bespin.util.keys.Key.RIGHT_ARROW,
            show: function(coords) {
                bespin.getComponent("popup", function(popup) {
                    popup.show("reference");
                });
            }
        },

        /**
         * All Slices closed, but pie visible
         */
        off: {
            id: "off",
            title: "",
            key: bespin.util.keys.Key.ESCAPE,
            showContents: function() { }
        }
    },

    /**
     * Show a specific slice, and animate the opening if needed
     */
    show: function(slice, dontTakeFocus, x, y) {
        if (x != undefined) {
            console.log("SETTING LAUNCHED AT");
            this.launchedAt = {x:x, y:y};
        } else {
            this.launchedAt = undefined;
        }
        
        // The default slice is the unselected slice
        if (!slice) slice = this.slices.off;

        // No change needed
        if (this.currentSlice == slice) return;

        // If there is already a slice showing, just show that, and don't
        // bother with any animation
        if (this.visible()) {
            this.currentSlice = slice;
            this.hide(false);
            this.currentSlice.show();
            return;
        }

        this.canvas.style.display = 'block';

        if (!dontTakeFocus) {
            this.canvas.focus();
        }
        this.currentSlice = slice;

        if (dojo.isFunction(this.currentSlice.preAnimate)) {
            this.currentSlice.preAnimate();
        }

        var self = this;
        var duration = parseInt(bespin.get('settings').get('menushowduration'));

        // Set the duration for the fade in.
        if (typeof duration == "undefined" || isNaN(duration)) {
            duration = this.settings.showMenuDuration;
        }
        
        dojo.fadeIn({
            node: { style:{} },
            duration: duration,
            easing: dojo.fx.easing.backOut,
            onAnimate: function(values) {
                var progress = values.opacity;
                self.renderPie(progress);
            },
            onEnd: function() {
                if (!dontTakeFocus) {
                    self.canvas.focus();
                }
                self.renderCurrentSlice(dontTakeFocus);
            }
        }).play();
    },

    /**
     * Begin a hide animation
     */
    hide: function(giveEditorFocus) {
        if (giveEditorFocus == undefined) {
            giveEditorFocus = true;
        }
        
        if (!this.hideAnimation) {
            var duration = parseInt(bespin.get('settings').get('menuhideduration'));

            // Set the duration for the fade in.
            if (typeof duration == "undefined" || isNaN(duration)) {
                duration = this.settings.hideMenuDuration;
            }

            var self = this;
            this.hideAnimation = dojo.fadeIn({
                node: { style: {} },
                duration: duration,
                easing: dojo.fx.easing.backIn,
                onAnimate: function(values) {
                    var progress = Math.max(1 - values.opacity, 0);
                    self.renderPie(progress);
                },
                onEnd: function() {
                    self.canvas.style.display = 'none';
                    self.currentSlice = null;
                    if (giveEditorFocus) {
                        self.editor.setFocus(true);
                    }
                }
            });
        }
        this.hideAnimation.play();
    },

    /**
     * Check to see if the pie is visible
     */
    visible: function() {
        return this.currentSlice != null;
    },

    /**
     * Toggle whether the pie menu is visible
     */
    toggle: function() {
        if (this.visible()) {
            this.hide();
        } else {
            this.show();
        }
    },

    /**
     * Resize the pie menu
     * To be called from a window.onresize event
     */
    resize: function() {
        if (!this.visible()) return;

        // This fixes some redraw problems (due to resize events firing in
        // unpredictable orders) however this code doesn't work on IE. There
        // is a dojo function to use clientHeight on IE, but that's in dijit
        // so in the sort term we hack.
        // http://www.dojotoolkit.org/forum/dojo-core-dojo-0-9/dojo-core-support/how-get-cross-browser-window-innerheight-value
        // http://code.google.com/p/doctype/wiki/WindowInnerHeightProperty
        //  this.canvas.height = this.editor.canvas.height;
        //  this.canvas.width = this.editor.canvas.width;
        // Also the height maths is wonky because it puts the pie off the bottom
        // of the screen, but we'll be changing the way that works shortly
        this.canvas.height = window.innerHeight;
        this.canvas.width = window.innerWidth;

        this.canvas.style.display = 'block';

        this.renderCurrentSlice(false);
    },

    /**
     * Calculate the top left X and Y coordinates of the pie
     */
    getTopLeftXY: function(width, height) {
        if (this.launchedAt != undefined) {
            return {x: this.launchedAt.x - width/2, y: this.launchedAt.y - height/2};
        }
        
        return { x: parseInt((this.canvas.width / 2) - (width / 2)),
                 y: parseInt((this.slices.off.img.height - height) / 2) + this.canvas.height - this.slices.off.img.height };
    },

    /**
     * Calculate the center X Y at the middle of the pie
     */
    getCenterXY: function() {
        var off = this.slices.off.img;
        var topLeft = this.getTopLeftXY(off.width, off.height);

        return { x: topLeft.x + (off.width / 2),
                 y: topLeft.y + (off.width / 2) };
    },

    /**
     * Render the pie in some opening/closing state
     */
    renderPie: function(progress) {
        // when loaded dynamically, this appears to exercise a bug in Safari 4 (fixed in WebKit
        // nightlies). There may be a workaround. But for now, short circuit.
        // Note: unshortcircuited. If it breaks again, re-shortcircuit.
        // behavior when it fails apparently has the entire canvas rotating, somehow.
        //if (th.browser.WebKit) {
        //    return;
        //}
        
        var ctx = this.ctx;
        var off = this.slices.off.img;

        ctx.save();

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        var alpha = Math.max(progress - 0.4, 0);
        ctx.fillStyle = "rgba(0, 0, 0, " + alpha + ")";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        var height = parseInt(off.height * progress);
        var width = parseInt(off.width * progress);

        var p = this.getTopLeftXY(width, height);

        var xm = p.x + (width / 2);
        var ym = p.y + (height / 2);
        
        // Safari wants this to be set first.
        ctx.globalAlpha = progress;

        ctx.translate(xm, ym);
        ctx.rotate(Math.PI * (0.5 + (1.5 * progress)));
        ctx.translate(-xm, -ym);

        ctx.drawImage(off, p.x, p.y, width, height);

        ctx.restore();
    },

    /**
     * Animation renderer
     */
    renderCurrentSlice: function(dontTakeFocus) {
        // If something else causes us to show a slice directly we need to
        // have focus to do the arrow thing, but we need to do this at the top
        // because slices might have other focus ideas
        if (!dontTakeFocus) {
            this.canvas.focus();
        }

        var d = this.calculateSlicePositions();
        this.renderPopout(d);
    },

    /**
     * Remove parts of the current slice that are specific to that slice like
     * images.
     */
    unrenderCurrentSlice: function() {
        if (dojo.isFunction(this.currentSlice.hideContents)) {
            this.currentSlice.hideContents();
        }
        this.unrenderToolbar();
    },

    /**
     * Calculate slice border positions
     */
    calculateSlicePositions: function() {
        var d = {};
        // HACK: we use the command line because it's bigger
        // var pieHeight = this.currentSlice.img.height;
        var pieHeight = this.slices.commandLine.img.height;
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
        
        if (this.launchedAt != undefined) {
            d.offLeft = this.launchedAt.x - pieWidth/2;
            d.btmTop = this.launchedAt.y - pieHeight/2 - 15;
        } else {
            d.offLeft = parseInt((this.canvas.width / 2) - (pieWidth / 2));
        }

        return d;
    },

    /**
     * Render an open slice
     * <p>How the graphics are laid out:
     * <pre>
     * [top_lft] [-------- top_mid --------] [top_rt]
     * --                                          --
     * |                                            |
     * lft                   mid                   rt
     * |                                            |
     * --                                          --
     * [btm_lft] [btm_lftb] [puck] [btm_trb] [btm_rt]
     * </pre>
     */
    renderPopout: function(d) {
        // Start again with greying everything out
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // The pie
        var sliceTop = d.btmTop + this.slices.commandLine.img.height - this.currentSlice.img.height;
        this.ctx.drawImage(this.currentSlice.img, d.offLeft, sliceTop);
    },

    /**
     * Render the toolbar for this slice
     */
    renderToolbar: function(d) {
        // Title
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

        // 27 is an evil number. Again.
        var toolbarOffsetTop = (this.settings.topMargin + this.settings.canvasTop + 27) + "px";

        dojo.forEach(this.currentSlice.toolbar, function(button) {
            dojo.style(button.img, {
                display: "block",
                // This is DOM so top is relative to top of window not canvas
                top: toolbarOffsetTop,
                left: left + "px"
            });

            left += button.img.width + 5;
        }, this);

        if (this.currentSlice != this.slices.off) {
            // Close Button
            dojo.style(this.closer, {
                display: 'block',
                top: toolbarOffsetTop,
                left: (d.rightLeft - 16) + "px"
            });
        }
    },

    /**
     * Unrender the toolbar for this slice
     */
    unrenderToolbar: function() {
        if (this.currentSlice.toolbar) {
            dojo.forEach(this.currentSlice.toolbar, function(button) {
                dojo.style(button.img, "display", "none");
            });
        }

        dojo.style(this.closer, 'display', 'none');
    },

    /**
     * Take the center pie point and migrate the clicked point to be relative
     * to the center
     */
    centerPoint: function(x, y) {
        var off = this.slices.off.img;
        var center = this.getCenterXY(off.width, off.height);

        return {
            x: x - center.x,
            y: center.y - y
        };
    },

    /**
     * Calculate the angle of the dangle
     */
    angle: function(x, y) {
        return Math.atan2(y, x) * 180 / Math.PI;
    },

    /**
     * Return the slice to activate
     */
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
}});