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

exports.Window = Class.define({
members: {
    /**
     * Construct a popup commandline-driven window
     */
    init: function() {
        this.editor = bespin.get("editor");
        this.subscriptions = [];
        this.connections = [];
        this.nodes = [];

        this.canvas = dojo.create("canvas", {
            id: "popup",
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
        
        this.nodes.push("popup");
        
        this.ctx = this.canvas.getContext('2d');
        th.fixCanvas(this.ctx);
        // Load the close button image
        this.closer = dojo.create("img", {
            id: "closer",
            src: "/images/closer.png",
            alt: "Close the dialog",
            title: "Close the dialog",
            style: {
                position: "absolute",
                display: "none",
                zIndex: 210,
                cursor: "pointer"
            },
            onclick: dojo.hitch(this, this.hide)
        }, dojo.body());
        
        this.nodes.push("closer");
        
        // Load the menu border images
        this.border = [];
        var borderIds = [ "top_lft", "top_mid", "top_rt", "lft", "mid", "rt", "btm_lft", "btm_lftb", "btm_rt", "btm_rtb" ];
        dojo.forEach(borderIds, function(id) {
            this.border[id] = dojo.create("img", {
                id: "border_" + id,
                src: "/images/menu/" + id + ".png",
                alt: "pie menu",
                style: "position:absolute; display:none;"
            }, dojo.body());
            
            this.nodes.push("border_" + id);
        }, this);


        var self = this;

        // Hide on Escape
        this.subscriptions.push(bespin.subscribe("ui:escape", function(e) {
            if (this.visible) self.hide();
        }));

        this.connections.push(dojo.connect(window, 'resize', this, this.resize));
        
        this.title = "My Popup";
    },
    
    /**
     * Holder for various settings that we might want to customize
     */
    settings: {
        // How far from the top of the window does the pie go
        canvasTop: 0,
        // How much space do we leave around the opened slices?
        topMargin: 10,
        bottomMargin: 200,
        leftMargin: 60,
        rightMargin: 60
    },

    
    show: function(panel) {
        console.log("Request to show the popup");
        var d = this.calculatePosition();
        this.renderPopout(d);
        this.renderToolbar(d);
        bespin.getComponent("commandLine", function(commandline) {
            console.log("commandline received");
            commandline.showOutput("output", d.centerPanel);
            this.canvas.style.display = 'block';
            this.visible = true;
            console.log("Done showing");
        }, this);
        console.log("Returning from synchronous part");
    },
    
    hide: function() {
        this.canvas.style.display = 'none';
        dojo.style(this.closer, 'display', 'none');
        bespin.getComponent("commandLine", function(cli) {
            cli.hideOutput();
        });
        this.editor.setFocus(true);
        this.visible = false;
    },
    
    /**
     * Calculate slice border positions
     */
    calculatePosition: function() {
        var d = {};

        // Left hand edge of center column. Assumes all LHS graphics are same width
        d.cenLeft = this.settings.leftMargin + this.border.lft.width;
        // Right hand edge of center column. Assumes all RHS graphics are same width
        d.cenRight = this.settings.rightMargin + this.border.rt.width;
        // Width of the center column. Assumes left and right columns graphics are same width
        d.cenWidth = this.canvas.width - d.cenLeft - d.cenRight;
        // Top of bottom row. Determined by height of pie
        d.btmTop = this.canvas.height - this.settings.bottomMargin;
        // Left hand edge of rightmost column. Assumes all RHS graphics are the same width
        d.rightLeft = this.canvas.width - d.cenRight;
        // Top of all middle rows. Assumes all top graphics are same height
        d.midTop = this.settings.topMargin + this.border.top_mid.height;
        // Height of the middle row. Assumes all top graphics are same height
        d.midHeight = d.btmTop - d.midTop;
        // Left hand edge of pie. Determined by width of pie
        d.offLeft = parseInt(this.canvas.width / 2);
        
        // calculate center panel coordinates
        d.centerPanel = {
            l: d.cenLeft - 5, // The LHS image has 5px of transparent
            t: d.midTop + this.settings.canvasTop,
            w: d.cenWidth + 10, // So does the RHS image have 5px
            h: d.midHeight,
            b: this.settings.bottomMargin
        };

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

        // Don't draw the menu area for the 'off' slice
        // Draw top row
        this.ctx.drawImage(this.border.top_lft, this.settings.leftMargin, this.settings.topMargin);
        this.ctx.drawImage(this.border.top_mid, d.cenLeft, this.settings.topMargin, d.cenWidth, this.border.top_mid.height);
        // TODO +4 eh?
        this.ctx.drawImage(this.border.top_rt, d.rightLeft, this.settings.topMargin + 4);

        // Middle row
        this.ctx.drawImage(this.border.lft, this.settings.leftMargin, d.midTop, this.border.lft.width, d.midHeight);
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        this.ctx.drawImage(this.border.rt, d.rightLeft, d.midTop, this.border.rt.width, d.midHeight);

        // Draw the middle bit after so it doesn't get overridden
        // The LHS and RHS both have 5px of inner transparent
        this.ctx.fillRect(d.cenLeft - 5, d.midTop, d.cenWidth + 10, d.midHeight);
        //this.ctx.drawImage(this.border.mid, d.cenLeft, d.midTop, d.cenWidth, d.midHeight);

        // Bottom row
        this.ctx.drawImage(this.border.btm_lft, this.settings.leftMargin, d.btmTop);
        this.ctx.drawImage(this.border.btm_lftb, d.cenLeft, d.btmTop, d.cenWidth, this.border.btm_lftb.height);
        this.ctx.drawImage(this.border.btm_rt, d.rightLeft, d.btmTop);
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
        this.ctx.fillText(this.title, left, top);
        // 50 - Give some extra space after the title
        left = left + this.ctx.measureText(this.title).width + 50;

        // HACK ALERT we should correctly layout from the right rather than
        // this evil fix which only works because only 1 slice has a toolbar
        left = d.rightLeft - 150;

        // 27 is an evil number. Again.
        var toolbarOffsetTop = (this.settings.topMargin + this.settings.canvasTop + 27) + "px";

        // Close Button
        dojo.style(this.closer, {
            display: 'block',
            top: toolbarOffsetTop,
            left: (d.rightLeft - 16) + "px"
        });
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
    }
}});

