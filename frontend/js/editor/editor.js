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

// some state mgmt. for scrollbars; not a true component
var EditorScrollbar = Class.create({
    HORIZONTAL: "horizontal",
    VERTICAL: "vertical",
    MINIMUM_HANDLE_SIZE: 20,

    initialize: function(ui, orientation, rect, value, min, max, extent) {
        this.ui = ui;
        this.orientation = orientation; // "horizontal" or "vertical"
        this.rect = rect;       // position/size of the scrollbar track
        this.value = value;     // current offset value
        this.min = min;         // minimum offset value
        this.max = max;         // maximum offset value
        this.extent = extent;   // size of the current visible subset

        this.mousedownScreenPoint;    // used for scroll bar dragging tracking; point at which the mousedown first occurred
        this.mousedownValue;          // value at time of scroll drag start
    },

    // return a Rect for the scrollbar handle
    getHandleBounds: function() {
        var sx = (this.isH()) ? this.rect.x : this.rect.y;
        var sw = (this.isH()) ? this.rect.w : this.rect.h;

        var smultiple = this.extent / (this.max + this.extent);
        var asw = smultiple * sw;
        if (asw < this.MINIMUM_HANDLE_SIZE) asw = this.MINIMUM_HANDLE_SIZE;

        sx += (sw - asw) * (this.value / (this.max - this.min));

        return (this.isH()) ? new Rect(sx, this.rect.y, asw, this.rect.h) : new Rect(this.rect.x, sx, this.rect.w, asw);
    },

    isH: function() {
        return (!(this.orientation == this.VERTICAL));
    },

    fixValue: function(value) {
        if (value < this.min) value = this.min;
        if (value > this.max) value = this.max;
        return value;
    },

    onmousewheel: function(e) {
        this.setValue(this.value + (e.detail * this.ui.lineHeight));
    },

    onmousedown: function(e) {
        var clientY = e.clientY - this.ui.getTopOffset();
        var clientX = e.clientX - this.ui.getLeftOffset();

        var bar = this.getHandleBounds();
        if (bar.contains({ x: clientX, y: clientY })) {
            this.mousedownScreenPoint = (this.isH()) ? e.screenX : e.screenY;
            this.mousedownValue = this.value;
        } else {
            var p = (this.isH()) ? clientX : clientY;
            var b1 = (this.isH()) ? bar.x : bar.y;
            var b2 = (this.isH()) ? bar.x2 : bar.y2;

            if (p < b1) {
                this.setValue(this.value -= this.extent);
            } else if (p > b2) {
                this.setValue(this.value += this.extent);
            }
        }
    },

    onmouseup: function(e) {
        this.mousedownScreenPoint = null;
        this.mousedownValue = null;
        if (this.valueChanged) this.valueChanged(); // make the UI responsive when the user releases the mouse button (in case arrow no longer hovers over scrollbar)
    },

    onmousemove: function(e) {
        if (this.mousedownScreenPoint) {
            var diff = ((this.isH()) ? e.screenX : e.screenY) - this.mousedownScreenPoint;
            var multiplier = diff / (this.isH() ? this.rect.w : this.rect.h);
            this.setValue(this.mousedownValue + (((this.max + this.extent) - this.min) * multiplier));
        }
    },

    setValue: function(value) {
        this.value = this.fixValue(value);
        if (this.valueChanged) this.valueChanged();
    }
});

// treat as immutable (pretty please)
var Rect = Class.create({
    initialize: function(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.x2 = x + w;
        this.y2 = y + h;
    },

    // inclusive of bounding lines
    contains: function(point) {
        if (!this.x) return false;
        return ((this.x <= point.x) && ((this.x + this.w) >= point.x) && (this.y <= point.y) && ((this.y + this.h) >= point.y));
    }
});

var SelectionHelper = Class.create({
    initialize: function(editor) {
        this.editor = editor;
    },

    // returns an object with the startCol and endCol of the selection. If the col is -1 on the endPos, the selection goes for the entire line
    // returns undefined if the row has no selection
    getRowSelectionPositions: function(rowIndex) {
        var startCol;
        var endCol;

        var selection = this.editor.getSelection();
        if (!selection) return undefined;
        if ((selection.endPos.row < rowIndex) || (selection.startPos.row > rowIndex)) return undefined;

        startCol = (selection.startPos.row < rowIndex) ? 0 : selection.startPos.col;
        endCol = (selection.endPos.row > rowIndex) ? -1 : selection.endPos.col;

        return { startCol: startCol, endCol: endCol }
    }
});

// Utils
var EditorUtils = {
    argsWithPos: function(oldPos) {
        return { pos: EditorUtils.copyPos(oldPos || _editor.cursorPosition) };    
    },
    
    copyPos: function(oldPos) {
        return { row: oldPos.row, col: oldPos.col };
    },

    posEquals: function(pos1, pos2) {
        if (pos1 == pos2) return true;
        if (!pos1 || !pos2) return false;
        return (pos1.col == pos2.col) && (pos1.row == pos2.row);
    },

    diffObjects: function(o1, o2) {
        var diffs = {};

        if (!o1 || !o2) return undefined;
        
        for (var key in o1) {
            if (o2[key]) {
                if (o1[key] != o2[key]) {
                    diffs[key] = o1[key] + " => " + o2[key];
                }
            } else {
                diffs[key] = "o1: " + key + " = " + o1[key];
            }
        }

        for (var key2 in o2) {
            if (!o1[key2]) {
                diffs[key2] = "o2: " + key2 + " = " + o2[key2];
            }
        }
        return diffs;
    }
}

// DefaultEditorKeyListener
var DefaultEditorKeyListener = Class.create({
    initialize: function(editor) {
        this.editor = editor;
        this.actions = editor.ui.actions;
        this.skipKeypress = false;

        this.defaultKeyMap = {};

        // Allow for multiple key maps to be defined
        this.keyMap = this.defaultKeyMap;
    },

    bindKey: function(keyCode, metaKey, ctrlKey, altKey, shiftKey, action) {
        this.defaultKeyMap[[keyCode, metaKey, ctrlKey, altKey, shiftKey]] = 
            (typeof action == "string") ?
                function() { 
                    var toFire = Bespin.Events.toFire(action);
                    document.fire(toFire.name, toFire.args);
                } : action.bind(this.actions);
    },

    bindKeyString: function(modifiers, keyCode, action) {
        var ctrlKey = (modifiers.toUpperCase().indexOf("CTRL") != -1);
        var altKey = (modifiers.toUpperCase().indexOf("ALT") != -1);
        var metaKey = (modifiers.toUpperCase().indexOf("META") != -1) || (modifiers.toUpperCase().indexOf("APPLE") != -1) || (modifiers.toUpperCase().indexOf("CMD") != -1);
        var shiftKey = (modifiers.toUpperCase().indexOf("SHIFT") != -1);
        return this.bindKey(keyCode, metaKey, ctrlKey, altKey, shiftKey, action);
    },

    onkeydown: function(e) {
        // TODO: global to factor out
        if (_commandLine.inCommandLine) return; // in the command line!

        if (e.keyCode == Bespin.Key.J && e.ctrlKey) { // send to command line
            $('command').focus();

            Event.stop(e);
            return false;
        }

        var self = this;
        var args = { event: e, pos: EditorUtils.copyPos(self.editor.cursorPosition) }
        self.skipKeypress = false;
        self.returnValue = false;

        var action = this.keyMap[[e.keyCode, e.metaKey, e.ctrlKey, e.altKey, e.shiftKey]];

        var hasAction = false;

        if (typeof action == "function") {
            hasAction = true;
            action(args);
        }

        if (e.metaKey || e.ctrlKey || e.altKey) {
            self.skipKeypress = true;
            self.returnValue = true;
            if (hasAction) Event.stop(e); // stop going, but allow special strokes to get to the browser
        }

    },

    onkeypress: function(e) {
        // TODO: global to factor out
        if (_commandLine.inCommandLine) return false; // in the command line!
        
        var self = this;
        if (self.skipKeypress) return self.returnValue;

        var args = { event: e, pos: EditorUtils.copyPos(self.editor.cursorPosition) }
        var actions = self.editor.ui.actions;

        // Only allow ascii through
        if ((e.charCode >= 32) && (e.charCode <= 126)) {
          args.newchar = String.fromCharCode(e.charCode);
          actions.insertCharacter(args);
        }

        Event.stop(e);
    }
});

var CanvasShim = Class.create({
    fillText: function(ctx, text, x, y, maxWidth) {
      ctx.fillStyle = ctx.font;
      ctx.fillText(text, x, y, maxWidth);
    }
});

var CanvasShimFF3 = Class.create({
    fillText: function(ctx, text, x, y, maxWidth) {
        // copy ff3 text style property to w3c standard property
        ctx.mozTextStyle = ctx.font;

        // translate to the specified position
        ctx.save();
        ctx.translate(x, y);
        ctx.mozDrawText(text);
        ctx.restore();
    }
});

// EditorUI
var EditorUI = Class.create({
    initialize: function(editor) {
        this.editor = editor;
        this.colorHelper = new DocumentColorHelper(editor);
        this.selectionHelper = new SelectionHelper(editor);
        this.actions = new EditorActions(this.editor);

        this.GUTTER_WIDTH = 54;
        this.LINE_HEIGHT = 23;
        this.GUTTER_INSETS = { top: 0, left: 6, right: 0, bottom: 6 }
        this.LINE_INSETS = { top: 0, left: 5, right: 0, bottom: 6 }
        this.FALLBACK_CHARACTER_WIDTH = 10;
        this.NIB_WIDTH = 15;
        this.NIB_INSETS = { top: this.NIB_WIDTH / 2, left: this.NIB_WIDTH / 2, right: this.NIB_WIDTH / 2, bottom: this.NIB_WIDTH / 2 }
        this.NIB_ARROW_INSETS = { top: 3, left: 3, right: 3, bottom: 5 }

        this.lineHeight;        // reserved for when line height is calculated dynamically instead of with a constant; set first time a paint occurs
        this.charWidth;         // set first time a paint occurs
        this.visibleRows;       // the number of rows visible in the editor; set each time a paint occurs
        this.firstVisibleRow;   // first row that is visible in the editor; set each time a paint occurs
        this.nibup;             // rect
        this.nibdown;           // rect
        this.nibleft;           // rect
        this.nibright;          // rect

        this.selectMouseDownPos;        // position when the user moused down

        this.xoffset = 0;       // number of pixels to translate the canvas for scrolling
        this.yoffset = 0;

        this.showCursor = true;

        this.overXScrollBar = false;
        this.overYScrollBar = false;
        this.hasFocus = false;

        var source = this.editor.container;
        Event.observe(source, "mousemove", this.handleScrollBars.bindAsEventListener(this));
        Event.observe(source, "mouseout", this.handleScrollBars.bindAsEventListener(this));
        Event.observe(source, "click", this.handleScrollBars.bindAsEventListener(this));
        Event.observe(source, "mousedown", this.handleScrollBars.bindAsEventListener(this));

        Event.observe(source, "mousedown", this.mouseDownSelect.bindAsEventListener(this));
        Event.observe(source, "mousemove", this.mouseMoveSelect.bindAsEventListener(this));
        Event.observe(source, "mouseup", this.mouseUpSelect.bindAsEventListener(this));

        // painting optimization state
        this.lastLineCount = 0;
        this.lastCursorPos = null;
        this.lastxoffset = 0;
        this.lastyoffset = 0;

        this.xscrollbar = new EditorScrollbar(this, "horizontal");
        this.xscrollbar.valueChanged = function() {
            this.xoffset = -this.xscrollbar.value;
            this.editor.paint();
        }.bindAsEventListener(this);
        Event.observe(window, "mousemove", function(e) {
            this.xscrollbar.onmousemove(e);
        }.bindAsEventListener(this));
        Event.observe(window, "mouseup", function(e) {
            this.xscrollbar.onmouseup(e);
        }.bindAsEventListener(this));

        this.yscrollbar = new EditorScrollbar(this, "vertical");
        this.yscrollbar.valueChanged = function() {
            this.yoffset = -this.yscrollbar.value;
            this.editor.paint();
        }.bindAsEventListener(this);
        Event.observe(window, "mousemove", function(e) {
            this.yscrollbar.onmousemove(e);
        }.bindAsEventListener(this));
        Event.observe(window, "mouseup", function(e) {
            this.yscrollbar.onmouseup(e);
        }.bindAsEventListener(this));
        Event.observe(window, "DOMMouseScroll", function(e) {
            this.yscrollbar.onmousewheel(e);
        }.bindAsEventListener(this));

        var self = this;
        setTimeout(function() { self.toggleCursor(self) }, 250);
    },

    // col is -1 if user clicked in gutter; clicking below last line maps to last line
    convertClientPointToCursorPoint: function(pos) {
        var x, y;

        if (pos.x <= (this.GUTTER_WIDTH + this.LINE_INSETS.left)) {
            x = -1;
        } else {
            var tx = pos.x - this.GUTTER_WIDTH - this.LINE_INSETS.left;
            x = Math.floor(tx / this.charWidth);
        }

        if (y > (this.lineHeight * this.editor.model.getRowCount())) {
            y = this.editor.model.getRowCount() - 1;
        } else {
            var ty = pos.y;
            y = Math.floor(ty / this.lineHeight);
        }

        return { col: x, row: y };
    },

    mouseDownSelect: function(e) {
        var clientY = e.clientY - this.getTopOffset();
        var clientX = e.clientX - this.getLeftOffset();

        if (this.overXScrollBar || this.overYScrollBar) return;

        if (e.shiftKey) {
            this.selectMouseDownPos = (this.editor.selection) ? this.editor.selection.startPos : this.editor.cursorPosition;
            this.setSelection(e);
        } else {
            var point = { x: clientX, y: clientY };
            point.x += Math.abs(this.xoffset);
            point.y += Math.abs(this.yoffset);

            if ((this.xscrollbar.rect.contains(point)) || (this.yscrollbar.rect.contains(point))) return;
            this.selectMouseDownPos = this.convertClientPointToCursorPoint(point);
        }
    },

    mouseMoveSelect: function(e) {
        this.setSelection(e);
    },

    mouseUpSelect: function(e) {
        this.setSelection(e);
        this.selectMouseDownPos = undefined;
    },

    setSelection: function(e) {
        var clientY = e.clientY - this.getTopOffset();
        var clientX = e.clientX - this.getLeftOffset();

        if (!this.selectMouseDownPos) return;

        var down = EditorUtils.copyPos(this.selectMouseDownPos);

        var point = { x: clientX, y: clientY };
        point.x += Math.abs(this.xoffset);
        point.y += Math.abs(this.yoffset);
        var up = this.convertClientPointToCursorPoint(point);

        if (down.col == -1) down.col = 0;
        if (up.col == -1) up.col = 0;

        if (!EditorUtils.posEquals(down, up)) {
            this.editor.setSelection({ startPos: down, endPos: up });
        } else {
            if (e.detail == 1) {
                this.editor.setSelection(undefined);
            } else if (e.detail == 2) {
                var row = this.editor.model.rows[down.row];
                var cursorAt = row[down.col];
                if (!cursorAt || cursorAt.charAt(0) == ' ') { // empty space
                    // For now, don't select anything, but think about copying Textmate and grabbing around it
                } else {
                    var startPos = up = this.editor.model.findBefore(down.row, down.col);
                    
                    var endPos = this.editor.model.findAfter(down.row, down.col);
                    
                    this.editor.setSelection({ startPos: startPos, endPos: endPos });
                }
            } else if (e.detail > 2) {
                // select the line
                this.editor.setSelection({ startPos: { row: down.row, col: 0 }, endPos: { row: down.row + 1, col: 0 } });
            }
        }

        this.editor.moveCursor(up);
        this.editor.paint();
    },

    toggleCursor: function(ui) {
        ui.showCursor = !ui.showCursor;
        ui.editor.paint();
        setTimeout(function() { ui.toggleCursor(ui) }, 250);
    },

    ensureCursorVisible: function() {
        if ((!this.lineHeight) || (!this.charWidth)) return;    // can't do much without these

        var y = this.lineHeight * this.editor.cursorPosition.row;
        var x = this.charWidth * this.editor.cursorPosition.col;

        var cheight = this.getHeight();
        var cwidth = this.getWidth() - this.GUTTER_WIDTH;

        if (Math.abs(this.yoffset) > y) {               // current row before top-most visible row
            this.yoffset = -y;
        } else if ((Math.abs(this.yoffset) + cheight) < (y + this.lineHeight)) {       // current row after bottom-most visible row
            this.yoffset = -((y + this.lineHeight) - cheight);
        }

        if (Math.abs(this.xoffset) > x) {               // current col before left-most visible col
            this.xoffset = -x;
        } else if ((Math.abs(this.xoffset) + cwidth) < (x + (this.charWidth * 2))) { // current col after right-most visible col
            this.xoffset = -((x + (this.charWidth * 2)) - cwidth);
        }
    },

    handleFocus: function(e) {
        this.editor.model.clear();
        this.editor.model.insertCharacters({ row: 0, col: 0}, e.type);
    },
    
    handleScrollBars: function(e) {
        var clientY = e.clientY - this.getTopOffset();
        var clientX = e.clientX - this.getLeftOffset();

        var oldX = this.overXScrollBar;
        var oldY = this.overYScrollBar;
        var scrolled = false;

        var w = this.editor.container.clientWidth;
        var h = this.editor.container.clientHeight;
        var sx = w - this.NIB_WIDTH - this.NIB_INSETS.right;    // x start of the vert. scroll bar
        var sy = h - this.NIB_WIDTH - this.NIB_INSETS.bottom;   // y start of the hor. scroll bar

        var p = { x: clientX, y:clientY };

        if (e.type == "mousedown") {
            // dispatch to the scrollbars
            if ((this.xscrollbar) && (this.xscrollbar.rect.contains(p))) {
                this.xscrollbar.onmousedown(e);
            } else if ((this.yscrollbar) && (this.yscrollbar.rect.contains(p))) {
                this.yscrollbar.onmousedown(e);
            }
        }

        if (e.type == "mouseout") {
            this.overXScrollBar = false;
            this.overYScrollBar = false;
        }

        if ((e.type == "mousemove") || (e.type == "click")) {
            this.overYScrollBar = p.x > sx;
            this.overXScrollBar = p.y > sy;
        }

        if (e.type == "click") {
            if (Event.isLeftClick(e)) {

                var button;
                if (this.nibup.contains(p)) {
                    button = "up";
                } else if (this.nibdown.contains(p)) {
                    button = "down";
                } else if (this.nibleft.contains(p)) {
                    button = "left";
                } else if (this.nibright.contains(p)) {
                    button = "right";
                }

                if (button == "up") {
                    this.yoffset += this.lineHeight;
                    scrolled = true;
                } else if (button == "down") {
                    this.yoffset -= this.lineHeight;
                    scrolled = true;
                } else if (button == "left") {
                    this.xoffset += this.charWidth * 2;
                    scrolled = true;
                } else if (button == "right") {
                    this.xoffset -= this.charWidth * 2;
                    scrolled = true;
                }
            }
        }

        if ((oldX != this.overXScrollBar) || (oldY != this.overYScrollBar) || scrolled) this.editor.paint();
    },

    installKeyListener: function(listener) {
        var Key = Bespin.Key; // alias

        if (this.oldkeydown) Event.stopObserving(document, "keydown", this.oldkeydown);
        if (this.oldkeypress) Event.stopObserving(document, "keypress", this.oldkeypress);

        this.oldkeydown = listener.onkeydown.bindAsEventListener(listener);
        this.oldkeypress = listener.onkeypress.bindAsEventListener(listener);

        Event.observe(document, "keydown", this.oldkeydown);
        Event.observe(document, "keypress", this.oldkeypress);

        // Keycode, Meta, Control, Action
        // TODO: forward/backwards a word, kill entire line, kill to end of line
        listener.bindKeyString("", Key.ARROW_LEFT, this.actions.moveCursorLeft);
        listener.bindKeyString("", Key.ARROW_RIGHT, this.actions.moveCursorRight);
        listener.bindKeyString("", Key.ARROW_UP, this.actions.moveCursorUp);
        listener.bindKeyString("", Key.ARROW_DOWN, this.actions.moveCursorDown);
        listener.bindKeyString("SHIFT", Key.ARROW_LEFT, this.actions.moveCursorLeft);
        listener.bindKeyString("SHIFT", Key.ARROW_RIGHT, this.actions.moveCursorRight);
        listener.bindKeyString("SHIFT", Key.ARROW_UP, this.actions.moveCursorUp);
        listener.bindKeyString("SHIFT", Key.ARROW_DOWN, this.actions.moveCursorDown);
        listener.bindKeyString("APPLE", Key.ARROW_LEFT, this.actions.moveWordLeft);
        listener.bindKeyString("APPLE", Key.ARROW_RIGHT, this.actions.moveWordRight);

        listener.bindKeyString("", Key.BACKSPACE, this.actions.backspace);

        listener.bindKeyString("", Key.HOME, this.actions.moveToLineStart);
        listener.bindKeyString("", Key.END, this.actions.moveToLineEnd);
        listener.bindKeyString("SHIFT", Key.HOME, this.actions.moveToLineStart);
        listener.bindKeyString("SHIFT", Key.END, this.actions.moveToLineEnd);

        listener.bindKeyString("", Key.DELETE, this.actions.deleteKey);
        listener.bindKeyString("", Key.ENTER, this.actions.newline);

        listener.bindKeyString("", Key.TAB, this.actions.insertTab);

        listener.bindKeyString("APPLE", Key.A, this.actions.selectAll);
        listener.bindKeyString("CTRL", Key.A, this.actions.selectAll);

        listener.bindKeyString("APPLE", Key.Z, this.actions.undoRedo);
        listener.bindKeyString("CTRL", Key.Z, this.actions.undoRedo);

        listener.bindKeyString("APPLE", Key.C, this.actions.copySelection);
        listener.bindKeyString("CTRL", Key.C, this.actions.copySelection);

        listener.bindKeyString("APPLE", Key.V, this.actions.pasteFromClipboard);
        listener.bindKeyString("CTRL", Key.V, this.actions.pasteFromClipboard);

        listener.bindKeyString("APPLE", Key.X, this.actions.cutSelection);
        listener.bindKeyString("CTRL", Key.X, this.actions.cutSelection);

        listener.bindKeyString("APPLE", Key.ARROW_UP, this.actions.moveToFileTop);
        listener.bindKeyString("APPLE", Key.ARROW_DOWN, this.actions.moveToFileBottom);
        
        listener.bindKeyString("", Key.PAGE_UP, this.actions.movePageUp);
        listener.bindKeyString("", Key.PAGE_DOWN, this.actions.movePageDown);

        // Other key bindings can be found in commands themselves.
        // For example, this:
        // listener.bindKeyString("CTRL SHIFT", Key.N, "bespin:editor:newfile");
        // has been moved to the 'newfile' command withKey
    },

    getWidth: function() {
        var element = this.editor.canvas.parentNode;
        return parseInt(element.getAttribute("width"));
    },

    getHeight: function() {
        var element = this.editor.canvas.parentNode;
        return parseInt(element.getAttribute("height"));
    },

    getTopOffset: function() {
        return this.editor.canvas.parentNode.offsetTop;
    },

    getLeftOffset: function() {
        return this.editor.canvas.parentNode.offsetLeft;
    },

    getCharWidth: function(ctx) {
        if (ctx.measureText) {
            return ctx.measureText("M").width;
        } else if (ctx.mozMeasureText) {
            return ctx.mozMeasureText("M");
        } else {
            return this.FALLBACK_CHARACTER_WIDTH;
        }
    },

    paint: function(ctx) {
        if (!this.canvasShim) {
            if (ctx.mozDrawText) { // FF3
                this.canvasShim = new CanvasShimFF3();
            } else {
                this.canvasShim = new CanvasShim(); // native support
            }
        }

        var c = $(this.editor.canvas);
        var theme = this.editor.theme;
        var ed = this.editor;
        var x, y;
        var cy;
        var currentLine;
        var lastLineToRender;

        var refreshCanvas = (this.lastLineCount != ed.model.getRowCount());
        this.lastLineCount = ed.model.getRowCount();

        // character width

        var charWidth = this.getCharWidth(ctx);
        this.charWidth = charWidth;
        var lineHeight = this.LINE_HEIGHT; // temporarily reading from constant; should be calc'd at some point
        this.lineHeight = lineHeight;

        // ensure the canvas is the right size
        var cwidth = this.getWidth();
        var cheight = this.getHeight();

        var virtualheight = lineHeight * ed.model.getRowCount();    // full height based on content
        var virtualwidth = charWidth * (Math.max(ed.model.getMaxCols(), ed.cursorPosition.col) + 2);       // full width based on content plus a little padding

        // adjust the scrolling offsets if necessary
        if (this.xoffset > 0) this.xoffset = 0; // no need to ever scroll into negative margins
        if (this.yoffset > 0) this.yoffset = 0;

        if ((this.xoffset != this.lastxoffset) || (this.yoffset != this.lastyoffset)) {
            refreshCanvas = true;
            this.lastxoffset = this.xoffset;
            this.lastyoffset = this.yoffset;
        }

        if (this.xoffset < 0) {
            if ((Math.abs(this.xoffset)) > (virtualwidth - (cwidth - this.GUTTER_WIDTH))) this.xoffset = (cwidth - this.GUTTER_WIDTH) - virtualwidth;       // make sure we don't scroll too far
        }

        if (this.yoffset < 0) {
            if ((Math.abs(this.yoffset)) > (virtualheight - cheight)) this.yoffset = cheight - virtualheight;
        }

        var xscroll = ((cwidth - this.GUTTER_WIDTH) < virtualwidth);
        var yscroll = (cheight < virtualheight);

        var showLeftScrollNib = (xscroll && (this.xoffset != 0));
        var showRightScrollNib = (xscroll && (this.xoffset > ((cwidth - this.GUTTER_WIDTH) - virtualwidth)));
        var showUpScrollNib = (yscroll && (this.yoffset != 0));
        var showDownScrollNib = (yscroll && (this.yoffset > (cheight - virtualheight)));

        if (((c.readAttribute("width")) != cwidth) || (c.readAttribute("height") != cheight)) {
            refreshCanvas = true;
            c.writeAttribute({ width: cwidth, height: cheight });
        }

        // temporary forced redraw until scrollbars are optimized
        refreshCanvas = true;

        if (!refreshCanvas) {
            var dirty = ed.model.getDirtyRows();

            if (this.lastCursorPos) {
                if (this.lastCursorPos.row != ed.cursorPosition.row) dirty[this.lastCursorPos.row] = true;
            }
            dirty[ed.cursorPosition.row] = true;    // we always repaint the current line
        }
        this.lastCursorPos = EditorUtils.copyPos(ed.cursorPosition);

        if (refreshCanvas) {
            // paint the background
            ctx.fillStyle = theme.backgroundStyle;
            ctx.fillRect(0, 0, c.width, c.height);

            // paint the gutter
            ctx.fillStyle = theme.gutterStyle;
            ctx.fillRect(0, 0, this.GUTTER_WIDTH, c.height);
        }

        ctx.font = theme.lineNumberFont;

        // scrollbars - y axis
        ctx.save();
        ctx.translate(0, this.yoffset);

        // only paint those lines that can be visible
        this.visibleRows = Math.ceil(cheight / lineHeight);
        this.firstVisibleRow = Math.floor(Math.abs(this.yoffset / lineHeight));
        lastLineToRender = this.firstVisibleRow + this.visibleRows;
        if (lastLineToRender > (ed.model.getRowCount() - 1)) lastLineToRender = ed.model.getRowCount() - 1;

        // paint the line numbers
        if (refreshCanvas) {
            y = (lineHeight * this.firstVisibleRow);
            for (currentLine = this.firstVisibleRow; currentLine <= lastLineToRender; currentLine++) {
                x = this.GUTTER_INSETS.left;
                cy = y + (lineHeight - this.LINE_INSETS.bottom);

                ctx.fillStyle = theme.lineNumberColor;
                this.canvasShim.fillText(ctx, currentLine + 1, x, cy);

                y += lineHeight;
            }
        }

        // scroll bars - x axis
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.GUTTER_WIDTH, -this.yoffset, cwidth - this.GUTTER_WIDTH, cheight);
        ctx.closePath();
        ctx.translate(this.xoffset, 0);
        ctx.clip();

        var firstColumn = Math.floor(Math.abs(this.xoffset / this.charWidth));
        var lastColumn = firstColumn + (Math.ceil((cwidth - this.GUTTER_WIDTH) / this.charWidth));

        // paint the line content and zebra stripes (kept in separate loop to simplify scroll translation and clipping)
        y = (lineHeight * this.firstVisibleRow);
        var cc; // the starting column of the current region in the region render loop below
        var ce; // the ending column in the same loop
        var ri; // counter variable used for the same loop
        var regionlen;  // length of the text in the region; used in the same loop
        var tx, tw;
        for (currentLine = this.firstVisibleRow; currentLine <= lastLineToRender; currentLine++) {
            x = this.GUTTER_WIDTH;

            if (!refreshCanvas) {
                if (!dirty[currentLine]) {
                    y += lineHeight;
                    continue;
                }

                if ((currentLine % 2) == 1) { // only repaint the line if the zebra stripe won't beat us to it
                    ctx.fillStyle = theme.backgroundStyle;
                    ctx.fillRect(x + (Math.abs(this.xoffset)), y, cwidth, lineHeight);
                }
            }

            if ((currentLine % 2) == 0) {
                ctx.fillStyle = theme.zebraStripeColor;
                ctx.fillRect(x + (Math.abs(this.xoffset)), y, cwidth, lineHeight);
            }

            x += this.LINE_INSETS.left;
            cy = y + (lineHeight - this.LINE_INSETS.bottom);

            // paint the selection bar if necessary
            var selections = this.selectionHelper.getRowSelectionPositions(currentLine);
            if (selections) {
                tx = x + (selections.startCol * this.charWidth);
                tw = (selections.endCol == -1) ? (lastColumn - firstColumn) * this.charWidth : (selections.endCol - selections.startCol) * this.charWidth;
                ctx.fillStyle = theme.editorSelectedTextBackground;
                ctx.fillRect(tx, y, tw, lineHeight);
            }


            cc = 0;
            ce = 0;
            var regions = this.colorHelper.getLineRegions(currentLine);
            for (ri = 0; ri < regions.length; ri++) {
                if (cc > lastColumn) break;

                regionlen = regions[ri].text.length;
                ce = cc + regionlen;
                if (ce >= firstColumn) {
                    ctx.fillStyle = regions[ri].style;
                    this.canvasShim.fillText(ctx, regions[ri].text, x, cy);
                }

                x += regionlen * this.charWidth;
                cc = ce;
            }

            y += lineHeight;
        }

        // paint the cursor
        if (this.editor.focus) {
            if (this.showCursor) {
                if (ed.theme.cursorType == "underline") {
                    x = this.GUTTER_WIDTH + this.LINE_INSETS.left + ed.cursorPosition.col * charWidth;
                    y = (ed.cursorPosition.row * lineHeight) + (lineHeight - 5);
                    ctx.fillStyle = ed.theme.cursorStyle;
                    ctx.fillRect(x, y, charWidth, 3);
                } else {
                    x = this.GUTTER_WIDTH + this.LINE_INSETS.left + ed.cursorPosition.col * charWidth;
                    y = (ed.cursorPosition.row * lineHeight);
                    ctx.fillStyle = ed.theme.cursorStyle;
                    ctx.fillRect(x, y, 1, lineHeight);
                }
            }
        } else {
            x = this.GUTTER_WIDTH + this.LINE_INSETS.left + ed.cursorPosition.col * charWidth;
            y = (ed.cursorPosition.row * lineHeight);
            ctx.fillStyle = ed.theme.unfocusedCursorFillStyle;
            ctx.strokeStyle = ed.theme.unfocusedCursorStrokeStyle;
            ctx.fillRect(x, y, charWidth, lineHeight);
            ctx.strokeRect(x, y, charWidth, lineHeight);
        }

        // scroll bars - x axis
        ctx.restore();

        // scrollbars - y axis
        ctx.restore();

        // paint scroll bars

        // temporary disable of scrollbars
        //if (this.xscrollbar.rect) return;

        var ythemes = (this.overYScrollBar) || (this.yscrollbar.mousedownValue != null) ?
                      { n: ed.theme.fullNibStyle, a: ed.theme.fullNibArrowStyle, s: ed.theme.fullNibStrokeStyle } :
                      { n: ed.theme.partialNibStyle, a: ed.theme.partialNibArrowStyle, s: ed.theme.partialNibStrokeStyle };
        var xthemes = (this.overXScrollBar) || (this.xscrollbar.mousedownValue != null) ?
                      { n: ed.theme.fullNibStyle, a: ed.theme.fullNibArrowStyle, s: ed.theme.fullNibStrokeStyle } :
                      { n: ed.theme.partialNibStyle, a: ed.theme.partialNibArrowStyle, s: ed.theme.partialNibStrokeStyle };

        var midpoint = Math.floor(this.NIB_WIDTH / 2);

        this.nibup = new Rect(cwidth - this.NIB_INSETS.right - this.NIB_WIDTH,
                this.NIB_INSETS.top, this.NIB_WIDTH, this.NIB_WIDTH);

        this.nibdown = new Rect(cwidth - this.NIB_INSETS.right - this.NIB_WIDTH,
                cheight - (this.NIB_WIDTH * 2) - (this.NIB_INSETS.bottom * 2),
                this.NIB_INSETS.top,
                this.NIB_WIDTH, this.NIB_WIDTH);

        this.nibleft = new Rect(this.GUTTER_WIDTH + this.NIB_INSETS.left, cheight - this.NIB_INSETS.bottom - this.NIB_WIDTH,
                this.NIB_WIDTH, this.NIB_WIDTH);

        this.nibright = new Rect(cwidth - (this.NIB_INSETS.right * 2) - (this.NIB_WIDTH * 2),
                cheight - this.NIB_INSETS.bottom - this.NIB_WIDTH,
                this.NIB_WIDTH, this.NIB_WIDTH);

        if (xscroll && ((this.overXScrollBar) || (this.xscrollbar.mousedownValue != null))) {
            ctx.save();

            ctx.beginPath();
            ctx.rect(this.nibleft.x + midpoint + 2, 0, this.nibright.x - this.nibleft.x - 1, cheight); // y points don't matter
            ctx.closePath();
            ctx.clip();

            ctx.fillStyle = ed.theme.scrollTrackFillStyle;
            ctx.fillRect(this.nibleft.x, this.nibleft.y - 1, this.nibright.x2 - this.nibleft.x, this.nibleft.h + 1);

            ctx.strokeStyle = ed.theme.scrollTrackStrokeStyle;
            ctx.strokeRect(this.nibleft.x, this.nibleft.y - 1, this.nibright.x2 - this.nibleft.x, this.nibleft.h + 1);

            ctx.restore();
        }

        if (yscroll && ((this.overYScrollBar) || (this.yscrollbar.mousedownValue != null))) {
            ctx.save();

            ctx.beginPath();
            ctx.rect(0, this.nibup.y + midpoint + 2, cwidth, this.nibdown.y - this.nibup.y - 1); // x points don't matter
            ctx.closePath();
            ctx.clip();

            ctx.fillStyle = ed.theme.scrollTrackFillStyle;
            ctx.fillRect(this.nibup.x - 1, this.nibup.y, this.nibup.w + 1, this.nibdown.y2 - this.nibup.y);

            ctx.strokeStyle = ed.theme.scrollTrackStrokeStyle;
            ctx.strokeRect(this.nibup.x - 1, this.nibup.y, this.nibup.w + 1, this.nibdown.y2 - this.nibup.y);

            ctx.restore();
        }

        if (yscroll) {
            // up arrow
            if ((showUpScrollNib) || (this.overYScrollBar) || (this.yscrollbar.mousedownValue != null)) {
                ctx.save();
                ctx.translate(this.nibup.x + midpoint, this.nibup.y + midpoint);
                this.paintNib(ctx, ythemes.n, ythemes.a, ythemes.s);
                ctx.restore();
            }

            // down arrow
            if ((showDownScrollNib) || (this.overYScrollBar) || (this.yscrollbar.mousedownValue != null)) {
                ctx.save();
                ctx.translate(this.nibdown.x + midpoint, this.nibdown.y + midpoint);
                ctx.rotate(Math.PI);
                this.paintNib(ctx, ythemes.n, ythemes.a, ythemes.s);
                ctx.restore();
            }
        }

        if (xscroll) {
            // left arrow
            if ((showLeftScrollNib) || (this.overXScrollBar) || (this.xscrollbar.mousedownValue != null)) {
                ctx.save();
                ctx.translate(this.nibleft.x + midpoint, this.nibleft.y + midpoint);
                ctx.rotate(Math.PI * 1.5);
                this.paintNib(ctx, xthemes.n, xthemes.a, xthemes.s);
                ctx.restore();
            }

            // right arrow
            if ((showRightScrollNib) || (this.overXScrollBar) || (this.xscrollbar.mousedownValue != null)) {
                ctx.save();
                ctx.translate(this.nibright.x + midpoint, this.nibright.y + midpoint);
                ctx.rotate(Math.PI * 0.5);
                this.paintNib(ctx, xthemes.n, xthemes.a, xthemes.s);
                ctx.restore();
            }
        }

        // the bar
        var sx = this.nibleft.x2 + 4;
        var sw = this.nibright.x - this.nibleft.x2 - 9;
        this.xscrollbar.rect = new Rect(sx, this.nibleft.y - 1, sw, this.nibleft.h + 1);
        this.xscrollbar.value = -this.xoffset;
        this.xscrollbar.min = 0;
        this.xscrollbar.max = virtualwidth - (cwidth - this.GUTTER_WIDTH);
        this.xscrollbar.extent = cwidth - this.GUTTER_WIDTH;

        if (xscroll) {
            var fullonxbar = (((this.overXScrollBar) && (virtualwidth > cwidth)) || ((this.xscrollbar) && (this.xscrollbar.mousedownValue != null)));
            if (!fullonxbar) ctx.globalAlpha = 0.3;
            this.paintScrollbar(ctx, this.xscrollbar);
            ctx.globalAlpha = 1.0;
        }

        var sy = this.nibup.y2 + 4;
        var sh = this.nibdown.y - this.nibup.y2 - 9;
        this.yscrollbar.rect = new Rect(this.nibup.x - 1, sy, this.nibup.w + 1, sh);
        this.yscrollbar.value = -this.yoffset;
        this.yscrollbar.min = 0;
        this.yscrollbar.max = virtualheight - cheight;
        this.yscrollbar.extent = cheight;

        if (yscroll) {
            var fullonybar = ((this.overYScrollBar) && (virtualheight > cheight)) || ((this.yscrollbar) && (this.yscrollbar.mousedownValue != null));
            if (!fullonybar) ctx.globalAlpha = 0.3;
            this.paintScrollbar(ctx, this.yscrollbar);
            ctx.globalAlpha = 1;
        }

        // clear the unusued nibs
        if (!showUpScrollNib) this.nibup = new Rect();
        if (!showDownScrollNib) this.nibdown = new Rect();
        if (!showLeftScrollNib) this.nibleft = new Rect();
        if (!showRightScrollNib) this.nibright = new Rect();
    },

    paintScrollbar: function(ctx, scrollbar) {
        var bar = scrollbar.getHandleBounds();
        var alpha = (ctx.globalAlpha) ? ctx.globalAlpha : 1;

        if (!scrollbar.isH()) {
            ctx.save();
            ctx.translate(bar.x + (bar.w / 2), bar.y + (bar.h / 2));
            ctx.rotate(Math.PI * 1.5);
            ctx.translate(-(bar.x + (bar.w / 2)), -(bar.y + (bar.h / 2)));

            // if we're vertical, the bar needs to be re-worked a bit
            bar = new Rect(bar.x - (bar.h / 2) + (bar.w / 2), bar.y + (bar.h / 2) - (bar.w / 2), bar.h, bar.w);
        }

        var halfheight = bar.h / 2;

        ctx.beginPath();
        ctx.arc(bar.x + halfheight, bar.y + halfheight, halfheight, Math.PI / 2, 3 * (Math.PI / 2), false);
        ctx.arc(bar.x2 - halfheight, bar.y + halfheight, halfheight, 3 * (Math.PI / 2), Math.PI / 2, false);
        ctx.lineTo(bar.x + halfheight, bar.y + bar.h);
        ctx.closePath();

        var gradient = ctx.createLinearGradient(bar.x, bar.y, bar.x, bar.y + bar.h);
        gradient.addColorStop(0, this.editor.theme.scrollBarFillGradientTopStart.sub("%a", alpha));
        gradient.addColorStop(0.4, this.editor.theme.scrollBarFillGradientTopStop.sub("%a", alpha));
        gradient.addColorStop(0.41, this.editor.theme.scrollBarFillStyle.sub("%a", alpha));
        gradient.addColorStop(0.8, this.editor.theme.scrollBarFillGradientBottomStart.sub("%a", alpha));
        gradient.addColorStop(1, this.editor.theme.scrollBarFillGradientBottomStop.sub("%a", alpha));
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.save();
        ctx.clip();

        ctx.fillStyle = this.editor.theme.scrollBarFillStyle.sub("%a", alpha);
        ctx.beginPath();
        ctx.moveTo(bar.x + (halfheight * 0.4), bar.y + (halfheight * 0.6));
        ctx.lineTo(bar.x + (halfheight * 0.9), bar.y + (bar.h * 0.4));
        ctx.lineTo(bar.x, bar.y + (bar.h * 0.4));
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(bar.x + bar.w - (halfheight * 0.4), bar.y + (halfheight * 0.6));
        ctx.lineTo(bar.x + bar.w - (halfheight * 0.9), bar.y + (bar.h * 0.4));
        ctx.lineTo(bar.x + bar.w, bar.y + (bar.h * 0.4));
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        ctx.beginPath();
        ctx.arc(bar.x + halfheight, bar.y + halfheight, halfheight, Math.PI / 2, 3 * (Math.PI / 2), false);
        ctx.arc(bar.x2 - halfheight, bar.y + halfheight, halfheight, 3 * (Math.PI / 2), Math.PI / 2, false);
        ctx.lineTo(bar.x + halfheight, bar.y + bar.h);
        ctx.closePath();

        ctx.strokeStyle = this.editor.theme.scrollTrackStrokeStyle;
        ctx.stroke();

        if (!scrollbar.isH()) {
            ctx.restore();
        }
    },

    paintNib: function(ctx, nibStyle, arrowStyle, strokeStyle) {
        var midpoint = Math.floor(this.NIB_WIDTH / 2);

        ctx.fillStyle = nibStyle;
        ctx.beginPath();
        ctx.arc(0, 0, this.NIB_WIDTH / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = strokeStyle;
        ctx.stroke();

        ctx.fillStyle = arrowStyle;
        ctx.beginPath();
        ctx.moveTo(0, -midpoint + this.NIB_ARROW_INSETS.top);
        ctx.lineTo(-midpoint + this.NIB_ARROW_INSETS.left, midpoint - this.NIB_ARROW_INSETS.bottom);
        ctx.lineTo(midpoint - this.NIB_ARROW_INSETS.right, midpoint - this.NIB_ARROW_INSETS.bottom);
        ctx.closePath();
        ctx.fill();
    }
});

// Editor
var Editor = Class.create({
    initialize: function(container) {
        this.container = container;
        this.model = new DocumentModel();

        $(container).innerHTML = "<canvas id='canvas' tabindex='-1'></canvas>";
        this.canvas = $(container).childElements()[0];

        this.ui = new EditorUI(this);
        this.theme = Themes.coffee;
        this.cursorPosition = { row: 0, col: 0 }
        this.selection;
        this.editorKeyListener = new DefaultEditorKeyListener(this);
        this.undoManager = new EditorUndoManager(this);
        this.customEvents = new EditorCustomEvents(this);

        this.ui.installKeyListener(this.editorKeyListener);

        this.model.insertCharacters({row: 0, col: 0}, " ");

        var self = this;
        Event.observe(this.canvas, "blur", function(e) { self.setFocus(false); });
        Event.observe(this.canvas, "focus", function(e) { self.setFocus(true); });

        this.paint();
    },

    moveCursor: function(newpos) {
        this.cursorPosition = { row: newpos.row, col: newpos.col };
    },

    // ensures that the start position is before the end position; reading directly from the selection property makes no such guarantee
    getSelection: function() {
        if (!this.selection) return undefined;

        var startPos = this.selection.startPos;
        var endPos = this.selection.endPos;

        // ensure that the start position is always before than the end position
        if ((endPos.row < startPos.row) || ((endPos.row == startPos.row) && (endPos.col < startPos.col))) {
            var foo = startPos;
            startPos = endPos;
            endPos = foo;
        }

        return { startPos: EditorUtils.copyPos(startPos), endPos: EditorUtils.copyPos(endPos) }
    },

    setSelection: function(selection) {
        this.selection = selection;
        if (this.undoManager.syncHelper) this.undoManager.syncHelper.queueSelect(selection);
    },

    paint: function() {
        var ctx = this.canvas.getContext("2d");
        this.ui.paint(ctx);
    },

    changeKeyListener: function(newKeyListener) {
        this.ui.installKeyListener(newKeyListener);
        this.editorKeyListener = newKeyListener;
    },

    // this does not set focus to the editor; it indicates that focus has been set to the underlying canvas
    setFocus: function(focus) {
        this.focus = focus;
    }
});

var EditorCustomEvents = Class.create({
    initialize: function(editor) {
        this.editor = editor;

        document.observe("bespin:editor:openfile:opensuccess", function(event) {
            var file = event.memo.file;

            editor.model.insertDocument(file.content);
            editor.moveCursor({ row: 0, col: 0 });
        });

        // -- fire an event here and you can run any editor action
        document.observe("bespin:editor:doaction", function(event) {
            var action = event.memo.action;
            var args   = event.memo.args || EditorUtils.argsWithPos();

            if (action) editor.ui.actions[action](args);
        });

        // -- fire an event to setup any new or replace actions
        document.observe("bespin:editor:setaction", function(event) {
            var action = event.memo.action;
            var code   = event.memo.code;
            if (action && Object.isFunction(code)) editor.ui.actions[action] = code;
        });

        // -- add key listeners
        // e.g. bindkey ctrl b moveCursorLeft
        document.observe("bespin:editor:bindkey", function(event) {
            var modifiers = event.memo.modifiers || '';
            if (!event.memo.key) return;

            var keyCode = Bespin.Key[event.memo.key.toUpperCase()];

            // -- try an editor action first, else fire away at the event bus
            var action = editor.ui.actions[event.memo.action] || event.memo.action;

            if (keyCode && action) {
                editor.editorKeyListener.bindKeyString(modifiers, keyCode, action);
            }
        });

    }
});
