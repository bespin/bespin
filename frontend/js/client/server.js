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

// = Server =
//
// The Server object implements the [[https://wiki.mozilla.org/BespinServerAPI|Bespin Server API]]
// giving the client access to the backend store. The {{{FileSystem}}} object uses this to talk back.

Bespin.Server = Class.create({
    // ** {{{ initialize(base) }}}
    //
    // Object creation initialization
    //
    // * {{{base}}} is the base server URL to access
    initialize: function(base) {
        this.SERVER_BASE_URL = base || '';
    },

    // == Helpers ==

    // ** {{{ request(method, url, payload, callbackOptions) }}}
    //
    // The core way to access the backend system.
    // Similar to the Prototype Ajax.Request wrapper 
    //
    // * {{{method}}} is the HTTP method (GET|POST|PUT|DELETE)
    // * {{{url}}} is the sub url to hit (after the base url)
    // * {{{payload}}} is what to send up for POST requests
    // * {{{callbackOptions}}} is how you pass in various callbacks.
    //   callbackOptions['evalJSON'] = true or false to auto eval
    //   callbackOptions['call'] = the main callback
    //   callbackOptions['log'] = just log the following
    //   callbackOptions['onFailure'] = call for general failures
    //   callbackOptions['on' + STATUS CODE] = call for specific failures
    request: function(method, url, payload, callbackOptions) {
        var xhr = new XMLHttpRequest();
        
        if (location.href.startsWith("file:")) { // if developing and using this locally only!
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
                        } else if (callbackOptions['onFailure']) {
                            callbackOptions['onFailure'](xhr);
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

    // == USER ==

    // ** {{{ login(user, pass, callback, notloggedin) }}}
    //
    // Try to login to the backend system.
    // 
    // * {{{user}}} is the username
    // * {{{pass}}} is the password
    // * {{{onSuccess}}} fires when the user is logged in
    // * {{{onFailure}}} fires when the user failed to login
    login: function(user, pass, onSuccess, onFailure) {
        var url = "/register/login/" + user;
        this.request('POST', url, "password=" + escape(pass), { 
            call: onSuccess, on401: onFailure, log: 'Login complete.' 
        });
    },

    // ** {{{ signup(user, pass, email, callback, notloggedin, userconflict) }}}
    //
    // Signup / Register the user to the backend system
    // 
    // * {{{user}}} is the username
    // * {{{pass}}} is the password
    // * {{{email}}} is the email
    // * {{{onSuccess}}} fires when the user is logged in
    // * {{{notloggedin}}} fires when not logged in
    // * {{{userconflict}}} fires when the username exists
	signup: function(user, pass, email, onSuccess, notloggedin, userconflict) {
        var url = "/register/new/" + user;
        this.request('POST', url, 
			"password=" + escape(pass) + "&email=" + escape(email), { 
			call: onSuccess, on401: notloggedin, on409: userconflict,
			log: 'Login complete.' 
		});
	},

    // ** {{{ logout(callback) }}}
    //
    // Logout from the backend
    // 
    // * {{{callback}}} fires after the logout attempt
    logout: function(callback) {
        var url = "/register/logout/";
        this.request('POST', url, null, { log: 'Logout complete.', call: callback });
    },

    // ** {{{ currentuser(callback, notloggedin) }}}
    //
    // Return info on the current logged in user
    // 
    // * {{{callback}}} fires after the user attempt
    // * {{{notloggedin}}} fires if the user isn't logged in
    currentuser: function(callback, notloggedin) {
        var url = "/register/userinfo/";
        return this.request('GET', url, null, 
                { call: callback, on401: notloggedin, evalJSON: true });
    },

    // == FILES ==

    // ** {{{ list(project, path, onSuccess, onFailure) }}}
    //
    // List the path in the given project
    // 
    // * {{{project}}} is the project to list
    // * {{{path}}} is the path to list out
    // * {{{onSuccess}}} fires if the list returns something
    // * {{{onFailure}}} fires if there is an error getting a list from the server
    list: function(project, path, onSuccess, onFailure) {
        var project = project || '';
        var url = Bespin.Path.combine('/file/list/', project, path || '/');
        var opts = { call: onSuccess, evalJSON: true, log: "Listing files in: " + url };
        if (Object.isFunction(onFailure)) opts.onFailure = onFailure;

        this.request('GET', url, null, opts);
    },

    // ** {{{ projects(callback) }}}
    //
    // Return the list of projects that you have access too
    // 
    // * {{{callback}}} gets fired with the project list
    projects: function(callback) {
        this.request('GET', '/file/list/', null, { call: callback, evalJSON: true });
    },

    // ** {{{ saveFile(project, path, contents, lastOp) }}}
    //
    // Save the given file
    // 
    // * {{{project}}} is the project to save
    // * {{{path}}} is the path to save to
    // * {{{callback}}} fires after the save returns
    // * {{{lastOp}}} contains the last edit operation
    saveFile: function(project, path, contents, lastOp) {
        if (!project || !path) return;

        var url = Bespin.Path.combine('/file/at', project, (path || ''));
        if (lastOp) url += "?lastEdit=" + lastOp;

        this.request('PUT', url, contents, { log: 'Saved file.' });
    },

    // ** {{{ loadFile(project, path, contents) }}}
    //
    // Load the given file
    // 
    // * {{{project}}} is the project to load from
    // * {{{path}}} is the path to load
    // * {{{callback}}} fires after the file is loaded
    loadFile: function(project, path, callback) {
        var project = project || '';
        var path = path || '';
        var url = Bespin.Path.combine('/file/at', project, path);

        this.request('GET', url, null, { call: callback });
    },

    // ** {{{ removeFile(project, path, onSuccess, onFailure) }}}
    //
    // Remove the given file
    // 
    // * {{{project}}} is the project to remove from
    // * {{{path}}} is the path to remove
    // * {{{onSuccess}}} fires if the deletion works
    // * {{{onFailure}}} fires if the deletion failed
    removeFile: function(project, path, onSuccess, onFailure) {
        var project = project || '';
        var path = path || '';
        var url = Bespin.Path.combine('/file/at', project, path);
        var opts = { call: onSuccess };
        if (Object.isFunction(onFailure)) opts.onFailure = onFailure;
        
        this.request('DELETE', url, null, opts);
    },

    // ** {{{ makeDirectory(project, path, onSuccess, onFailure) }}}
    //
    // Create a new directory
    // 
    // * {{{project}}} is the project to save
    // * {{{path}}} is the path to save to
    // * {{{onSuccess}}} fires if the deletion works
    // * {{{onFailure}}} fires if the deletion failed
    makeDirectory: function(project, path, onSuccess, onFailure) {
        if (!project) return;

        var url = Bespin.Path.combineAsDirectory('/file/at', project, (path || ''));
        var opts = {};
        if (Object.isFunction(onSuccess)) {
            opts.call = onSuccess;
        } else {
            opts['log'] = "Made a directory: [project=" + project + ", path=" + path + "]";
        }
        if (Object.isFunction(onFailure)) opts.onFailure = onFailure;

        this.request('PUT', url, null, opts);
    },
    
    // ** {{{ removeDirectory(project, path, onSuccess, onFailure) }}}
    //
    // Removed a directory
    // 
    // * {{{project}}} is the project to save
    // * {{{path}}} is the path to save to
    // * {{{onSuccess}}} fires if the deletion works
    // * {{{onFailure}}} fires if the deletion failed
    removeDirectory: function(project, path, onSuccess, onFailure) {
        if (!project) return;
        if (!path) path = '';
        
        var url = Bespin.Path.combineAsDirectory('/file/at', project, path);
        var opts = {};
        if (Object.isFunction(onSuccess)) {
            opts.call = onSuccess;
        } else {
            opts['log'] = "Removed directory: [project=" + project + ", path=" + path + "]";
        }
        if (Object.isFunction(onFailure)) opts.onFailure = onFailure;

        this.request('DELETE', url, null, opts);
    },

     // ** {{{ listOpen(callback) }}}
     //
     // Returns JSON with the key of filename, and the value of an array of usernames:
     // { "foo.txt": ["ben"], "SomeAjaxApp/foo.txt": ["dion"] }
     // 
     // * {{{callback}}} fires after listing the open files
    listOpen: function(callback) {
        this.request('GET', '/file/listopen/', null, {
            call: callback, evalJSON: true, log: 'List open files.' 
        });
    },

    // ** {{{ closeFile(project, path, callback) }}}
    //
    // Close the given file (remove from open sessions)
    // 
    // * {{{project}}} is the project to close from
    // * {{{path}}} is the path to close
    // * {{{callback}}} fires after the file is closed
    closeFile: function(project, path, callback) {
        var path = path || '';
        var url = Bespin.Path.combine('/file/close', project, path);
        this.request('POST', url, null, { call: callback });
    },

    // == EDIT ==

    // ** {{{ editActions(project, path, callback) }}}
    //
    // Get the list of edit actions
    // 
    // * {{{project}}} is the project to edit from
    // * {{{path}}} is the path to edit
    // * {{{callback}}} fires after the edit is done
    editActions: function(project, path, callback) {
        var path = path || '';
        var url = Bespin.Path.combine('/edit/list', project, path);
        this.request('GET', url, null, { call: callback, log: "Edit Actions Complete." });
    },

    // ** {{{ editAfterActions(project, path, callback) }}}
    //
    // Get the list of edit after actions
    // 
    // * {{{project}}} is the project to edit from
    // * {{{path}}} is the path to edit
    // * {{{callback}}} fires after the edit is done
    editAfterActions: function(project, path, index, callback) {
        var path = path || '';
        var url = Bespin.Path.combine('/edit/recent', index, project, path);
        this.request('GET', url, null, { call: callback, log: "Edit After Actions Complete." });
    },

    // ** {{{ doAction(project, path, actions) }}}
    //
    // Store actions to the edit queue
    // 
    // * {{{project}}} is the project
    // * {{{path}}} is the path
    // * {{{actions}}} contain the actions to store
    doAction: function(project, path, actions) {
        var path = path || '';
        var url = Bespin.Path.combine('/edit', project, path);

        var sp = "[" + actions.join(",") + "]";

        this.request('PUT', url, sp, { call: function(){} });
    },

    // == PROJECTS ==
    //
    // still needed: owners, authorize, deauthorize
    
    // ** {{{ exportProject(project, archivetype) }}}
    //
    // Export the project as either a zip file or tar + gz
    // 
    // * {{{project}}} is the project to export
    // * {{{archivetype}}} is either zip | tgz
    exportProject: function(project, archivetype) {
        if (['zip','tgz','tar.gz'].include(archivetype)) {
            var iframe = document.createElement("iframe");
            iframe.src = Bespin.Path.combine('/project/export', project + "." + archivetype);
            iframe.style.display = 'none';
            iframe.style.height = iframe.style.width = "0";
            document.getElementsByTagName("body")[0].appendChild(iframe);
        }
    },

    // ** {{{ importProject(project, url, opts) }}}
    //
    // Import the given file into the given project
    // 
    // * {{{project}}} is the project to export
    // * {{{url}}} is the URL to the file to import
    // * {{{archivetype}}} is either zip | tgz
    importProject: function(project, url, opts) {
        if (opts) { // wrap the import success call in an event to say that the import is complete
            var userCall = opts.call;
            opts.call = function(text, xhr) {
                userCall(text, xhr);
                document.fire("bespin:project:imported", {
                    project: project,
                    url: url
                });
            }
        }
        
        this.request('POST', '/project/fromurl/' + project, url, opts || {});
    },
    
    // ** {{{ renameProject(currentProject, newProject) }}}
    //
    // Import the given file into the given project
    // 
    // * {{{currentProject}}} is the current name of the project
    // * {{{newProject}}} is the new name
    renameProject: function(currentProject, newProject) {
        if (currentProject && newProject) {
            this.request('POST', '/project/rename/' + currentProject, newProject);
        }
    },

    // == SETTINGS ==
    //
    //
    // * GET /settings/ to list all settings for currently logged in user as json dict
    // * GET /settings/[setting] to get the value for a single setting as json string
    // * POST /settings/ with HTTP POST DATA (in standard form post syntax) to set the value for a collection of settings (all values are strings)
    // * DELETE /settings/[setting] to delete a single setting

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
