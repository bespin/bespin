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
 
dojo.provide("bespin.user.register"); 

// Login, logout and registration functions for the Bespin front page.

(function() {
    var server = bespin.get('server') || bespin.register('server', new bespin.client.Server());
    var utils = bespin.user.utils;
    var webpieces = bespin.util.webpieces;
    
    dojo.mixin(bespin.user, {
        login: function() {
            if (utils.showingBrowserCompatScreen()) {
                return;
            }

            var username = dojo.byId("username").value;
            var password = dojo.byId("password").value;

            if (!username || !password) {
                webpieces.showStatus("Please give me both a username and a password");
                return;
            }

            server.login(username, password, utils.whenLoginSucceeded, utils.whenLoginFailed);
        },

        logout: function() {
            server.logout(); 
            dojo.style('logged_in', 'display', 'none');
            dojo.style('not_logged_in', 'display', 'block');
        }    
    });
    
    dojo.mixin(bespin.user.register, {
        checkUsername: function() {
            var username_error = [];
            var username = dojo.byId("register_username").value;
            if (username.length < 4) {
                username_error.push("Usernames must be at least 4 characters long");   
            }
            if (/[<>| '"]/.test(username)) {
                username_error.push("Usernames must not contain any of: <>| '\"");   
            }
            dojo.byId('register_username_error').innerHTML = username_error.join(", ");
        },
        checkPassword: function() {
            dojo.byId('register_password_error').innerHTML = (!utils.validatePassword(dojo.byId('register_password').value)) ? "Password must be between 6 and 20 characters" : "";
        },
        checkConfirm: function() {
            dojo.byId('register_confirm_error').innerHTML = (dojo.byId('register_password').value != dojo.byId('register_confirm').value) ? "Passwords do not match" : "";
        },
        checkEmail: function() {
            dojo.byId('register_email_error').innerHTML = (!utils.validateEmail(dojo.byId('register_email').value)) ? "Invalid email address" : "";
        },
        showForm: function() {
            if (utils.showingBrowserCompatScreen()) return;
            dojo.style('logged_in', 'display', 'none');
            dojo.style('not_logged_in', 'display', 'none');           
            webpieces.showCenterPopup(dojo.byId('centerpopup'), true);  
        },
        hideForm: function() {
            webpieces.hideCenterPopup(dojo.byId('centerpopup'));
            server.currentuser(utils.whenAlreadyLoggedIn, utils.whenNotAlreadyLoggedIn);
        },
        send: function() {
            var pw = dojo.byId('register_password').value;
    	    if (utils.validatePassword(pw) && (pw == dojo.byId('register_confirm').value)) {
        		this.hideForm();
        		server.signup(dojo.byId("register_username").value,
        		    pw,
        		    dojo.byId('register_email').value,
        		    utils.whenLoginSucceeded,
        		    utils.whenLoginFailed,
        		    utils.whenUsernameInUse);
    	    }
        },
        cancel: function() { 
            this.hideForm();
        }
    });
})();
