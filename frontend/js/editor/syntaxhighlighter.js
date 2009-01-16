/*
 * Syntax highlighter; integrates with existing open-source syntax highlighting project. Highlights
 * a line at a time.
 */
var SyntaxHighlighter = Class.create({
	plain: function(line) {
		return new Array({text:line,style:'plain'});
	},
	
    highlight: function(line, language) {
        if (language == 'off') return this.plain(line);

		var highlighter = dp.sh.GetBrush(language);
		if (highlighter) {
			return highlighter.Annotate(line);
		} else {
			return this.plain(line);
		}
    }
});

// DocumentColorHelper
var DocumentColorHelper = Class.create({
    initialize: function(editor) {
        this.editor = editor;
        this.highlighter = new SyntaxHighlighter();

        if (editor.language == null) editor.language = 'off';
    },

    getLineRegions: function(lineIndex) {
        var row = this.editor.model.getRowArray(lineIndex);
        var regions = [];

        var selectionHelper = this.editor.ui.selectionHelper;
        var lineSelectionData = selectionHelper.getRowSelectionPositions(lineIndex);
        if (!lineSelectionData) {
            var annotated = this.highlighter.highlight(row.join(""),this.editor.language);
            for (var i = 0; i < annotated.length; i++) {
                var note = annotated[i];
                regions.push({
                    text: note.text,
                    style: this.editor.theme[note.style]
                });
            }
        } else {
            // if the selection doesn't start at 0, add a region before
            if (lineSelectionData.startCol > 0) {
                // annotate the entire line.
                var noted = this.highlighter.highlight(row.join(""),this.editor.language);
                // pre is all text on the line before the cursor. it should be highlighted.
                var pre = (row.length <= lineSelectionData.startCol) ?
                          row.join("") :
                          row.slice(0, lineSelectionData.startCol).join("");
                var prePos = 0;
                var notedPos = 0;
                // iterate over the elements in noted that are contained within pre. display them with their highlights.
                // eventually, we reach the end or a word that is partially selected.
                while (prePos < pre.length) {
                    if (prePos + noted[notedPos].text.length <= pre.length) {
                        // push a whole word.
                        regions.push({
                            text: noted[notedPos].text,
                            style: this.editor.theme[noted[notedPos].style]
                        });
                        prePos = prePos + noted[notedPos].text.length;
                        notedPos = notedPos + 1;
                    } else {
                        // push part of a word, which is the rest of the line before the selection. this ends the loop.
                        var chunk = pre.substring(prePos);
                        regions.push({
                            text: chunk,
                            style: this.editor.theme[noted[notedPos].style]
                        });
                        prePos = prePos + chunk.length;
                    }
                }
            }
            if (row.length > lineSelectionData.startCol) {
                regions.push({
                    text: ((row.length <= lineSelectionData.endCol) || lineSelectionData.endCol == -1)
                            ? row.slice(lineSelectionData.startCol, row.length).join("")
                            : row.slice(lineSelectionData.startCol, lineSelectionData.endCol).join(""),
                    style: this.editor.theme.editorSelectedTextColor
                });
            }
            if ((lineSelectionData.endCol != -1) && (row.length > lineSelectionData.endCol)) {
                // this is the rest of a line.
                var entireRow = row.join("");
                var noted = this.highlighter.highlight(entireRow,this.editor.language);
                var txt = row.slice(lineSelectionData.endCol).join("");
                var notedPos = 0;
                var linePos = 0;
                while (linePos < lineSelectionData.endCol) {
                    linePos = linePos + noted[notedPos].text.length;
                    if (linePos > lineSelectionData.endCol) {
                        // need to put up a partial word
                        var word = noted[notedPos].text;
                        var part = word.substring(word.length-linePos+lineSelectionData.endCol);
                        regions.push({
                            text: part,
                            style: this.editor.theme[noted[notedPos].style]
                        });
                    }
                    notedPos = notedPos + 1;
                }

                // now paint the rest of the unselected line, using noted.
                for (var i = notedPos; i < noted.length; i++) {
                    var note = noted[i];
                    regions.push({
                        text: note.text,
                        style: this.editor.theme[note.style]
                    });
                }
            }
        }

        return regions;
    }
});
