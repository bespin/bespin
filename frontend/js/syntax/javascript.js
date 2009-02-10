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

// = JavaScript Syntax Highlighting Implementation =
//
// Module for syntax highlighting JavaScript.

if (typeof Bespin == "undefined") Bespin = {};
if (!Bespin.Syntax) Bespin.Syntax = {};

// ** {{{ Bespin.Syntax.JavaScriptSyntaxEngine }}} **
//
// Tracks syntax highlighting data on a per-line basis. This is a quick-and-dirty implementation that
// supports five basic highlights: keywords, punctuation, strings, comments, and "everything else", all
// lumped into one last bucket.

Bespin.Syntax.JavaScriptSyntaxEngine = Class.create({
    keywords: 'abstract boolean break byte case catch char class const continue debugger ' +
                    'default delete do double else enum export extends false final finally float ' +
                    'for function goto if implements import in instanceof int interface long native ' +
                    'new null package private protected public return short static super switch ' +
                    'synchronized this throw throws transient true try typeof var void volatile while with'.split(" "),

    punctuation: '{ } . , ; ( ) ? : = " \''.split(" "),

    highlight: function(line, meta) {
        var regions = {};
        var currentStyle = (meta.inMultilineComment) ? "c-comment" : undefined;
        var currentRegion = {};
        var buffer = "";
        var stringChar = "";
        var multiline = false;  // this line contains an unterminated multi-line comment

        for (var i = 0; i < line.length; i++) {
            var c = line.charAt(i);

            // check if we're in a comment and whether this character ends the comment
            if (currentStyle == "c-comment") {
                if (c == "/" && buffer.endsWith("*")) {
                    currentRegion.stop = i;
                    this.addRegion(regions, currentStyle, currentRegion);
                    buffer = "";
                }
                buffer += c;
                continue;
            }

            if ((c == '/') && (buffer.endsWith('/'))) {
                currentRegion = { start: i - 1, stop: line.length };
                currentStyle = "comment";
                this.addRegion(regions, currentStyle, currentRegion);
                buffer = "";
                break;      // once we get a line comment, we're done!
            }

            if (this.isWhiteSpaceOrPunctuation(c)) {
                // check if we're in a string
                if (currentStyle == "string") {
                    if ( ! (c == stringChar && !buffer.endsWith("\\"))) {
                        buffer += c;
                        continue;
                    }
                }

                if (buffer != "") {
                    currentRegion.stop = i;

                    if (currentStyle != "string") {
                        if (this.keywords.indexOf(buffer.toLowerCase()) != -1) {
                            // the buffer contains a keyword
                            currentStyle = "keyword";
                        } else {
                            currentStyle = "other";
                        }
                    }
                    this.addRegion(regions, currentStyle, currentRegion);
                    buffer = "";
                }

                if (this.isPunctuation(c)) {
                    // add an ad-hoc region for just this thing
                    this.addRegion(regions, "punctuation", { start: i, stop: i + 1 });
                }

                if (currentStyle == "string") {
                    currentStyle = "";
                } else {
                    if (c == "'" || c == '"') {
                        currentStyle = "string";
                        stringChar = c;
                        currentRegion = { start: i + 1 };
                    }
                }

                continue;
            }

            if (buffer == "") {
                currentRegion = { start: i };
            }
            buffer += c;
        }

        return regions;
    },

    addRegion: function(regions, type, data) {
        if (!regions[type]) regions[type] = [];
        regions[type].push(data);
    },

    isWhiteSpaceOrPunctuation: function(char) {
        return this.isPunctuation(char) || this.isWhiteSpace(char);
    },

    isPunctuation: function(char) {
        return this.punctuation.indexOf(char) != -1;
    },

    isWhiteSpace: function(char) {
        return char == " ";
    }
});



// TODO: register this puppy