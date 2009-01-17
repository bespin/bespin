// UndoManager
var EditorUndoManager = Class.create({
    initialize: function(editor) {
        this.editor = editor;
        this.undoStack = [];
        this.redoStack = [];
        this.syncHelper = undefined;
    },

    undo: function() {
        if (this.undoStack.length == 0) return;
        var item = this.undoStack.pop();

        this.editor.moveCursor(item.undoOp.pos);
        item.undo();
        this.redoStack.push(item);

        if (this.syncHelper) this.syncHelper.undo();
    },

    redo: function() {
        if (this.redoStack.length == 0) return;
        var item = this.redoStack.pop();

        this.editor.moveCursor(item.redoOp.pos);
        item.redo();
        this.undoStack.push(item);

        if (this.syncHelper) this.syncHelper.redo();
    },

    addUndoOperation: function(item) {
        if (item.undoOp.queued) return;

        if (this.redoStack.length > 0) this.redoStack = [];
        this.undoStack.push(item);
        item.editor = this.editor;

        // prevent undo operations from placing themselves back in the undo stack
        item.undoOp.queued = true;
        item.redoOp.queued = true;

        if (this.syncHelper) this.syncHelper.queueUndoOp(item);
    }
});

// UndoOperation: contains two edit operations; one for undoing an operation, and the other for redoing it
var UndoItem = Class.create({
    initialize: function(undoOp, redoOp) {
        this.undoOp = undoOp;
        this.redoOp = redoOp;
    },

    undo: function() {
        this.editor.ui.actions[this.undoOp.action](this.undoOp);
    },

    redo: function() {
        this.editor.ui.actions[this.redoOp.action](this.redoOp);
    }
});