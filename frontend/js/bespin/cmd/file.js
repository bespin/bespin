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

dojo.provide("bespin.cmd.file");

/**
 * 'files' command
 */
bespin.command.store.addCommand({
    name: 'files',
    aliases: ['ls', 'list'],
    takes: ['path'],
    preview: 'show files',
    completeText: 'list files relative to current file, or start with /projectname',
    execute: function(instruction, givenPath) {
        var list = bespin.cmd.file._parseArguments(givenPath, {filter: true});
        bespin.get('server').list(list.project, list.path, function(filenames) {
            var files = "";
            for (var x = 0; x < filenames.length; x++) {
                files += filenames[x].name + "<br/>";
            }
            instruction.addOutput(files);
        });
    },
    findCompletions: function(query, callback) {
        bespin.cmd.file._findCompletionsHelper(query, callback, {
            matchFiles: false,
            matchDirectories: true
        });
    }
});

/**
 * 'mkdir' command
 */
bespin.command.store.addCommand({
    name: 'mkdir',
    takes: ['path'],
    preview: 'create a new directory, use a leading / to create a directory in a different project',
    usage: '[path]',
    execute: function(instruction, givenPath) {
        if (!givenPath) {
            instruction.addUsageOutput(this);
            return;
        }

        var editSession = bespin.get('editSession');
        
        var info = bespin.cmd.file._parseArguments(givenPath);
        var path = info.path;
        var project = info.project || editSession.project;

        var onSuccess = instruction.link(function() {
            if (path == '') editSession.setProject(project);
            instruction.addOutput('Successfully created directory \'/' + project + '/' + path + '\'');
            instruction.unlink();
        });

        var onFailure = instruction.link(function(xhr) {
            instruction.addErrorOutput('Unable to create directory \'/' + project + '/' + path + '\': ' + xhr.responseText);
            instruction.unlink();
        });

        bespin.get('files').makeDirectory(project, path, onSuccess, onFailure);
    }
});

/**
 * 'save' command
 */
bespin.command.store.addCommand({
    name: 'save',
    takes: ['filename'],
    preview: 'save the current contents',
    completeText: 'add the filename to save as, or use the current file',
    withKey: "CMD S",
    execute: function(instruction, filename) {
        bespin.publish("editor:savefile", {
            filename: filename
        });
    }
});

/**
 * 'load' command
 */
bespin.command.store.addCommand({
    name: 'open',
    aliases: ['load'],
    takes: ['path', 'line'],
    preview: 'load up the contents of the file',
    completeText: 'add the filename to open',
    execute: function(instruction, opts) {
        var info = bespin.cmd.file._parseArguments(opts.path);
        var path = info.path;
        var project = info.project;
        
        bespin.publish("editor:openfile", {
            project: project,
            filename: path,
            line: opts.line
        });
        
        bespin.publish("ui:escape", {});
    },
    findCompletions: function(query, callback) {
        bespin.cmd.file._findCompletionsHelper(query, callback, {
            matchFiles: true,
            matchDirectories: true
        });
    }
});

/**
 * 'status' command
 */
bespin.command.store.addCommand({
    name: 'status',
    preview: 'get info on the current project and file',
    execute: function(instruction) {
        instruction.addOutput(bespin.get('editSession').getStatus());
    }
});

/**
 * 'newfile' command
 */
bespin.command.store.addCommand({
    name: 'newfile',
    //aliases: ['new'],
    takes: ['filename'],
    preview: 'create a new buffer for file',
    completeText: 'optionally, you can specify a full path including project by starting the filename with "/"',
    withKey: "CTRL SHIFT N",
    execute: function(instruction, filename) {
        var info = bespin.cmd.file._parseArguments(filename);
        var path = info.path;
        var project = info.project;

        bespin.publish("editor:newfile", {project: project, newfilename: path});
        bespin.publish("ui:escape", {});
    }
});

/**
 * 'rm' command
 */
bespin.command.store.addCommand({
    name: 'rm',
    aliases: ['remove', 'del'],
    takes: ['filename'],
    preview: 'remove the file',
    completeText: 'add the filename to remove, give a full path starting with '/' to delete from a different project. To delete a directory end the path in a '/'',
    execute: function(instruction, filename) {
        var info = bespin.cmd.file._parseArguments(filename);
        var path = info.path;
        var project = info.project;

        var onSuccess = instruction.link(function() {
            if (bespin.get('editSession').checkSameFile(project, path)) {
                bespin.get("editor").model.clear(); // only clear if deleting the same file
            }

            instruction.addOutput('Removed file: ' + filename, true);
            instruction.unlink();
        });

        var onFailure = instruction.link(function(xhr) {
            instruction.addErrorOutput("Wasn't able to remove the file <b>" + filename + "</b><br/><em>Error</em> (probably doesn't exist): " + xhr.responseText);
            instruction.unlink();
        });

        bespin.get('files').removeFile(project, path, onSuccess, onFailure);
    },
    
    findCompletions: function(query, callback) {
        bespin.cmd.file._findCompletionsHelper(query, callback, {
            matchFiles: true,
            matchDirectories: true
        });
    }
});

/**
 * 'clear' command
 */
bespin.command.store.addCommand({
    name: 'clear',
    aliases: ['cls'],
    preview: 'clear the file',
    execute: function(instruction) {
        bespin.get("editor").model.clear();
    }
});

/**
 * 'quota' command
 */
bespin.command.store.addCommand({
    name: 'quota',
    preview: 'show your quota info',
    megabytes: function(bytes) {
        return (bytes / 1024 / 1024).toFixed(2);
    },
    execute: function(instruction) {
        var es = bespin.get('editSession');
        var output = "You have " + this.megabytes(es.quota - es.amountUsed) +
                     " MB free space to put some great code!<br>" +
                     "Used " + this.megabytes(es.amountUsed) + " MB " +
                     "out of your " + this.megabytes(es.quota) + " MB quota.";
        instruction.addOutput(output);
    }
});

/**
 * 'rescan' command
 */
bespin.command.store.addCommand({
    name: 'rescan',
    takes: ['project'],
    preview: 'update the project catalog of files used by quick open',
    execute: function(instruction, project) {
        if (!project) {
            bespin.withComponent('editSession', function(editSession) {
                project = editSession.project;
            });
        }
        bespin.get("server").rescan(project, instruction, {
            onSuccess: instruction.link(function(response) {
                instruction.addOutput(response);
                instruction.unlink();
            }),
            onFailure: instruction.link(function(xhr) {
                instruction.addErrorOutput(xhr.response);
                instruction.unlink();
            })
        });
    }
});

/**
 * Utility to split out a given path as typed on the command line into a
 * structure. The idea is to allow us to pass the project and path into a call
 * to server.list(project, path, ...) and then filter the results based on the
 * filter. For example:
 * <ul>
 * <li>/bespin/docs/e = { project:'bespin', path:'docs/', filter:'e' }
 * <li>/bespin/docs/js/e = { project:'bespin', path:'docs/js/', filter:'e' }
 * <li>/bespin/docs/js/e/ = { project:'bespin', path:'docs/js/e/', filter:'' }
 * <li>/bespin/docs = { project:'bespin', path:'', filter:'docs' }
 * <li>/bespin = { project:'/', path:'', filter:'bespin' }
 * <li>fol = { project:'', path:'', filter:'fol' }
 * </ul>
 */
bespin.cmd.file._parseArguments = function(givenPath, opts) {
    opts = opts || {};
    
    var session = bespin.get("editSession");

    // Sort out the context
    var project = session.project;
    var path = session.path;
    var parts = path.split(/\//);
    parts.pop(); // Remove the current file
    path = parts.join("/");
    var filter = "";
    var projectPath = "";

    if (givenPath) {
        if (givenPath.charAt(0) === "/") {
            // Everything past the final / is used for filtering and isn't
            // passed to the server, and we ignore the initial /
            var parts = givenPath.substr(1).split(/\//);
            filter = parts.pop();
            // Pull out the leading segment into the project
            project = parts.shift() || "";
            
            if (parts.length) {
                path = parts.join("/") + "/";
            } else {
                path = "";
            }

            // Both project and path could be "" at this point ...
            // This filename generation is lazy - it slaps '/' around and
            // then removes the dups. It's possible that we might be able
            // to calculate where they should go, but it's not always easy.
            // Same below
            projectPath = "/" + project + "/" + path;
            projectPath = projectPath.replace(/\/+/g, "/");
        } else {
            // Everything past the final / is used for filtering and isn't
            // passed to the server
            var parts = givenPath.split(/\//);
            filter = parts.pop();
            var trimmedPath = parts.join("/");

            path = path + "/" + trimmedPath;

            projectPath = "";
        }
    }
    
    if (!opts.filter) {
        path = path + filter;
        filter = undefined;
    }

    return { project:project, path:path, filter:filter, projectPath:projectPath };
};

/**
 * A helper to enable commands to implement findCompletions.
 * <p>The parameters are like for findCompletions with the addition of an
 * options object which work as follows:<ul>
 * <li>options.matchDirectories should be true to include directories in the
 * results.
 * <li>options.matchFiles should be true to include files in the results. All
 * uses of this function will include one (or maybe both) of the above
 */
bespin.cmd.file._findCompletionsHelper = function(query, callback, options) {
    var givenPath = query.action.join(" ");
    var list = bespin.cmd.file._parseArguments(givenPath, {filter: true});
    var self = this;
    bespin.get('server').list(list.project, list.path, function(files) {
        var matches = files.filter(function(file) {
            // TODO: Perhaps we should have a better way of detecting a file?
            var isFile = (file.size !== undefined);
            if ((options.matchDirectories && isFile) &&
                (options.matchFiles && !isFile)) {
                return false;
            }
            return file.name.substr(0, list.filter.length) === list.filter;
        });
        if (matches.length == 1) {
            // Single match: go for autofill and hint
            query.autofill = query.prefix + list.projectPath + matches[0].name;
            query.hint = "Press return to " + query.autofill;
        } else if (matches.length == 0) {
            // No matches, cause an error
            query.error = "No matches";
        } else {
            // Multiple matches, present a list
            // TODO: Do we need to sort these.
            // matches.sort(function(a, b) { return a.localeCompare(b); });
            query.options = matches.map(function(match) {
                return match.name;
            });
        }

        callback(query);
    });
};