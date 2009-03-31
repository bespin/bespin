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

dojo.provide("bespin.editor.actions");  

// = Actions =
//
// The editor can run various actions. They are defined here and you can add or change them dynamically. Cool huh?
//
// An action mutates the model or editor state in some way. The only way the editor state or model should be manipulated is via
// the execution of actions.
//
// Actions integrate with the undo manager by including instructions for how to undo (and redo) the action. These instructions
// take the form of a hash containing the necessary state for undo/redo. A key "action" corresponds to the function name of the
// action that should be executed to undo or redo the operation and the remaining keys correspond to state necessary to perform
// the action. See below for various examples.

dojo.declare("bespin.editor.Actions", null, { 
    constructor: function(editor) {
        this.editor = editor;
        this.model = this.editor.model;
        this.cursorManager = this.editor.cursorManager;
        this.ignoreRepaints = false;
    },

    // this is a generic helper method used by various cursor-moving methods
    handleCursorSelection: function(args) {
        if (args.event.shiftKey) {
            if (!this.editor.selection) this.editor.setSelection({ startPos: bespin.editor.utils.copyPos(args.pos) });
            this.editor.setSelection({ startPos: this.editor.selection.startPos, endPos: bespin.editor.utils.copyPos(this.cursorManager.getCursorPosition()) });
        } else {
            this.editor.setSelection(undefined);
        }
    },

    moveCursor: function(moveType, args) {
        var posData = this.cursorManager[moveType]();
        this.handleCursorSelection(args);
        this.repaint();
        args.pos = posData.newPos;
        return args;
    },

    moveCursorLeft: function(args) {
        return this.moveCursor("moveLeft", args);
    },

    moveCursorRight: function(args) {
        return this.moveCursor("moveRight", args);
    },

    moveCursorUp: function(args) {
        return this.moveCursor("moveUp", args);
    },

    moveCursorDown: function(args) {
        return this.moveCursor("moveDown", args);
    },

    moveToLineStart: function(args) {
        return this.moveCursor("moveToLineStart", args);
    },

    moveToLineEnd: function(args) {
        return this.moveCursor("moveToLineEnd", args);
    },

    moveToFileTop: function(args) {
        return this.moveCursor("moveToTop", args);
    },

    moveToFileBottom: function(args) {
        return this.moveCursor("moveToBottom", args);
    },

    movePageUp: function(args) {
        return this.moveCursor("movePageUp", args);
    },

    movePageDown: function(args) {
        return this.moveCursor("movePageDown", args);
    },

    moveWordLeft: function(args) {
        return this.moveCursor("smartMoveLeft", args);
    },

    moveWordRight: function(args) {
        return this.moveCursor("smartMoveRight", args);
    },

    deleteWordLeft: function(args) {
        this.deleteChunk({
            endPos: args.pos,
            pos: this.moveCursor("smartMoveLeft", args).pos
        });
        return args;
    },

    deleteWordRight: function(args) {
        this.deleteChunk({
            pos: args.pos,
            endPos: this.moveCursor("smartMoveRight", args).pos
        });
        return args;
    },

    undo: function() {
        this.editor.undoManager.undo();
    },

    redo: function() {
        this.editor.undoManager.redo();
    },

    selectAll: function(args) {
        // do nothing with an empty doc
        if (this.model.isEmpty()) return;

        args.startPos = { row: 0, col: 0 };
        args.endPos = { row: this.model.getRowCount() - 1, col: this.editor.ui.getRowScreenLength(this.model.getRowCount() - 1) };

        this.select(args);
    },

    select: function(args) {
        if (args.startPos) {
            this.editor.setSelection({ startPos: args.startPos, endPos: args.endPos });
            this.cursorManager.moveCursor(args.endPos);
        } else {
            this.editor.setSelection(undefined);
        }
    },

    insertTab: function(args) {
        var settings = bespin.get("settings");
        
        if (this.editor.getSelection() && !args.undoInsertTab) {
            this.indent(args);
            return;
        }

        var tab = args.tab;
        var tablength = this.cursorManager.getCharacterLength("\t");

        if (!tab || !tablength) {
            if (settings && settings.isSettingOn('tabmode')) {
                // do something tabby
                tab = "\t";
            } else {
                tab = "";
                var tabSizeCount = tablength;
                while (tabSizeCount-- > 0) {
                    tab += " ";
                }
                tablength = tab.length;
                if (settings && settings.isSettingOn('smartmove')) {
                    leadingWhitespaceLength = this.cursorManager.getLeadingWhitespace(args.pos.row);
                    tablength = this.cursorManager.getNextTablevelRight(leadingWhitespaceLength) - leadingWhitespaceLength;
                    tab = tab.substring(0, tablength);
                }
            }
        }

        delete this.editor.selection;
        this.model.insertCharacters(this.cursorManager.getModelPosition({ row: args.pos.row, col: args.pos.col }), tab);
        this.cursorManager.moveCursor({ row: args.pos.row, col: args.pos.col + tablength });
        this.repaint(args.pos.row);
        
        // undo/redo
        args.action = "insertTab";
        var redoOperation = args;
        var undoArgs = {
            action: "removeTab",
            queued: args.queued,
            pos: bespin.editor.utils.copyPos(args.pos),
            tab: tab
        };
        var undoOperation = undoArgs;
        this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));
    },
    
    // this function can only be called by editor.undoManager for undo insertTab in the case of beeing nothing selected
    removeTab: function(args) {
        delete this.editor.selection;
        this.model.deleteCharacters(this.cursorManager.getModelPosition({ row: args.pos.row, col: args.pos.col }), args.tab.length);
        this.cursorManager.moveCursor({ row: args.pos.row, col: args.pos.col });
        this.repaint(args.pos.row);
        
        // undo/redo
        args.action = "removeTab";
        var redoOperation = args;
        var undoArgs = {
            action: "insertTab",
            undoInsertTab: true,
            queued: args.queued,
            pos: bespin.editor.utils.copyPos(args.pos),
            tab: args.tab
        };
        var undoOperation = undoArgs;
        this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));
    },

    indent: function(args) {
        var historyIndent = args.historyIndent || false;    
        if (!historyIndent) {
            var newHistoryIndent = [];
        }
        var settings = bespin.get('settings');
        var selection = args.selection || this.editor.getSelection();
        var fakeSelection = args.fakeSelection || false;
        var startRow = selection.startPos.row;
        var endRow = selection.endPos.row;
        var charsToInsert;
        var charsToInsertLength;
        var leadingWhitespaceLength;
        var tab = '';
        if (settings && settings.isSettingOn('tabmode')) {
            tab = "\t";
        } else {
            var tabsize = this.editor.getTabSize();
            while (tabsize-- > 0) {
                tab += " ";
            }
        }

        for (var y = startRow; y <= endRow; y++) {
            if (!historyIndent) {
                if (tab != '\t') {
                    leadingWhitespaceLength = this.cursorManager.getLeadingWhitespace(y);
                    charsToInsertLength = this.cursorManager.getNextTablevelRight(leadingWhitespaceLength) - leadingWhitespaceLength;
                    charsToInsert = tab.substring(0, charsToInsertLength);
                } else {
                    // in the case of "real" tabs we just insert the tabs
                    charsToInsert = '\t';
                }
                this.model.insertCharacters(this.cursorManager.getModelPosition({ row: y, col: 0 }), charsToInsert);
                newHistoryIndent.push(charsToInsert);
            } else {
                this.model.insertCharacters(this.cursorManager.getModelPosition({ row: y, col: 0 }), historyIndent[y - startRow]);
            } 
        }

        if (!fakeSelection) {
            selection.endPos.col += this.cursorManager.getStringLength(charsToInsert);
            this.editor.setSelection(selection);
        }
        args.pos.col += this.cursorManager.getStringLength(historyIndent ? (historyIndent[historyIndent.length-1]) : charsToInsert);
        this.cursorManager.moveCursor({ col: args.pos.col });
        historyIndent = historyIndent ? historyIndent : newHistoryIndent;
        this.repaint(startRow);

        // undo/redo
        args.action = "indent";
        args.selection = selection;
        var redoOperation = args;
        var undoArgs = { action: "unindent", queued: args.queued, selection: selection, fakeSelection: fakeSelection, historyIndent: historyIndent, pos: bespin.editor.utils.copyPos(args.pos) };
        var undoOperation = undoArgs;
        this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));        
    },
    
    unindent: function(args) {
        var historyIndent = args.historyIndent || false;
        if (!historyIndent) {
            var newHistoryIndent = [];
        }
        var selection = args.selection || this.editor.getSelection();
        var fakeSelection = args.fakeSelection || false;
        if (!selection) {
            fakeSelection = true;
            selection = { startPos: { row: args.pos.row, col: args.pos.col }, endPos: { row: args.pos.row, col: args.pos.col } };
        }
        var startRow = selection.startPos.row;
        var endRow = selection.endPos.row;
        var row;
        var charsToDelete;
        var charsWidth;

        for (var y = startRow; y <= endRow; y++) {
            if (historyIndent) {
                charsToDelete = historyIndent[y - startRow].length;
                charsWidth = this.cursorManager.getStringLength(historyIndent[y - startRow]);
            } else {
                row = this.model.getRowArray(y);
                if (row.length > 0 && row[0] == '\t') {
                    charsToDelete = 1;
                    charsWidth = this.editor.getTabSize();
                } else {
                    var leadingWhitespaceLength = this.cursorManager.getLeadingWhitespace(y);
                    charsToDelete = this.cursorManager.getContinuousSpaceCount(0, this.editor.getTabSize());
                    charsWidth = charsToDelete;
                }

                newHistoryIndent.push(row.join("").substring(0, charsToDelete));
            }

            if (charsToDelete) {
                this.model.deleteCharacters(this.cursorManager.getModelPosition({ row: y, col: 0 }), charsToDelete);
            }
            if (y == startRow) {
                selection.startPos.col = Math.max(0, selection.startPos.col - charsWidth);
            }
            if (y == endRow) {
                selection.endPos.col = Math.max(0, selection.endPos.col - charsWidth);
            }
            if (y == args.pos.row) {
                args.pos.col = Math.max(0, args.pos.col - charsWidth);
            }
        }
        this.cursorManager.moveCursor({ col: args.pos.col });

        if (!fakeSelection) {
            this.editor.setSelection(selection);
        }
        historyIndent = historyIndent ? historyIndent : newHistoryIndent;
        this.repaint(startRow);
        
        // undo/redo
        args.action = "unindent";
        args.selection = selection;
        var redoOperation = args;
        var undoArgs = { action: "indent", queued: args.queued, selection: selection, fakeSelection: fakeSelection, historyIndent: historyIndent, pos: bespin.editor.utils.copyPos(args.pos) };
        var undoOperation = undoArgs;
        this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));
    },

    // NOTE: Actually, clipboard.js is taking care of this unless EditorOnly mode is set
    cutSelection: function(args) {
        this.copySelection(args);
        this.deleteSelection(args);
    },
    
    // NOTE: Actually, clipboard.js is taking care of this unless EditorOnly mode is set
    copySelection: function(args) {
        var selectionObject = this.editor.getSelection();
        if (selectionObject) {
            var selectionText = this.model.getChunk(selectionObject);
            if (selectionText) {
                bespin.editor.clipboard.Manual.copy(selectionText);
            }
        }
    },

    deleteSelectionAndInsertChunk: function(args) {
        var oldqueued = args.queued;

        args.queued = true;
        var selection = this.editor.getSelection();
        var chunk = this.deleteSelection(args);
        args.pos = bespin.editor.utils.copyPos(this.editor.getCursorPos());
        var endPos = this.insertChunk(args);

        args.queued = oldqueued;

        // undo/redo
        args.action = "deleteSelectionAndInsertChunk";
        args.selection = selection;
        var redoOperation = args;
        var undoArgs = {
            action: "deleteChunkAndInsertChunkAndSelect",
            pos: bespin.editor.utils.copyPos(args.pos),
            endPos: endPos,
            queued: args.queued,
            chunk: chunk
        };
        var undoOperation = undoArgs;
        this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));
    },

    deleteChunkAndInsertChunkAndSelect: function(args) {
        var oldqueued = args.queued;

        args.queued = true;
        this.deleteChunk(args);
        this.insertChunkAndSelect(args);

        args.queued = oldqueued;

        // undo/redo
        args.action = "deleteChunkAndInsertChunkAndSelect";
        var redoOperation = args;
        var undoArgs = {
            action: "deleteSelectionAndInsertChunk",
            pos: bespin.editor.utils.copyPos(args.pos),
            queued: args.queued,
            selection: args.selection
        };
        var undoOperation = undoArgs;
        this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));
    },

    // NOTE: Actually, clipboard.js is taking care of this unless EditorOnly mode is set
    pasteFromClipboard: function(args) {
        var clipboard = (args.clipboard) ? args.clipboard : bespin.editor.clipboard.Manual.data();
        if (clipboard === undefined) return; // darn it clipboard!
        args.chunk = clipboard;
        this.insertChunk(args);
    },

    insertChunk: function(args) {
        if (this.editor.selection) {
            this.deleteSelectionAndInsertChunk(args);
        } else {
            var pos = bespin.editor.utils.copyPos(this.cursorManager.getCursorPosition());
            var startPosRow = pos.row;
            pos = this.model.insertChunk(this.cursorManager.getModelPosition(pos), args.chunk);
            pos = this.cursorManager.getCursorPosition(pos);
            this.cursorManager.moveCursor(pos);
            this.repaint(startPosRow);

            // undo/redo
            args.action = "insertChunk";
            var redoOperation = args;
            var undoArgs = { action: "deleteChunk", pos: bespin.editor.utils.copyPos(args.pos), queued: args.queued, endPos: pos };
            var undoOperation = undoArgs;
            this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));

            return pos;
        }
    },

    deleteChunk: function(args) {
        var chunk = this.model.deleteChunk({ startPos: this.cursorManager.getModelPosition(args.pos), endPos: this.cursorManager.getModelPosition(args.endPos) });
        this.cursorManager.moveCursor(args.pos);
        this.repaint(args.pos.row);

        // undo/redo
        args.action = "deleteChunk";
        var redoOperation = args;
        var undoArgs = { action: "insertChunk", pos: bespin.editor.utils.copyPos(args.pos), queued: args.queued, chunk: chunk };
        var undoOperation = undoArgs;
        this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));
    },

    //deleteLine: function(args) {
    //    this.editor.lines.splice(args.pos.row);
    //    if (args.pos.row >= this.editor.lines.length) this.cursorManager.moveCursor({ row: args.pos.row - 1, col: args.pos.col });
    //    this.repaint();
    //},

    joinLine: function(args) { 
        var invalidCacheRow = args.pos.row; 
        if (args.joinDirection == "up") {
            if (args.pos.row == 0) return;

            var newcol = this.editor.ui.getRowScreenLength(args.pos.row - 1);
            this.model.joinRow(args.pos.row - 1);
            this.cursorManager.moveCursor({ row: args.pos.row - 1, col: newcol });
            invalidCacheRow--; 
        } else {
            if (args.pos.row >= this.model.getRowCount() - 1) return;

            this.model.joinRow(args.pos.row);
        }

        // undo/redo
        args.action = "joinLine";
        var redoOperation = args;
        var undoArgs = { action: "newline", pos: bespin.editor.utils.copyPos(this.editor.getCursorPos()), queued: args.queued };
        var undoOperation = undoArgs;
        this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));
        
        this.repaint(invalidCacheRow);
    },

    killLine: function(args) {
        // select the current row
        this.editor.setSelection({ startPos: { row: args.pos.row, col: 0 }, endPos: { row: args.pos.row + 1, col: 0 } });
        this.cutSelection(args); // cut (will save and redo will work)
    },
    
    deleteSelection: function(args) {
        if (!this.editor.selection) return;
        var selection = this.editor.getSelection();
        var startPos = bespin.editor.utils.copyPos(selection.startPos);
        selection = this.cursorManager.getModelSelection(selection);
        var chunk = this.model.getChunk(selection);
        this.model.deleteChunk(selection);

        // undo/redo
        args.action = "deleteSelection";
        var redoOperation = args;
        var undoArgs = { action: "insertChunkAndSelect", pos: bespin.editor.utils.copyPos(startPos), queued: args.queued, chunk: chunk };
        var undoOperation = undoArgs;
        this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));

        // setting the selection to undefined has to happen *after* we enqueue the undoOp otherwise replay breaks
        this.editor.setSelection(undefined);
        this.cursorManager.moveCursor(startPos);
        this.repaint(startPos.row);

        return chunk;
    },

    insertChunkAndSelect: function(args) {
        var endPos = this.cursorManager.getCursorPosition(this.model.insertChunk(this.cursorManager.getModelPosition(args.pos), args.chunk));

        args.action = "insertChunkAndSelect";
        var redoOperation = args;
        var undoArgs = { action: "deleteSelection", pos: bespin.editor.utils.copyPos(endPos), queued: args.queued };
        var undoOperation = undoArgs;
        this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));

        // setting the selection to undefined has to happen *after* we enqueue the undoOp otherwise replay breaks
        this.editor.setSelection({ startPos: args.pos, endPos: endPos });
        this.cursorManager.moveCursor(endPos);
        this.repaint(args.pos.row);
    },

    backspace: function(args) {
        if (this.editor.selection) {
            this.deleteSelection(args);
        } else {
            if (args.pos.col > 0) {
                var settings = bespin.get('settings');
                if (settings && settings.isSettingOn('smartmove')) {
                    var tabsize = this.editor.getTabSize();
                    var freeSpaces = this.cursorManager.getContinuousSpaceCount(args.pos.col, this.cursorManager.getNextTablevelLeft(args.pos.col));
                    if (freeSpaces == tabsize) {
                        var pos = args.pos;
                        this.editor.selection = { startPos: { row: pos.row, col: pos.col - tabsize}, endPos: {row: pos.row, col: pos.col}};
                        this.deleteSelection(args);
                        return;
                    }
                }
                this.cursorManager.moveCursor({ col:  Math.max(0, args.pos.col - 1) });
                args.pos.col -= 1;
                this.deleteCharacter(args);
            } else {
                args.joinDirection = "up";
                this.joinLine(args);
            }
        }
    },

    deleteKey: function(args) {
        if (this.editor.selection) {
            this.deleteSelection(args);
        } else {
            if (args.pos.col < this.editor.ui.getRowScreenLength(args.pos.row)) {
                var settings = bespin.get('settings');
                if (settings && settings.isSettingOn('smartmove')) {
                    var tabsize = this.editor.getTabSize();
                    var freeSpaces = this.cursorManager.getContinuousSpaceCount(args.pos.col, this.cursorManager.getNextTablevelRight(args.pos.col));
                    if (freeSpaces == tabsize) {
                        var pos = args.pos;
                        this.editor.selection = { startPos: { row: pos.row, col: pos.col}, endPos: {row: pos.row, col: pos.col + tabsize}};
                        this.deleteSelection(args);
                        return;
                    }
                }
                this.deleteCharacter(args);
            } else {
                args.joinDirection = "down";
                this.joinLine(args);
            }
        }
    },

    deleteCharacter: function(args) {
        if (args.pos.col < this.editor.ui.getRowScreenLength(args.pos.row)) {
            var modelPos = this.cursorManager.getModelPosition(args.pos);
            var deleted = this.model.deleteCharacters(modelPos, 1);
            this.repaint(modelPos.row);

            // undo/redo
            args.action = "deleteCharacter";
            var redoOperation = args;
            var undoArgs = { action: "insertCharacter", pos: bespin.editor.utils.copyPos(args.pos), queued: args.queued, newchar: deleted };
            var undoOperation = undoArgs;
            this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));
        }
    },

    newline: function(args) {
        var settings = bespin.get("settings");
        var autoindentAmount = (settings && settings.get('autoindent')) ? bespin.util.leadingSpaces(this.model.getRowArray(args.pos.row)) : 0;
        this.model.splitRow(this.cursorManager.getModelPosition(args.pos), autoindentAmount);
        this.cursorManager.moveCursor({ row: this.cursorManager.getCursorPosition().row + 1, col: autoindentAmount });

        // undo/redo
        args.action = "newline";
        var redoOperation = args;
        var undoArgs = { action: "joinLine", joinDirection: "up", pos: bespin.editor.utils.copyPos(this.cursorManager.getCursorPosition()), queued: args.queued };
        var undoOperation = undoArgs;
        this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));

        this.repaint(args.pos.row);
    },

    // it seems kinda silly, but when you have a region selected and you insert a character, I have a separate action that is invoked.
    // this is because it's really two operations: deleting the selected region and then inserting a character. Each of these two
    // actions adds an operation to the undo queue. So I have two choices for
    deleteSelectionAndInsertCharacter: function(args) {
        var oldqueued = args.queued;

        args.queued = true;
        var chunk = this.deleteSelection(args);
        args.pos = bespin.editor.utils.copyPos(this.editor.getCursorPos());
        this.insertCharacter(args);

        args.queued = oldqueued;

        // undo/redo
        args.action = "deleteSelectionAndInsertCharacter";
        var redoOperation = args;
        var undoArgs = {
            action: "deleteCharacterAndInsertChunkAndSelect",
            pos: bespin.editor.utils.copyPos(args.pos),
            queued: args.queued,
            chunk: chunk
        };
        var undoOperation = undoArgs;
        this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));
    },

    deleteCharacterAndInsertChunkAndSelect: function(args) {
        var oldqueued = args.queued;

        args.queued = true;
        this.deleteCharacter(args);
        this.insertChunkAndSelect(args);

        args.queued = oldqueued;

        // undo/redo
        args.action = "deleteCharacterAndInsertChunkAndSelect";
        var redoOperation = args;
        var undoArgs = { action: "deleteSelectionAndInsertCharacter", pos: bespin.editor.utils.copyPos(args.pos), queued: args.queued };
        var undoOperation = undoArgs;
        this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));
    },

    insertCharacter: function(args) {
        if (this.editor.selection) {
            this.deleteSelectionAndInsertCharacter(args);
        } else {
            this.model.insertCharacters(this.cursorManager.getModelPosition(args.pos), args.newchar);
            this.cursorManager.moveRight(true);
            this.repaint(args.pos.row);

            // undo/redo
            args.action = "insertCharacter";
            var redoOperation = args;
            var undoArgs = { action: "deleteCharacter", pos: bespin.editor.utils.copyPos(args.pos), queued: args.queued };
            var undoOperation = undoArgs;
            this.editor.undoManager.addUndoOperation(new bespin.editor.UndoItem(undoOperation, redoOperation));
        }
    },
    
    moveCursorRowToCenter: function(args) {
        var saveCursorRow = this.editor.getCursorPos().row;
        var halfRows = Math.floor(this.editor.ui.visibleRows / 2);
        if (saveCursorRow > (this.editor.ui.firstVisibleRow + halfRows)) { // bottom half, so move down
            this.cursorManager.moveCursor({ row: this.editor.getCursorPos().row + halfRows });
        } else { // top half, so move up
            this.cursorManager.moveCursor({ row: this.editor.getCursorPos().row - halfRows });
        }
        this.editor.ui.ensureCursorVisible();
        this.cursorManager.moveCursor({ row: saveCursorRow });
    },

    repaint: function(invalidCacheRow) {
        if (!this.ignoreRepaints) {  
            if (invalidCacheRow) {
                this.editor.ui.syntaxModel.invalidateCache(invalidCacheRow);  
            }
            this.editor.ui.ensureCursorVisible();
            this.editor.paint();
        }
    }
});