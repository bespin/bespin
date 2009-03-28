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

dojo.provide("bespin.editor.themes");  

// = Themes =
//
// The editor can be styled with Themes. This will become CSS soon, but for now is JSON

// ** Coffee Theme **
bespin.editor.themes.coffee = {
    backgroundStyle: "#2A211C",
    gutterStyle: "#4c4a41",
    lineNumberColor: "#e5c138",
    lineNumberFont: "10pt Monaco, Lucida Console, monospace",
    zebraStripeColor: "#2A211C",
    highlightCurrentLineColor: "#3a312b",
    editorTextColor: "rgb(230, 230, 230)",
    editorSelectedTextColor: "rgb(240, 240, 240)",
    editorSelectedTextBackground: "#526DA5",
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
    tabSpace: "#392A25",

    // syntax definitions
    plain: "#bdae9d",
    keyword: "#42a8ed",
    string: "#039a0a",
    comment: "#666666",
    'c-comment': "#666666",
    punctuation: "#888888",
    attribute: "#BF9464",
    test: "rgb(255,0,0)",
    cdata: "#bdae9d",
    "attribute-value": "#039a0a",
    tag: "#46a8ed",
    color: "#c4646b",
    "tag-name": "#46a8ed",
    value: "#039a0a",
    important: "#990000",
    sizes: "#990000",
    cssclass: "#BF9464",
    cssid: "#46a8ed",  
       
    // Codemirror additions (TODO: better color choice)
    
    atom: "#aa4444",
    variable: "#00cccc",
    variabledef: "#4422cc",
    localvariable: "#cc2277",
    property: "#66bb33", 
    operator: "#88bbff",  
    
    // XML and HTML
    processing: "#999999",
    entity: "#AA2222",
    error: "#FF0000",
    text: "#00BB00",
    
    // PHP
    "compile-time-constant": "#776088", 
    "predefined-constant": "#33CC33",
    "reserved-language-construct": "#00FF00", 
    "predefined-function": "#22FF22", 
    "predefined-class": "#22FF22"
    
};

// ** Coffee Zebra Theme **
bespin.editor.themes.coffeezebra = {};
dojo.mixin(bespin.editor.themes.coffeezebra, bespin.editor.themes.coffee);
bespin.editor.themes.coffeezebra.zebraStripeColor = '#FFFFFF';

// ** White Theme **
bespin.editor.themes.white = {
    backgroundStyle: "#FFFFFF",
    gutterStyle: "#d2d2d2",
    lineNumberColor: "#888888",
    lineNumberFont: "10pt Monaco, Lucida Console, monospace",
    zebraStripeColor: "#FFFFFF",
    highlightCurrentLineColor: "#3a312b",
    editorTextColor: "#000000",
    editorSelectedTextColor: "rgb(240, 240, 240)",
    editorSelectedTextBackground: "#4d97ff",
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

    // syntax definitions
    plain: "#bdae9d",
    keyword: "#0000ff",
    string: "#036907",
    comment: "#0066ff",
    'c-comment': "#0066ff",
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
    cssid: "#bdae9d",  
    
    // Codemirror additions
    // TODO
};

// ** White Zebra Theme **
bespin.editor.themes.whitezebra = {};
dojo.mixin(bespin.editor.themes.whitezebra, bespin.editor.themes.white); 
bespin.editor.themes.whitezebra.zebraStripeColor = '#EAEAEA';

// ** Black Theme **
bespin.editor.themes.black = {
    backgroundStyle: "#000000",
    gutterStyle: "#d2d2d2",
    lineNumberColor: "#888888",
    lineNumberFont: "10pt Monaco, Lucida Console, monospace",
    zebraStripeColor: "#000000", //"#111111",
    highlightCurrentLineColor: "#3a312b",
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
    cssid: "#bdae9d",        
    
    // Codemirror additions
    // TODO:
};

// ** Black Zebra Theme **
bespin.editor.themes.blackzebra = {};
dojo.mixin(bespin.editor.themes.blackzebra, bespin.editor.themes.black); 
bespin.editor.themes.blackzebra.zebraStripeColor = '#111111';

// ** Setup the default **
bespin.editor.themes['default'] = bespin.editor.themes.coffee;
