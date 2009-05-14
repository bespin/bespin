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

dojo.provide("bespin.themes.black");

// = Black Theme =
bespin.themes.black = {
    backgroundStyle: "#000000",
    gutterStyle: "#d2d2d2",
    lineNumberColor: "#888888",
    lineNumberFont: "10pt Monaco, Lucida Console, monospace",
    lineMarkerErrorColor: "#CC4444",
    lineMarkerWarningColor: "#B8860B",
    zebraStripeColor: "#000000", //"#111111",
    highlightCurrentLineColor: "#3a312b",
    editorTextFont: "10pt Monaco, Lucida Console, monospace",
    editorTextColor: "rgb(230, 230, 230)",
    editorSelectedTextColor: "rgb(240, 240, 240)",
    editorSelectedTextBackground: "#243b75",
    cursorStyle: "#879aff",
    cursorType: "ibeam",       // one of "underline" or "ibeam"
    unfocusedCursorStrokeStyle: "#FF0033",
    unfocusedCursorFillStyle: "#73171E",
    partialNibStyle: "rgba(100, 100, 100, 0.3)",
    partialNibArrowStyle: "rgba(255, 255, 255, 0.3)",
    partialNibStrokeStyle: "rgba(150, 150, 150, 0.3)",
    fullNibStyle: "rgb(100, 100, 100)",
    fullNibArrowStyle: "rgb(255, 255, 255)",
    fullNibStrokeStyle: "rgb(150, 150, 150)",
    scrollTrackFillStyle: "rgba(50, 50, 50, 0.8)",
    scrollTrackStrokeStyle: "rgb(150, 150, 150)",
    scrollBarFillStyle: "rgba(0, 0, 0, %a)",
    scrollBarFillGradientTopStart: "rgba(90, 90, 90, %a)",
    scrollBarFillGradientTopStop: "rgba(40, 40, 40, %a)",
    scrollBarFillGradientBottomStart: "rgba(22, 22, 22, %a)",
    scrollBarFillGradientBottomStop: "rgba(44, 44, 44, %a)",
    tabSpace: "#E0D4CB",
    searchHighlight: "#B55C00",
    searchHighlightSelected: "#FF9A00",

    // syntax definitions
    plain: "#bdae9d",
    preprocessor: "rgb(100,100,100)",
    keyword: "#42a8ed",
    string: "#039a0a",
    comment: "#666666",
    'c-comment': "#666666",
    punctuation: "#888888",
    attribute: "#BF9464",
    test: "rgb(255,0,0)",
    cdata: "#bdae9d",
    "attribute-value": "#BF9464",
    tag: "#bdae9d",
    "tag-name": "#bdae9d",
    value: "#BF9464",
    important: "#990000",
    cssclass: "#BF9464",
    cssid: "#bdae9d"

    // Codemirror additions
    // TODO:
};

// ** Black Zebra Theme **
bespin.themes.blackzebra = {};
dojo.mixin(bespin.themes.blackzebra, bespin.themes.black);
bespin.themes.blackzebra.zebraStripeColor = '#111111';
