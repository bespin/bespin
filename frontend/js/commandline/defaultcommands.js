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

if (!Bespin.Commands) Bespin.Commands = {};

Bespin.Commands.Default = [
{
            name: 'help',
            takes: ['search'],
            preview: 'show commands',
            description: 'The <u>help</u> gives you access to the various commands in the Bespin system.<br/><br/>You can narrow the search of a command by adding an optional search params.<br/><br/>If you pass in the magic <em>hidden</em> parameter, you will find subtle hidden commands.<br/><br/>Finally, pass in the full name of a command and you can get the full description, which you just did to see this!',
            completeText: 'optionally, narrow down the search',
            execute: function(self, extra) {
                var commands = [];
                if (self.commands[extra]) { // caught a real command
                    commands.push("<u>Help for the command: <em>" + extra + "</em></u><br/>");
                    var command = self.commands[extra];
                    commands.push(command['description'] ? command.description : command.preview);
                } else {
                    var showHidden = false;
                    commands.push("<u>Commands Available</u><br/>");

                    if (extra) {
                        if (extra == "hidden") { // sneaky, sneaky.
                            extra = "";
                            showHidden = true;
                        }
                        commands.push("<em>(starting with</em> " + extra + " <em>)</em><br/>");
                    }

                    var tobesorted = [];
                    for (name in self.commands) {
                        tobesorted.push(name);
                    }

                    var sorted = tobesorted.sort();
                    
                    for (var i = 0; i < sorted.length; i++) {
                        var name = sorted[i];
                        var command = self.commands[name];

                        if (!showHidden && command.hidden) continue;
                        if (extra && name.indexOf(extra) != 0) continue;

                        var arguments = (command.takes) ? ' [' + command.takes.order.join('] [') + ']' : '';
                        commands.push('<b>' + name + arguments + '</b>: ' + command.preview);
                    }
                }
                self.showInfo(commands.join("<br/>"));
            }
}, { // -- SETTINGS
            name: 'set',
            takes: ['key', 'value'],
            preview: 'define and show settings',
            completeText: 'optionally, add a key and/or a value, else you will see all settings',
            // complete: function(self, value) {
            //     console.log(self);
            //     console.log(value);
            //     return value;
            // },
            execute: function(self, setting) {
                var output;

                if (!setting.key) { // -- show all
                    var settings = self.settings.list();

                    output = "<u>Your Settings</u><br/><br/>";
                    for (var x = 0; x < settings.length; x++) {
                        if (settings[x].key[0] != '_') {
                            output += settings[x].key + ": " + settings[x].value + "<br/>";
                        }
                    }
                } else {
                    var key = setting.key;
                    if (setting.value == undefined) { // show it
                        output = "<u>Your setting</u><br/><br/>";
                        output += key + ": " + self.settings.get(key);
                    } else {
                        output = "<u>Saving setting</u><br/><br/>";
                        output += key + ": " + setting.value;
                        self.settings.set(key, setting.value);
                    }
                }
                self.showInfo(output);
            }
}, { // -- FILES
            name: 'files',
            aliases: ['ls', 'list'],
            takes: ['project'],
            preview: 'show files',
            completeText: 'optionally, add the project name of your choice',
            execute: function(self, project) {
                var project = project || _editSession.project;
                self.files.fileNames(project, function(fileNames) {
                    var files = "<u>Files in project: " + project + "</u><br/><br/>";
                    for (var x = 0; x < fileNames.length; x++) {
                        files += fileNames[x] + "<br/>";
                    }
                    self.showInfo(files);
                });
            }
}, {
            name: 'status',
            preview: 'get info on the current project and file',
            execute: function(self) {
              var file = _editSession.path || 'a new scratch file';
              self.showInfo('Hey ' + _editSession.username + ', you are editing ' + file + ' in project ' + _editSession.project);
            }
}, {
            name: 'project',
            takes: ['projectname'],
            preview: 'show the current project, or set to a new one',
            completeText: 'optionally, add the project name to change to that project',
            execute: function(self, projectname) {
                if (projectname) {
                    document.fire("bespin:editor:project:set", { project: projectname });
                } else {
                    self.executeCommand('status');
                }
            }
}, {
            name: 'projects',
            preview: 'show projects',
            execute: function(self, extra) {
              self.files.projects(function(projectNames) {
                  var projects = "<u>Your projects</u><br/><br/>";
                  for (var x = 0; x < projectNames.length; x++) {
                    projects += projectNames[x] + "<br/>";
                  }
                  self.showInfo(projects);
              });
            }
}, {
            name: 'clipboard',
            version: 0.1,
            preview: 'export the contents to the clipboard',
            execute: function(self) {
                Clipboard.copy(self.editor.model.getDocument());

                self.showInfo('Saved file contents to clipboard');
            }
}, {
            name: 'save',
            takes: ['filename'],
            preview: 'save the current contents',
            completeText: 'add the filename to save as, or use the current file',
            execute: function(self, filename) {
                document.fire("bespin:editor:savefile", {
                    filename: filename
                });
            }
}, {
            name: 'load',
            aliases: ['open'],
            takes: ['filename'],
            preview: 'load up the contents of the file',
            completeText: 'add the filename to open',
            execute: function(self, filename) {
                document.fire("bespin:editor:openfile", {
                    filename: filename
                });
            }
}, {
            name: 'newfile',
            //aliases: ['new'],
            takes: ['filename'],
            preview: 'create a new buffer for file',
            completeText: 'optionally, name the new filename',
            withKey: "CTRL SHIFT N",            
            execute: function(self, filename) {
                var opts = (filename) ? { newfilename: filename } : {};
                document.fire("bespin:editor:newfile", opts);
            }
}, {
            name: 'rm',
            aliases: ['remove', 'del'],
            takes: ['filename'],
            preview: 'remove the file',
            completeText: 'add the filename to remove',
            execute: function(self, filename) {
                self.files.removeFile(_editSession.project, filename, function() {
                    self.editor.model.clear();
                    self.showInfo('Removed file: ' + filename, true);
                }, function(xhr) {
                    self.showInfo("Wasn't able to remove the file <b>" + filename + "</b><br/><em>Error</em> (probably doesn't exist): " + xhr.responseText);
                });
            }
}, {
            name: 'closefile',
            takes: ['filename'],
            preview: 'close the file (may lose edits)',
            completeText: 'add the filename to close',
            execute: function(self, filename) {
                self.files.closeFile(_editSession.project, filename, function() {
                    document.fire("bespin:editor:closedfile", { filename: filename });
                    if (filename == _editSession.path) document.fire("bespin:editor:newfile");

                    self.showInfo('Closed file: ' + filename, true);
                });
            }
}, {
            name: 'dashboard',
            preview: 'navigate to the file',
            execute: function(self) {
                Navigate.dashboard();
            }
}, {
            name: 'version',
            takes: ['command'],
            preview: 'show the version for Bespin or a command',
            completeText: 'optionally, a command name',
            execute: function(self, command) {
                var bespinVersion = 'Your Bespin is at version ' + Bespin.version;
                var version;
                if (command) {
                    var theCommand = self.commands[command];
                    if (!theCommand) {
                        version = "It appears that there is no command named '" + command + "', but " + bespinVersion;
                    } else {
                        version = (theCommand.version)
                            ? "The command named '" + command + "' is at version " + theCommand.version 
                            : "The command named '" + command + "' is a core command in Bespin version " + Bespin.version;
                    }
                } else {
                    version = bespinVersion;
                }
                self.showInfo(version);
            }
}, {
            name: 'clear',
            aliases: ['cls'],
            preview: 'clear the file',
            execute: function(self) {
                self.editor.model.clear();
            }
}, {
            name: 'goto',
            takes: ['linenumber'],
            preview: 'move it! make the editor head to your line number.',
            completeText: 'add the line number to move to',
            execute: function(self, linenumber) {
                if (linenumber) {
                    var linenumAsInt = parseInt(linenumber) - 1;
                    // Jumps 10 down first so ensureCursorVisable doesn't show as the last line
                    self.editor.moveCursor({ row: linenumAsInt + 10, col: 0 });
                    self.editor.ui.ensureCursorVisible();
                    self.editor.moveCursor({ row: linenumAsInt, col: 0 });
                }
            }
}, {
            name: 'replace',
            takes: ['search', 'replace'],
            preview: 's/foo/bar/g',
            completeText: 'add the search regex, and then the replacement text',
            execute: function(self, args) {
                self.editor.model.replace(args.search, args.replace);
            }
}, {
            name: 'login',
            // aliases: ['user'],
            //            takes: ['username', 'password'],
            hidden: true,
            takes: {
                order: ['username', 'password'],
                username: {
                    "short": 'u',
                },
                password: {
                    "short": 'p',
                    optional: true
                }
            },
            preview: 'login to the service',
            completeText: 'pass in your username and password',
            execute: function(self, args) {
                if (!args) { // short circuit if no username
                    self.executeCommand("status");
                    return;
                }
                _editSession.username = args.user; // TODO: normalize syncing
                _server.login(args.user, args.pass);
            }
}, {
            name: 'logout',
            preview: 'log out',
            execute: function(self) {
                delete _editSession.username;
                _server.logout(function() {
					window.location.href="/";
				});
            }
}, {
            name: 'bespin',
            preview: 'has',
            hidden: true,
            messages: [
                "is a Cloud City.",
                "is your Web editor.",
                "would love to be like Emacs on the Web.",
                "is written on the Web platform, so you can tweak it."
            ],
            execute: function(self) {
                self.showInfo("Bespin " + this.messages[Math.floor(Math.random() * this.messages.length)]);
            }
}, {
            name: 'action',
            takes: ['actionname'],
            preview: 'execute any editor action',
            hidden: true,
            execute: function(self, actionname) {
                document.fire("bespin:editor:doaction", {
                    action: actionname
                });
            }
}, {
            name: 'sort',
            takes: ['direction'],
            preview: 'sort the current buffer',
            completeText: 'optionally, sort descending',
            execute: function(self, direction) {
                var buffer = self.editor.model.getDocument().split(/\n/);
                buffer.sort();
                if (direction && direction.toLowerCase().startsWith("desc")) buffer.reverse();
                self.editor.model.insertDocument(buffer.join("\n"));
            }
}, {
            name: 'export',
            takes: ['project', 'archivetype'],
            preview: 'export the given project with an archivetype of zip or tgz',
            completeText: 'project name, archivetype (zip | tgz, defaults to zip)',
            execute: function(self, args) {
                var project = args.project || _editSession.project;
                
                var type = args.archivetype;
                if (!['zip','tgz','tar.gz'].include(type)) {
                    type = 'zip';
                }

                _server.exportProject(project, type); // try to do it via the iframe
            }
}, {
            name: 'import',
            takes: ['project', 'url'],
            preview: 'import the given url as a project',
            completeText: 'project name, url (to an archive zip | tgz)',
            execute: function(self, args) {
                var project = args.project;
                if (!project) {
                    self.showInfo("Please run: import [projectname] [url of archive]");
                    return;
                }
                
                var url = args.url;
                if (!url || !(url.endsWith('.tgz') || url.endsWith('.tar.gz') || url.endsWith('.zip'))) {
                    self.showInfo("Please run: import [projectname] [url of archive]<br>(make sure the archive is a zip, or tgz)");
                    return;
                }

                _server.importProject(project, url, { call: function(xhr) {
                    self.showInfo("Project '" + project + "' imported from " + url);
                }, onFailure: function(xhr) {
                    self.showInfo("Unable to import '" + project + "' from " + url + ".<br> Maybe due to: " + xhr.responseText);
                }});
            }
}, {
            name: 'doctype',
            takes: ['section'], // part on the Wiki
            preview: 'grab the doctype info for a section',
            completeText: 'can you give me the Doctype wiki section?',
            execute: function(self, section) {
                //TODO grab the HTML: http://code.google.com/p/doctype/wiki/SectionElement?show=content
            }
}, {
            name: 'trim',
            takes: ['side'], // left, right, both
            preview: 'trim trailing or leading whitespace',
            completeText: 'optionally, give a side of left, right, or both (defaults to right)',
            execute: function(self, side) {
                self.editor.model.changeEachRow(function(row) {
                    if (!side) side = "right";
                    if (["left", "both"].include(side)) {
                        console.log(row.first);
                        while (row.first() == ' ') {
                            row.shift();
                        }
                    }
                    if (["right", "both"].include(side)) {
                        var i = row.length - 1;

                        while (row[i] == ' ') {
                            delete row[i];
                            i--;
                        }
                    }
                    return row;
                });
            }
}, {
            name: 'bindkey',
            takes: ['modifier', 'key', 'action'],
            preview: 'Bind a key to an action',
            completeText: 'give a modifier, key, and action name',
            hidden: true,
            execute: function(self, args) {
                if (args.modifiers == "none") args.modifiers = '';

                document.fire("bespin:editor:bindkey", args);
            }
}, {
            name: 'insert',
            takes: ['text'],
            preview: 'insert the given text at this point.',
            hidden: true,
            execute: function(self, text) {
                self.editor.model.insertChunk(self.editor.cursorPosition, text);
            }
}, {
            name: 'template',
            takes: ['type'],
            preview: 'insert templates',
            completeText: 'pass in the template name',
            templates: { 'in': "for (var key in object) {\n\n}"},
            execute: function(cmdline, type) {
                cmdline.editor.model.insertChunk(cmdline.editor.cursorPosition, this.templates[type]);
            }
}, {
            name: 'alias',
            takes: ['alias', 'command'],
            preview: 'define and show aliases for commands',
            completeText: 'optionally, add your alias name, and then the command name',
            execute: function(self, args) {
              var output;
              if (!alias) { // -- show all
                output = "<u>Your Aliases</u><br/><br/>";
                for (var x in self.aliases) {
                  output += x + ": " + self.aliases[x] + "<br/>";
                }
              } else {
                if (args.command == undefined) { // show it
                  output = "<u>Your alias</u><br/><br/>";
                  output += args.alias + ": " + self.aliases[args.alias];
                } else {
                  var key = args.alias;
                  var value = args.command;
                  output = "<u>Saving setting</u><br/><br/>";
                  if (self.commands[value]) {
                      output += key + ": " + value;
                    self.aliases[key] = value;
                  } else if (self.aliases[value]) { // TODO: have the symlink to the alias not the end point
                      output += key + ": " + self.aliases[value] + " (" + value + " was an alias itself)";
                    self.aliases[key] = value;
                  } else {
                    output += "Sorry, no command or alias with that name."
                  }
                }
              }
              self.showInfo(output);
            },
}, {
            name: 'history',
            preview: 'show history of the commands',
            execute: function(self) {
                self.showInfo('<u>Command History</u><br/><br/>' + self.commandLineHistory.history.join('<br/>'));
            }
}, {
            name: 'use',
            preview: 'use patterns to bring in code',
            completeText: '"sound" will add sound support',
            libnames: {
                'jquery': 'jquery.min.js'
            },
            execute: function(self, type) {
                if (type == 'sound') {
                    self.editor.model.insertChunk({ row: 3, col: 0 },
                        '  <script type="text/javascript" src="soundmanager2.js"></script>\n');
                    self.editor.model.insertChunk({ row: 4, col: 0 },
                        "  <script>\n  var sound; \n  soundManager.onload = function() {\n    sound =  soundManager.createSound('mySound','/path/to/mysoundfile.mp3');\n  }\n  </script>\n");
                } else if (type == 'js') {
                    var jslib = 'http://ajax.googleapis.com/ajax/libs/jquery/1.2.6/jquery.min.js';
                    var script = '<script type="text/javascript" src="' + jslib + '"></script>\n';
                    self.editor.model.insertChunk({ row: 3, col: 0 }, script);
                }
            }
}];
