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

if (typeof Bespin == "undefined") Bespin = {};
if (!Bespin.Canvas) Bespin.Canvas = {};

// = Canvas Shim =
//
// Make canvas work the same on the different browsers and their quirks

// ** {{{ Bespin.Canvas.Shim }}} **
//
// A shim for all version
Bespin.Canvas.Shim = Class.create({
    fillText: function(ctx, text, x, y, maxWidth) {
      ctx.fillStyle = ctx.font;
      ctx.fillText(text, x, y, maxWidth);
    }
});

// ** {{{ Bespin.Canvas.ShimFF3 }}} **
//
// Map the FF3 style "mozTestStyle" to the standard ctx.font
Bespin.Canvas.ShimFF3 = Class.create({
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
