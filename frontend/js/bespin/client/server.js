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

dojo.provide("bespin.client.server");

dojo.require("bespin.util.util");

// = Server =
//
// The Server object implements the [[https://wiki.mozilla.org/BespinServerAPI|Bespin Server API]]
// giving the client access to the backend store. The {{{FileSystem}}} object uses this to talk back.

dojo.declare("bespin.client.Server", null, {
    // ** {{{ initialize(base) }}}
    //
    // Object creation initialization
    //
    // * {{{base}}} is the base server URL to access
    constructor: function(base) {
        this.SERVER_BASE_URL = base || '.';

        // Stores the outstanding asynchronous tasks that we've submitted
        this._jobs = {};
        this._jobsCount = 0;
    },

    // == Helpers ==

    // This is a nasty hack to call callback like onSuccess and if there is
    // some syntax problem to do something other than swallow the error
    _callCallback: function(options, functionName, args) {
        if (dojo.isFunction(options[functionName])) {
            try {
                options[functionName].apply(null, args);
                return true;
            } catch (ex) {
                console.group("Error calling options." + functionName + " from server.request");
                console.log(options);
                console.log(options[functionName].toString());
                console.error(ex);
                console.trace();
                console.groupEnd();

                // If got an exception on success it's really a failure
                if (functionName == "onSuccess" && dojo.isFunction(options['onFailure'])) {
                    try {
                        options.onFailure({ responseText: ex.toString() });
                    } catch (ex) {
                        console.group("Error calling options.onFailure from server.request");
                        console.error(ex);
                        console.trace();
                        console.groupEnd();
                    }
                }
            }
        }

        return false;
    },

    // ** {{{ request(method, url, payload, callbackOptions) }}}
    //
    // The core way to access the backend system.
    // Similar to the Prototype Ajax.Request wrapper
    //
    // * {{{method}}} is the HTTP method (GET|POST|PUT|DELETE)
    // * {{{url}}} is the sub url to hit (after the base url)
    // * {{{payload}}} is what to send up for POST requests
    // * {{{options}}} is how you pass in various callbacks.
    //   options['evalJSON'] = true or false to auto eval
    //   options['onSuccess'] = the main success callback
    //   options['onFailure'] = call for general failures
    //   options['on' + STATUS CODE] = call for specific failures
    //   options['log'] = just log the following
    request: function(method, url, payload, options) {
        var server = this;
        var xhr = new XMLHttpRequest();

        if (location.href.indexOf("file:") == 0){ // if developing and using this locally only!
           try {
               if (netscape.security.PrivilegeManager.enablePrivilege) {
                   netscape.security.PrivilegeManager.enablePrivilege('UniversalBrowserRead');
               }
           } catch (ex) {
           }
        }

        if (options) { // do it async (best)
            var onreadystatechange = function() {
                if (xhr.readyState == 4) {
                    if (xhr.status && xhr.status != 0 && (xhr.status >= 200 && xhr.status < 300)) {
                        var response = xhr.responseText;

                        if (options['evalJSON'] && response) {
                            try {
                                response = dojo.fromJson(response);
                            } catch (syntaxException) {
                                console.log("Couldn't eval the JSON: " + response + " (SyntaxError: " + syntaxException + ")");
                            }
                        }

                        var handled = server._callCallback(options, "onSuccess", [ response, xhr ]);

                        if (!handled && options['log']) {
                            console.log(options.log);
                        }
                    } else {
                        var handled = server._callCallback(options, 'on' + xhr.status, [ xhr ]);
                        if (!handled) {
                            server._callCallback(options, 'onFailure', [ xhr ]);
                        }
                    }
                }
            };
            var cl = bespin.get("commandLine");
            if (cl) onreadystatechange = cl.link(onreadystatechange);
            xhr.onreadystatechange = onreadystatechange;
            xhr.open(method, this.SERVER_BASE_URL + url, true); // url must have leading /
            var token = dojo.cookie("Domain-Token");
            if (!token) {
                token = bespin.util.randomPassword();
                dojo.cookie("Domain-Token", token);
            }
            xhr.setRequestHeader("X-Domain-Token", token);
            xhr.setRequestHeader("Content-Type", 'application/x-www-form-urlencoded');
            if (options.headers) {
                for (var key in options.headers) {
                    if (options.headers.hasOwnProperty(key)) {
                        xhr.setRequestHeader(key, options.headers[key]);
                    }
                }
            }
            xhr.send(payload);
        } else {
            var fullUrl = this.SERVER_BASE_URL + url;
            console.log("Are you sure you want to do a synchronous Ajax call? Really? " + fullUrl);
            xhr.open(method, fullUrl, false);
            xhr.send(payload);
            return xhr.responseText;
        }
    },

    // ** {{{ requestDisconnected() }}}
    // As request() except that the response is fetched without a connection,
    // instead using the /messages URL
    requestDisconnected: function(method, url, payload, instruction, options) {
        options.evalJSON = true;
        // The response that we get from the server isn't a 'done it' response
        // any more - it's just a 'working on it' response.
        options.originalOnSuccess = options.onSuccess;

        var self = this;
        options.onSuccess = function(response, xhr) {
            if (response.jobid == null) {
                console.error("Missing jobid", response);
                options.onFailure(xhr);
                return;
            }

            if (response.taskname) {
                console.log("Server is running : " + response.taskname);
            }

            self._jobs[response.jobid] = {
                jobid: response.jobid,
                options: options
            };
            self._jobsCount++;
            self._checkPolling();
        };

        this.request(method, url, payload, options);
    },

    // ** {{{ _checkPolling() }}}
    // Do we need to set off another poll?
    _checkPolling: function() {
        if (this._jobsCount == 0) return;
        if (this._timeout != null) return;

        this._poll();
    },

    _processResponse: function(message) {
        if (message.jobid === undefined) {
            console.warning("Missing jobid in message", message);
            return;
        }

        var job = this._jobs[message.jobid];
        if (!job) {
            console.debug("job unknown. page reload?", message, this);
            return;
        }

        // TODO: Errors come through with message.error=true, but we're not
        // currently doing anything with that. It's complicated by the
        // need for a partial error system, and the question about how we
        // treat messages that errored half way through
        if (message.asyncDone) {
            if (dojo.isArray(job.partials)) {
                // We're done, and we've got outstanding messages
                // that we need to pass on. We aggregate the
                // messages and call originalOnSuccess
                job.partials.push(message.output);
                job.options.originalOnSuccess(job.partials.join("<br/>"));
            } else {
                // We're done, and all we have is what we've just
                // been sent, so just call originalOnSuccess
                job.options.originalOnSuccess(message.output);
            }
        }
        else {
            if (dojo.isFunction(job.options.onPartial)) {
                // In progress, and we have somewhere to send the
                // messages that we've just been sent
                job.options.onPartial(message.output);
            } else {
                // In progress, and no-where to send the messages,
                // so we store them for onSuccess when we're done
                job.partials.push(message.output);
            }
        }

        if (message.asyncDone) {
            if (this._jobsCount > 0) {
                this._jobsCount--;
            }
            delete this._jobs[message.jobid];
        }
    },

    // ** {{{ _poll() }}}
    // Starts up message retrieve for this user. Call this only once.
    _poll: function() {
        var self = this;

        this.request('POST', '/messages/', null, {
            evalJSON: true,
            onSuccess: function(messages) {

                for (var i = 0; i < messages.length; i++) {
                    self._processResponse(messages[i]);
                }

                setTimeout(function() {
                    self._checkPolling();
                }, 1000);
            },
            onFailure: function(message) {
                self._processResponse(message);

                setTimeout(function() {
                    self._checkPolling();
                }, 1000);
            }
        });
    },

    // ** {{{ fetchResource() }}}
    //
    // Generic system to read resources from a URL and return the read data to
    // a callback.
    fetchResource: function(name, onSuccess, onFailure) {
        this.request('GET', name, null, {
            onSuccess: onSuccess,
            onFailure: onFailure
        });
    },

    // == USER ==

    // ** {{{ login(user, pass, token, onSuccess, notloggedin) }}}
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
            onSuccess: onSuccess,
            on401: onFailure,
            log: 'Login complete.'
        });
    },

    // ** {{{ signup(user, pass, email, onSuccess, notloggedin, userconflict) }}}
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
        var data = "password=" + escape(pass) + "&email=" + escape(email);
        this.request('POST', url, data, {
            onSuccess: onSuccess,
            on401: notloggedin,
            on409: userconflict,
            log: 'Login complete.'
        });
    },

    // ** {{{ logout(onSuccess) }}}
    //
    // Logout from the backend
    //
    // * {{{onSuccess}}} fires after the logout attempt
    logout: function(onSuccess) {
        var url = "/register/logout/";
        this.request('POST', url, null, { log: 'Logout complete.', onSuccess: onSuccess });
    },

    // ** {{{ currentuser(onSuccess, notloggedin) }}}
    //
    // Return info on the current logged in user
    //
    // * {{{onSuccess}}} fires after the user attempt
    // * {{{notloggedin}}} fires if the user isn't logged in
    currentuser: function(whenLoggedIn, whenNotloggedin) {
        var url = "/register/userinfo/";
        return this.request('GET', url, null,
                { onSuccess: whenLoggedIn, on401: whenNotloggedin, evalJSON: true });
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
        var url = bespin.util.path.combine('/file/list/', project, path || '/');
        var opts = { onSuccess: onSuccess, evalJSON: true, log: "Listing files in: " + url };
        if (dojo.isFunction(onFailure)) opts.onFailure = onFailure;

        this.request('GET', url, null, opts);
    },

    // ** {{{ listAllFiles(project, onSuccess, onFailure) }}}
    //
    // List *all* files in the given project. Be *aware*: this will be a huge json-result!
    //
    // * {{{project}}} is the project to list all files from
    // * {{{onSuccess}}} fires if the list returns something
    // * {{{onFailure}}} fires if there is an error getting a list from the server
    listAllFiles: function(project, onSuccess, onFailure) {
        var project = project || '';
        var url = bespin.util.path.combine('/file/list_all/', project, '/');
        var opts = { onSuccess: onSuccess, evalJSON: true, log: "Listing all files in: " + url };
        if (dojo.isFunction(onFailure)) opts.onFailure = onFailure;

        this.request('GET', url, null, opts);
    },

    // ** {{{ projects(onSuccess) }}}
    //
    // Return the list of projects that you have access too
    //
    // * {{{onSuccess}}} gets fired with the project list
    projects: function(onSuccess) {
        this.request('GET', '/file/list/', null, { onSuccess: onSuccess, evalJSON: true });
    },

    // ** {{{ saveFile(project, path, contents, lastOp) }}}
    //
    // Save the given file
    //
    // * {{{project}}} is the project to save
    // * {{{path}}} is the path to save to
    // * {{{contents}}} fires after the save returns
    // * {{{lastOp}}} contains the last edit operation
    saveFile: function(project, path, contents, lastOp, opts) {
        if (!project || !path) return;
        opts = opts || {};
        opts.log = 'Saved file "' + project + '/' + path+ '"';

        var url = bespin.util.path.combine('/file/at', project, (path || ''));
        if (lastOp) url += "?lastEdit=" + lastOp;

        this.request('PUT', url, contents, opts);
    },

    // ** {{{ loadFile(project, path, contents) }}}
    //
    // Load the given file
    //
    // * {{{project}}} is the project to load from
    // * {{{path}}} is the path to load
    // * {{{onSuccess}}} fires after the file is loaded
    loadFile: function(project, path, onSuccess, onFailure) {
        var project = project || '';
        var path = path || '';
        var url = bespin.util.path.combine('/file/at', project, path);
        var opts = { onSuccess: onSuccess };
        if (dojo.isFunction(onFailure)) opts.onFailure = onFailure;

        this.request('GET', url, null, opts);
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
        var url = bespin.util.path.combine('/file/at', project, path);
        var opts = { onSuccess: onSuccess };
        if (dojo.isFunction(onFailure)) opts.onFailure = onFailure;

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

        var url = bespin.util.path.combineAsDirectory('/file/at', project, (path || ''));
        var opts = {};
        if (dojo.isFunction(onSuccess)) {
            opts.onSuccess = onSuccess;
        } else {
            opts['log'] = "Made a directory: [project=" + project + ", path=" + path + "]";
        }
        if (dojo.isFunction(onFailure)) opts.onFailure = onFailure;

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

        var url = bespin.util.path.combineAsDirectory('/file/at', project, path);
        var opts = {};
        if (dojo.isFunction(onSuccess)) {
            opts.onSuccess = onSuccess;
        } else {
            opts['log'] = "Removed directory: [project=" + project + ", path=" + path + "]";
        }
        if (dojo.isFunction(onFailure)) opts.onFailure = onFailure;

        this.request('DELETE', url, null, opts);
    },

     // ** {{{ listOpen(onSuccess) }}}
     //
     // Returns JSON with the key of filename, and the value of an array of usernames:
     // { "foo.txt": ["ben"], "SomeAjaxApp/foo.txt": ["dion"] }
     //
     // * {{{onSuccess}}} fires after listing the open files
    listOpen: function(onSuccess) {
        this.request('GET', '/file/listopen/', null, {
            onSuccess: onSuccess, evalJSON: true, log: 'List open files.'
        });
    },

    // ** {{{ closeFile(project, path, onSuccess) }}}
    //
    // Close the given file (remove from open sessions)
    //
    // * {{{project}}} is the project to close from
    // * {{{path}}} is the path to close
    // * {{{onSuccess}}} fires after the file is closed
    closeFile: function(project, path, onSuccess) {
        var path = path || '';
        var url = bespin.util.path.combine('/file/close', project, path);
        this.request('POST', url, null, { onSuccess: onSuccess });
    },

    // ** {{{ searchFiles(project, searchstring, onSuccess) }}}
    //
    // Search for files within the given project
    //
    // * {{{project}}} is the project to look from
    // * {{{searchstring}}} to compare files with
    // * {{{onSuccess}}} fires after the file is closed
    searchFiles: function(project, searchkey, onSuccess) {
        var url = bespin.util.path.combine('/file/search', project+'?q='+escape(searchkey));
        var opts = { onSuccess: onSuccess, evalJSON: true, log: "Listing searchfiles for: " + project + ", searchkey: " + searchkey};
        this.request('GET', url, null, opts);
    },

    // == EDIT ==

    // ** {{{ editActions(project, path, onSuccess) }}}
    //
    // Get the list of edit actions
    //
    // * {{{project}}} is the project to edit from
    // * {{{path}}} is the path to edit
    // * {{{onSuccess}}} fires after the edit is done
    editActions: function(project, path, onSuccess) {
        var path = path || '';
        var url = bespin.util.path.combine('/edit/list', project, path);
        this.request('GET', url, null, { onSuccess: onSuccess, log: "Edit Actions Complete." });
    },

    // ** {{{ editAfterActions(project, path, onSuccess) }}}
    //
    // Get the list of edit after actions
    //
    // * {{{project}}} is the project to edit from
    // * {{{path}}} is the path to edit
    // * {{{onSuccess}}} fires after the edit is done
    editAfterActions: function(project, path, index, onSuccess) {
        var path = path || '';
        var url = bespin.util.path.combine('/edit/recent', index, project, path);
        this.request('GET', url, null, { onSuccess: onSuccess, log: "Edit After Actions Complete." });
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
        var url = bespin.util.path.combine('/edit', project, path);

        var sp = "[" + actions.join(",") + "]";

        this.request('PUT', url, sp, { onSuccess: function(){} });
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
        if (bespin.util.include(['zip','tgz','tar.gz'], archivetype)) {
            var iframe = document.createElement("iframe");
            iframe.src = bespin.util.path.combine('/project/export', project + "." + archivetype);
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
            var userCall = opts.onSuccess;
            opts.onSuccess = function(text, xhr) {
                userCall(text, xhr);
                bespin.publish("project:imported", {
                    project: project,
                    url: url
                });
            };
        }

        this.request('POST', '/project/fromurl/' + project, url, opts || {});
    },

    // ** {{{ renameProject(currentProject, newProject) }}}
    //
    // Import the given file into the given project
    //
    // * {{{currentProject}}} is the current name of the project
    // * {{{newProject}}} is the new name
    renameProject: function(currentProject, newProject, opts) {
        if (!opts) opts = { log: "Renaming project from " + currentProject + " to " + newProject };
        if (currentProject && newProject) {
            this.request('POST', '/project/rename/' + currentProject + "/", newProject, opts);
        }
    },

    // == SETTINGS ==
    //
    //
    // * GET /settings/ to list all settings for currently logged in user as json dict
    // * GET /settings/[setting] to get the value for a single setting as json string
    // * POST /settings/ with HTTP POST DATA (in standard form post syntax) to set the value for a collection of settings (all values are strings)
    // * DELETE /settings/[setting] to delete a single setting

    listSettings: function(onSuccess) {
        if (typeof onSuccess == "function") {
            this.request('GET', '/settings/', null, { onSuccess: onSuccess, evalJSON: true });
        }
    },

    getSetting: function(name, onSuccess) {
        if (typeof onSuccess == "function") {
            this.request('GET', '/settings/' + name, null, { onSuccess: onSuccess });
        }
    },

    setSetting: function(name, value, onSuccess) {
        var settings = {};
        settings[name] = value;
        this.setSettings(settings, (onSuccess || function(){}));
    },

    setSettings: function(settings, onSuccess) {
        this.request('POST', '/settings/', dojo.objectToQuery(settings), { onSuccess: (onSuccess || function(){}) });
    },

    unsetSetting: function(name, onSuccess) {
        this.request('DELETE', '/settings/' + name, null, { onSuccess: (onSuccess || function(){}) });
    },

    // ** {{{ fileTemplate() }}}
    // Starts up message retrieve for this user. Call this only once.
    fileTemplate: function(project, path, templateOptions, opts) {
        var url = bespin.util.path.combine('/file/template', project, path);
        this.request('PUT', url,
                    dojo.toJson(templateOptions), opts || {});
    },

    // ** {{{ projectTemplate() }}}
    // Create a new project based on a template. templateOptions
    // must include templateName to specify which template to use.
    // templateOptions can include other values that will be plugged
    // in to the template.
    projectTemplate: function(project, templateOptions, opts) {
        var url = bespin.util.path.combine('/project/template/', project, "");
        this.request('POST', url,
                    dojo.toJson(templateOptions), opts || {});
    },

    lost: function(values, opts) {
        var opts = opts || {};
        var url = '/register/lost/';
        this.request('POST', url, dojo.objectToQuery(values), opts);
    },

    changePassword: function(username, newPassword, verifyCode, opts) {
        var url = "/register/password/" + username;
        var opts = opts || {};
        var query = {newPassword: newPassword, code: verifyCode};
        this.request('POST', url, dojo.objectToQuery(query), opts);
    },

    rescan: function(project, instruction, opts) {
        this.requestDisconnected('POST', '/project/rescan/' + escape(project),
                {}, instruction, opts);
    }
});
