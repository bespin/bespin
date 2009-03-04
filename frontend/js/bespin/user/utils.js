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

dojo.provide("bespin.user.utils");

// Utility functions for the Bespin front page.


dojo.mixin(bespin.user.utils, {
    whenLoginSucceeded: function() {
        bespin.util.navigate.dashboard();
    },

    whenLoginFailed: function() {
        bespin.user.utils.showStatus("Sorry, login didn't work. Try again? Caps lock on?");
    },

    whenUsernameInUs: function() {
        bespin.user.utils.showStatus("The username is taken. Please choose another.");
    },

    showStatus: function(msg) {
        dojo.byId("status").innerHTML = msg;
        dojo.style('status', 'display', 'block');
    },

    whenAlreadyLoggedIn: function(userinfo) {
        dojo.byId('display_username').innerHTML = userinfo.username;
        dojo.style('logged_in', 'display', 'block');
    },

    whenNotAlreadyLoggedIn: function() {
        dojo.style('not_logged_in', 'display', 'block');
    },

    centerOnScreen: function(el) {
        // retrieve required dimensions
        var elDims = dojo.coords(el);
        var browserDims = dijit.getViewport();

        // calculate the center of the page using the browser and element dimensions
        var y = (browserDims.h - elDims.h) / 2;
        var x = (browserDims.w - elDims.w) / 2;

        // set the style of the element so it is centered
        dojo.style(el, {
            position: 'absolute',
            top: y + 'px',
            left : x + 'px'
        });
    },

    // make sure that the browser can do our wicked shizzle
    checkBrowserAbility: function() {
        if (typeof dojo.byId('testcanvas').getContext != "function") return false; // no canvas

        var ctx = dojo.byId('testcanvas').getContext("2d");

        if (ctx.fillText || ctx.mozDrawText) {
            return true; // you need text support my friend
        } else {
            return false;
        }
    },

    showingBrowserCompatScreen: function() {
        if (!this.checkBrowserAbility()) { // if you don't have the ability
            dojo.style('browser_not_compat', 'display', 'block');
            this.centerOnScreen(dojo.byId('browser_not_compat'));
            dojo.style('opaque', 'display', 'block');

            return true;
        } else {
            return false;
        }
    },

    hideBrowserCompatScreen: function() {
        dojo.style('browser_not_compat', 'display', 'none');
        dojo.style('opaque', 'display', 'none');
    },

    validateEmail: function(str) {
        var filter=/^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;
        return filter.test(str);
    }
});
