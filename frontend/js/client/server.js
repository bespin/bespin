//  ***** BEGIN LICENSE BLOCK *****
// Version: MPL 1.1
// 
// The contents of this file are subject to the Mozilla Public License  
// Version
// 1.1 (the "License"); you may not use this file except in compliance  
// with
// the License. You may obtain a copy of the License at
// http://www.mozilla.org/MPL/
// 
// Software distributed under the License is distributed on an "AS IS"  
// basis,
// WITHOUT WARRANTY OF ANY KIND, either express or implied. See the  
// License
// for the specific language governing rights and limitations under the
// License.
// 
// The Original Code is Bespin.
// 
// The Initial Developer of the Original Code is Mozilla.
// Portions created by the Initial Developer are Copyright (C) 2009
// the Initial Developer. All Rights Reserved.
// 
// Contributor(s):
// 
// ***** END LICENSE BLOCK *****
// 

/*
 * Implements the client-side portion of the Bespin REST API
 */
var Server = Class.create({
    initialize: function(base) {
        this.SERVER_BASE_URL = base || 'http://localhost:8080';
    },

    // -- HELPERS

    request: function(method, url, payload, callbackOptions) {
        var xhr = new XMLHttpRequest();
        
        if (document.location.href.startsWith("file:")) { // if developing and using this locally only!
           try {
               if (netscape.security.PrivilegeManager.enablePrivilege) {
                   netscape.security.PrivilegeManager.enablePrivilege('UniversalBrowserRead');
               }
           } catch (ex) {
           }
        }
        
        if (callbackOptions) { // do it async (best)
            xhr.onreadystatechange = function() {
                if (xhr.readyState == 4) {                  
                    if (xhr.status && xhr.status != 0 && (xhr.status >= 200 && xhr.status < 300)) {
                        var text = xhr.responseText;
                        
                        if (callbackOptions['evalJSON'] && text) {
                            try {
                                text = text.evalJSON(true);
                            } catch (syntaxException) {
                                console.log("Couldn't eval the JSON: " + text + " (SyntaxError: " + syntaxException + ")");
                            }
                        }
                        
                        if (Object.isFunction(callbackOptions['call'])) {
                            callbackOptions['call'](text, xhr);
                        } else if (callbackOptions['log']) {
                            console.log(callbackOptions['log']);
                        }
                    } else {
                        var onStatus = 'on' + xhr.status;
                        if (callbackOptions[onStatus]) {
                            callbackOptions[onStatus](xhr);
                        }
                    }
                }
            }
            xhr.open(method, this.SERVER_BASE_URL + url, true); // url must have leading /
			xhr.setRequestHeader("Content-Type", 'application/x-www-form-urlencoded')
            xhr.send(payload);
        } else {
            var fullUrl = this.SERVER_BASE_URL + url;
            console.log("Are you sure you want to do a synchronous Ajax call? Really? " + fullUrl);
            xhr.open(method, fullUrl, false);
            xhr.send(payload);
            return xhr.responseText;
        }
    },

    // -- USER

    login: function(user, pass, callback, notloggedin) {
        var url = "/register/login/" + user;
        this.request('POST', url, escape("password=" + pass), { 
            call: callback, on401: notloggedin, log: 'Login complete.' 
        });
    },

	signup: function(user, pass, email, callback, notloggedin, userconflict) {
        var url = "/register/new/" + user;
        this.request('POST', url, 
			"password=" + escape(pass) + "&email=" + escape(email), { 
			call: callback, on401: notloggedin, on409: usernameInUse,
			log: 'Login complete.' 
		});
	},

    logout: function() {
        var url = "/register/logout/";
        this.request('POST', url, null, { log: 'Logout complete.' });
    },

    currentuser: function(callback, notloggedin) {
        var url = "/register/userinfo/";
        return this.request('GET', url, null, 
                { call: callback, on401: notloggedin, evalJSON: true });
    },

    // -- FILES

    list: function(project, path, callback) {
        var project = project || '';
        var url = Path.combine('/file/list/', project, path || '/');

        this.request('GET', url, null, { call: callback, evalJSON: true, log: "Listing files in: " + url });
    },

    projects: function(callback) {
        this.request('GET', '/file/list/', null, { call: callback, evalJSON: true });
    },

    saveFile: function(project, path, contents, lastOp) {
        if (!project || !path) return;

        var url = '/file/at/' + project + '/' + (path || '');
        if (lastOp) url += "?lastEdit=" + lastOp;

        this.request('PUT', url, contents, { log: 'Saved file.' });
    },

    loadFile: function(project, path, callback) {
        var project = project || '';
        var path = path || '';
        var url = Path.combine('/file/at', project, path);

        this.request('GET', url, null, { call: callback });
    },

    removeFile: function(project, path, callback) {
        var project = project || '';
        var path = path || '';
        var url = Path.combine('/file', project, path);
        
        this.request('DELETE', url, null, { call: callback });
    },

    /*
     * Returns JSON with the key of filename, and the value of an array of usernames
     * { "foo.txt": ["ben"], "SomeAjaxApp/foo.txt": ["dion"] }
     */
    listOpen: function(callback) {
        this.request('GET', '/file/listopen/', null, {
            call: callback, evalJSON: true, log: 'List open files.' 
        });
    },

    closeFile: function(project, path) {
        var path = path || '';
        var url = Path.combine('/file/close', project, path);
        this.request('POST', url, null, { log: 'Closed file: ' + project + path });
    },

    // -- EDIT

    editActions: function(project, path, callback) {
        var path = path || '';
        var url = Path.combine('/edit/list', project, path);
        this.request('GET', url, null, { call: callback, log: "Edit Actions Complete." });
    },

    editAfterActions: function(project, path, index, callback) {
        var path = path || '';
        var url = Path.combine('/edit/recent', index, project, path);
        this.request('GET', url, null, { call: callback, log: "Edit After Actions Complete." });
    },

    doAction: function(project, path, actions) {
        var path = path || '';
        var url = Path.combine('/edit', project, path);

        var sp = "[";
        sp += actions.join(",");
        sp += "]";

        this.request('PUT', url, sp, { call: function(){} });
    },

    // -- SETTINGS

    /*
     * GET /settings/ to list all settings for currently logged in user as json dict
     * GET /settings/[setting] to get the value for a single setting as json string
     * POST /settings/ with HTTP POST DATA (in standard form post syntax) to set the value for a collection of settings (all values are strings)
     * DELETE /settings/[setting] to delete a single setting
     */
    listSettings: function(callback) {
        if (typeof callback == "function") {
            this.request('GET', '/settings/', null, { call: callback, evalJSON: true });
        }
    },

    getSetting: function(name, callback) {
        if (typeof callback == "function") {
            this.request('GET', '/settings/' + name, null, { call: callback });
        }
    },
    
    setSetting: function(name, value, callback) {
        var settings = {};
        settings[name] = value;
        this.setSettings(settings, (callback || Prototype.emptyFunction));
    },
    
    setSettings: function(settings, callback) {
        this.request('POST', '/settings/', Object.toQueryString(settings), { call: (callback || Prototype.emptyFunction) });
    },
    
    unsetSetting: function(name, callback) {
        this.request('DELETE', '/settings/' + name, null, { call: (callback || Prototype.emptyFunction) });
    }
});
