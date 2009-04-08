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
dojo.provide("bespin.editor.cursor");

// ** {{{ bespin.editor.CursorManager }}} **
//
// Handles the position of the cursor, hiding the complexity of translating between screen and model positions and so forth
dojo.declare("bespin.editor.CursorManager", null, {
    constructor: function(editor) {
        this.editor = editor;
        this.position = { row: 0, col: 0 };
        this.virtualCol = 0;
    },

    // Returns 'this.position' or 'pos' from optional input 'modelPos'
    getCursorPosition: function(modelPos) {
        if (modelPos != undefined) {
            var pos = bespin.editor.utils.copyPos(modelPos);
            var line = this.editor.model.getRowArray(pos.row);
            var tabsize = this.editor.getTabSize();

            // Special tab handling
            if (line.indexOf("\t") != -1) {
//              console.log( 'Cursor modelPos.col/pos.col begin: ', modelPos.col, pos.col );
                var tabs = 0, nottabs = 0;

                for (var i = 0; i < modelPos.col; i++) {
                    if (line[i] == "\t") {
                        pos.col += tabsize - 1 - ( nottabs % tabsize );
                        tabs++;
                        nottabs = 0;
                    } else {
                        nottabs++;
                        tabs = 0;
                    }
//                  console.log( 'tabs: ' + tabs, 'nottabs: ' + nottabs, 'pos.col: ' + pos.col );
                }

//              console.log( 'Cursor modelPos.col/pos.col end: ' + modelPos.col, pos.col );
            }

            return pos;
        } else {
            return this.position;
        }
    },

    // Returns 'modelPos' from optional input 'pos' or 'this.position'
    getModelPosition: function(pos) {
        pos = (pos != undefined) ? pos : this.position;
        var modelPos = bespin.editor.utils.copyPos(pos);
        var line = this.editor.model.getRowArray(pos.row);
        var tabsize = this.editor.getTabSize();

        // Special tab handling
        if (line.indexOf("\t") != -1) {
//          console.log( 'Model modelPos.col/pos.col begin: ', modelPos.col, pos.col );
            var tabs = 0, nottabs = 0;

            for (var i = 0; i < modelPos.col; i++) {
                if (line[i] == "\t") {
                    modelPos.col -= tabsize - 1 - ( nottabs % tabsize );
                    tabs++;
                    nottabs = 0;
                } else {
                    nottabs++;
                    tabs = 0;
                }
//              console.log( 'tabs: ' + tabs, 'nottabs: ' + nottabs, 'modelPos.col: ' + modelPos.col );
            }

//          console.log( 'Model modelPos.col/pos.col end: ' + modelPos.col, pos.col );
        }

        return modelPos;
    },
    
    getCharacterLength: function(character, column) {
        if (character.length > 1) return;
        if (column == undefined) column = this.position.col;
        if (character == "\t") {
            var tabsize = this.editor.getTabSize();
            return (tabsize - (column % tabsize));
        } else {
            return 1;
        }
    },

    // Returns the length of a given string. This takes '\t' in account!
    getStringLength: function(str) {
        if (!str || str.length == 0) return 0;
        var count = 0;
        str = str.split("");
        for (var x = 0; x < str.length; x++) {
            count += this.getCharacterLength(str[x], count);
        }
        return count;
    },
    
    // returns the numbers of white spaces from the beginning of the line
    // tabs are counted as whitespace
    getLeadingWhitespace: function(rowIndex) {
        var row = this.editor.model.getRowArray(rowIndex).join("");
        var match = /^(\s+).*/.exec(row);
        return (match && match.length == 2 ? this.getStringLength(match[1]) : 0);
    },
    
    // Returns the numbers of white spaces (NOT '\t'!!!) in a row
    // if the string between <from> and <to> is "  ab     " this will give you 2, as
    // there are 2 white spaces together from the beginning
    getContinuousSpaceCount: function(from, to, rowIndex) {
        rowIndex = rowIndex || this.position.row;
        var settings = bespin.get('settings');
        var row = this.editor.model.getRowArray(rowIndex);
        var delta = (from < to ? 1 : -1);
        var length = row.length;
        from = from + (delta == 1 ? 0 : -1);
        to = to + (delta == 1 ? 0 : -1);
        from = this.getModelPosition({col: from, row: rowIndex}).col;
        to = this.getModelPosition({col: to, row: rowIndex}).col;
        if (settings && settings.isSettingOn('strictlines')) {
            from = Math.min(from, length);
            to = Math.min(to, length);            
        }
        var count = 0;
        for (var x = from; x != to; x += delta) {
            if (x < length) {
                if (row[x] != ' ') {
                    break;
                }   
            }
            count++;
        }
        return count;
    },
    
    getNextTablevelLeft: function(col) {
        var tabsize = this.editor.getTabSize();
        col = col || this.position.col;
        col--;
        return Math.floor(col / tabsize) * tabsize;
    },
    
    getNextTablevelRight: function(col) {
        var tabsize = this.editor.getTabSize();
        col = col || this.position.col;
        col++;
        return Math.ceil(col / tabsize) * tabsize;
    },

    moveToLineStart: function() {
        var oldPos = bespin.editor.utils.copyPos(this.position);
        var leadingWhitespaceLength = this.getLeadingWhitespace(oldPos.row);

        if (this.position.col == 0) {
            this.moveCursor({ col:  leadingWhitespaceLength });
        } else if (this.position.col == leadingWhitespaceLength) {
            this.moveCursor({ col: 0 });
        } else if(leadingWhitespaceLength != this.editor.ui.getRowScreenLength(this.editor.cursorManager.getCursorPosition().row)){
            this.moveCursor({ col: leadingWhitespaceLength });
        } else {
            this.moveCursor({ col: 0 });
        }

        return { oldPos: oldPos, newPos: bespin.editor.utils.copyPos(this.position) };
    },

    moveToLineEnd: function() {
        var oldPos = bespin.editor.utils.copyPos(this.position);

        this.moveCursor({ col: this.editor.ui.getRowScreenLength(oldPos.row) });

        return { oldPos: oldPos, newPos: bespin.editor.utils.copyPos(this.position) };
    },

    moveToTop: function() {
        var oldPos = bespin.editor.utils.copyPos(this.position);

        this.editor.cursorManager.moveCursor({ row: 0, col: 0 });

        return { oldPos: oldPos, newPos: bespin.editor.utils.copyPos(this.position) };
    },

    moveToBottom: function() {
        var oldPos = bespin.editor.utils.copyPos(this.position);

        var row = this.editor.model.getRowCount() - 1;
        this.editor.cursorManager.moveCursor({ row: row, col: this.editor.ui.getRowScreenLength(row) });

        return { oldPos: oldPos, newPos: bespin.editor.utils.copyPos(this.position) };
    },

    moveUp: function() {
        var settings = bespin.get("settings");
        var selection = this.editor.getSelection();
        var oldPos = bespin.editor.utils.copyPos(selection ? { row: selection.startPos.row, col: this.position.col} : this.position);
        var oldVirualCol = this.virtualCol;

        this.moveCursor({ row: oldPos.row - 1, col: Math.max(oldPos.col, this.virtualCol) });

        if ((settings && settings.isSettingOn('strictlines')) && this.position.col > this.editor.ui.getRowScreenLength(this.position.row)) {
            this.moveToLineEnd();   // this sets this.virtulaCol = 0!
            this.virtualCol = Math.max(oldPos.col, oldVirualCol);
        }

        return { oldPos: oldPos, newPos: bespin.editor.utils.copyPos(this.position) };
    },

    moveDown: function() {
        var settings = bespin.get("settings");
        var selection = this.editor.getSelection();
        var oldPos = bespin.editor.utils.copyPos(selection ? { row: selection.endPos.row, col: this.position.col} : this.position);
        var oldVirualCol = this.virtualCol;

        this.moveCursor({ row: Math.max(0, oldPos.row + 1), col: Math.max(oldPos.col, this.virtualCol) });

        if ((settings && settings.isSettingOn('strictlines')) && this.position.col > this.editor.ui.getRowScreenLength(this.position.row)) {
            this.moveToLineEnd();   // this sets this.virtulaCol = 0!
            this.virtualCol = Math.max(oldPos.col, oldVirualCol);
        }

        return { oldPos: oldPos, newPos: bespin.editor.utils.copyPos(this.position) };
    },

    moveLeft: function(args) {
        var settings = bespin.get("settings");
        var oldPos = bespin.editor.utils.copyPos(this.position);
        var shiftKey = (args.event ? args.event.shiftKey : false);
        
        if (!this.editor.getSelection() || shiftKey) {
            if (settings && settings.isSettingOn('smartmove')) {
                var freeSpaces = this.getContinuousSpaceCount(oldPos.col, this.getNextTablevelLeft());
                if (freeSpaces == this.editor.getTabSize()) {
                    this.moveCursor({ col: oldPos.col - freeSpaces });  
                    return { oldPos: oldPos, newPos: bespin.editor.utils.copyPos(this.position) }
                } // else {
                //  this case is handled by the code following
                //}
            }

            // start of the line so move up
            if ((settings && settings.isSettingOn('strictlines')) && (this.position.col == 0)) {
                this.moveUp();
                if (oldPos.row > 0) this.moveToLineEnd();
            } else {
                this.moveCursor({ row: oldPos.row, col: Math.max(0, oldPos.col - 1) });
            }
        } else {
            this.moveCursor(this.editor.getSelection().startPos);
        }

        return { oldPos: oldPos, newPos: bespin.editor.utils.copyPos(this.position) };
    },

    moveRight: function(args) {
        var settings = bespin.get("settings");
        var oldPos = bespin.editor.utils.copyPos(this.position);
        var shiftKey = (args.event ? args.event.shiftKey : false);
        
        if (!this.editor.getSelection() || shiftKey) {
            if ((settings && settings.isSettingOn('smartmove')) && args != true) {
                var freeSpaces = this.getContinuousSpaceCount(oldPos.col, this.getNextTablevelRight());                       
                if (freeSpaces == this.editor.getTabSize()) {
                    this.moveCursor({ col: oldPos.col + freeSpaces })  
                    return { oldPos: oldPos, newPos: bespin.editor.utils.copyPos(this.position) }
                }// else {
                //  this case is handled by the code following
                //}
            }

            // end of the line, so go to the start of the next line
            if ((settings && settings.isSettingOn('strictlines')) && (this.position.col >= this.editor.ui.getRowScreenLength(this.position.row))) {
                this.moveDown();
                if (oldPos.row < this.editor.model.getRowCount() - 1) this.moveToLineStart();
            } else {
                this.moveCursor({ col: this.position.col + 1 });
            }
        } else {
            this.moveCursor(this.editor.getSelection().endPos);
        }

        return { oldPos: oldPos, newPos: bespin.editor.utils.copyPos(this.position) };
    },

    movePageUp: function() {
        var oldPos = bespin.editor.utils.copyPos(this.position);

        this.moveCursor({ row: Math.max(this.editor.ui.firstVisibleRow - this.editor.ui.visibleRows, 0) });

        return { oldPos: oldPos, newPos: bespin.editor.utils.copyPos(this.position) };
    },

    movePageDown: function() {
        var oldPos = bespin.editor.utils.copyPos(this.position);

        this.moveCursor({ row: Math.min(this.position.row + this.editor.ui.visibleRows, this.editor.model.getRowCount() - 1) });

        return { oldPos: oldPos, newPos: bespin.editor.utils.copyPos(this.position) };
    },

    smartMoveLeft: function() {
        var oldPos = bespin.editor.utils.copyPos(this.position);

        var row = this.editor.ui.getRowString(oldPos.row);

        var c, charCode;

        if (this.position.col == 0) { // -- at the start to move up and to the end
            this.moveUp();
            this.moveToLineEnd();
        } else {
            // Short circuit if cursor is ahead of actual spaces in model
            if (row.length < this.position.col) this.moveToLineEnd();

            var newcol = this.position.col;

            // This slurps up trailing spaces
            var wasSpaces = false;
            while (newcol > 0) {
                newcol--;

                c = row.charAt(newcol);
                charCode = c.charCodeAt(0);
                if (charCode == 32 /*space*/) {
                    wasSpaces = true;
                } else {
                    newcol++;
                    break;
                }
            }

            // This jumps to stop words
            if (!wasSpaces) {
                while (newcol > 0) {
                    newcol--;
                    c = row.charAt(newcol);
                    charCode = c.charCodeAt(0);
                    if ( (charCode < 65) || (charCode > 122) ) { // if you get to an alpha you are done
                        if (newcol != this.position.col - 1) newcol++; // right next to a stop char, move back one
                        break;
                    }
                }
            }

            this.moveCursor({ col: newcol });
        }

        return { oldPos: oldPos, newPos: bespin.editor.utils.copyPos(this.position) };
    },

    smartMoveRight: function() {
        var oldPos = bespin.editor.utils.copyPos(this.position);

        var row = this.editor.ui.getRowString(oldPos.row);

        if (row.length <= this.position.col) { // -- at the edge so go to the next line
            this.moveDown();
            this.moveToLineStart();
        } else {
            var c, charCode;

            var newcol = this.position.col;

            // This slurps up leading spaces
            var wasSpaces = false;
            while (newcol < row.length) {
                c = row[newcol];
                charCode = c.charCodeAt(0);
                if (charCode == 32 /*space*/) {
                    wasSpaces = true;
                    newcol++;
                } else {
                    break;
                }
            }

            // This jumps to stop words
            if (!wasSpaces) {
                while (newcol < row.length) {
                    newcol++;

                    if (row.length == newcol) { // one more to go
                        this.moveToLineEnd();
                        newcol = -1;
                        break;
                    }

                    c = row[newcol];
                    charCode = c.charCodeAt(0);

                    if ( (charCode < 65) || (charCode > 122) ) {
                        break;
                    }
                }
            }

            if (newcol != -1) this.moveCursor({ col: newcol });
        }

        return { oldPos: oldPos, newPos: bespin.editor.utils.copyPos(this.position) };
    },

    moveCursor: function(newpos) {
        if (!newpos) return; // guard against a bad position (certain redo did this)
        if (newpos.col === undefined) newpos.col = this.position.col;
        if (newpos.row === undefined) newpos.row = this.position.row;

        this.virtualCol = 0;
        var oldpos = this.position;

        var row = Math.min(newpos.row, this.editor.model.getRowCount() - 1); // last row if you go over
        if (row < 0) row = 0; // can't move negative off screen

        var invalid = this.isInvalidCursorPosition(row, newpos.col);
        if (invalid) {
            // console.log('Comparing (' + oldpos.row + ',' + oldpos.col + ') to (' + newpos.row + ',' + newpos.col + ') ...');
            // console.log("invalid position: " + invalid.left + ", " + invalid.right + "; half: " + invalid.half);
            if (oldpos.row != newpos.row) {
                newpos.col = invalid.right;
            } else if (oldpos.col < newpos.col) {
                newpos.col = invalid.right;
            } else if (oldpos.col > newpos.col) {
                newpos.col = invalid.left;
            } else {
                // default
                newpos.col = invalid.right;
            }
        }

        this.position = { row: row, col: newpos.col };
        // console.log('Position: (' + this.position.row + ', ' + this.position.col + ')', '[' + this.getModelPosition().col + ']');

        // keeps the editor's cursor from blinking while moving it
        var editorUI = bespin.get('editor').ui;
        editorUI.showCursor = true;
        editorUI.toggleCursorAllowed = false;
    },

    // Pass in a screen position; returns undefined if the postion is valid, otherwise returns closest left and right valid positions
    isInvalidCursorPosition: function(row, col) {
        var rowArray = this.editor.model.getRowArray(row);

        // we need to track the cursor position separately because we're stepping through the array, not the row string
        var curCol = 0;
        for (var i = 0; i < rowArray.length; i++) {
            if (rowArray[i].charCodeAt(0) == 9) {
                // if current character in the array is a tab, work out the white space between here and the tab stop
                var toInsert = this.editor.getTabSize() - (curCol % this.editor.getTabSize());

                // if the passed column is in the whitespace between the tab and the tab stop, it's an invalid position
                if ((col > curCol) && (col < (curCol + toInsert))) {
                    return { left: curCol, right: curCol + toInsert, half: toInsert / 2 };
                }

                curCol += toInsert - 1;
            }
            curCol++;
        }

        return undefined;
    }
});