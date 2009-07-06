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
        var list = this._parseArguments(givenPath);
        bespin.get('server').list(list.project, list.path, function(filenames) {
            var files = "";
            for (var x = 0; x < filenames.length; x++) {
                files += filenames[x].name + "<br/>";
            }
            instruction.addOutput(files);
        });
    },
    findCompletions: function(query, callback) {
        var givenPath = query.action.join(" ");
        var list = this._parseArguments(givenPath);
        var self = this;
        bespin.get('server').list(list.project, list.path, function(files) {
            var matches = files.filter(function(file) {
                return file.name.substr(0, list.filter.length) === list.filter &&
                    file.size === undefined;
            });
            if (matches.length == 1) {
                // Single match: go for autofill and hint
                // This filename generation is lazy - it slaps '/' around and
                // then removes the dups. It's possible that we might be able
                // to calculate where they should go, but it's not always easy
                query.autofill = query.prefix + "/" + list.project + "/" + list.path + matches[0].name;
                query.autofill = query.autofill.replace(/\/+/g, "/");
                query.hint = "Press return to see files in " + query.autofill;
            } else if (matches.length == 0) {
                // No matches, cause an error
                query.error = "No further directories to complete against";
            } else {
                // Multiple matches, present a list
                /*
                matches.sort(function(a, b) {
                    return a.localeCompare(b);
                });
                */
                query.options = matches.map(function(match) {
                    return match.name;
                });
            }

            callback(query);
        });
    },
    _parseArguments: function(givenPath) {
        var session = bespin.get("editSession");

        // Sort out the context
        var project = session.project;
        var path = session.path;
        var parts = path.split(/\//);
        parts.pop(); // Remove the current file
        path = parts.join("/");
        var filter = "";

        if (givenPath) {
            // Everything past the final / is used for filtering and isn't
            // passed to the server
            var parts = givenPath.substr(1).split(/\//);
            filter = parts.pop();
            var trimmedPath = parts.join("/");

            if (givenPath.charAt(0) === "/") {
                // Pull out the leading segment into the project
                // TODO: That's 2 split/join operations on the same data. Optimize?
                var parts = trimmedPath.split(/\//);
                project = parts.shift();
                path = parts.join("/") + "/";
            } else {
                path = path + "/" + trimmedPath;
            }
        }

        return { path:path, project:project, filter:filter };
    }
});

/**
 * 'mkdir' command
 */
bespin.command.store.addCommand({
    name: 'mkdir',
    takes: ['path', 'projectname'],
    preview: 'create a new directory in the given project',
    usage: '[path] [projectname]',
    execute: function(instruction, args) {
        if (!args.path) {
            instruction.addUsageOutput(this);
            return;
        }

        var editSession = bespin.get('editSession');

        var path = args.path;
        var project = args.projectname || editSession.project;

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
    name: 'load',
    aliases: ['open'],
    takes: ['filename', 'project', 'line'],
    preview: 'load up the contents of the file',
    completeText: 'add the filename to open',
    execute: function(instruction, opts) {
        bespin.publish("editor:openfile", opts);
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
    takes: ['filename', 'project'],
    preview: 'create a new buffer for file',
    completeText: 'optionally, name the new filename first, and then the name of the project second',
    withKey: "CTRL SHIFT N",
    execute: function(instruction, args) {
        if (args.filename) {
            args.newfilename = args.filename;
            delete args.filename;
        }
        bespin.publish("editor:newfile", args || {});
    }
});

/**
 * 'rm' command
 */
bespin.command.store.addCommand({
    name: 'rm',
    aliases: ['remove', 'del'],
    takes: ['filename', 'project'],
    preview: 'remove the file',
    completeText: 'add the filename to remove, and optionally a specific project at the end. To delete a directory end the path in a '/'',
    execute: function(instruction, args) {
        var project = args.project || bespin.get('editSession').project;
        var filename = args.filename;

        if (!project) {
            instruction.addErrorOutput("'rm' only works with the project is set.");
            return;
        }

        if (!filename) {
            instruction.addErrorOutput("give me a filename or directory to delete");
            return;
        }

        var onSuccess = instruction.link(function() {
            if (bespin.get('editSession').checkSameFile(project, filename)) {
                bespin.get("editor").model.clear(); // only clear if deleting the same file
            }

            instruction.addOutput('Removed file: ' + filename, true);
            instruction.unlink();
        });

        var onFailure = instruction.link(function(xhr) {
            instruction.addErrorOutput("Wasn't able to remove the file <b>" + filename + "</b><br/><em>Error</em> (probably doesn't exist): " + xhr.responseText);
            instruction.unlink();
        });

        bespin.get('files').removeFile(project, filename, onSuccess, onFailure);
    }
});

/**
 * 'closefile' command
 */
bespin.command.store.addCommand({
    name: 'closefile',
    takes: ['filename', 'project'],
    preview: 'close the file (may lose edits)',
    completeText: 'add the filename to close (defaults to this file).<br>also, optional project name.',
    execute: function(instruction, args) {
        var editSession = bespin.get('editSession');
        var filename = args.filename || editSession.path;  // default to current page
        var project  = args.project  || editSession.project;

        bespin.get('files').closeFile(project, filename, function() {
            bespin.publish("editor:closedfile", { filename: filename });

            // if the current file, move on to a new one
            if (filename == editSession.path) bespin.publish("editor:newfile");

            bespin.get("commandLine").addOutput('Closed file: ' + filename);
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
