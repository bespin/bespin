var DefaultCommands = {
    seed: function(commandline) {
        commandline.addCommand({
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

                    for (name in self.commands) {
                        var command = self.commands[name];
                        if (!showHidden && command.hidden) continue;
                        if (extra && name.indexOf(extra) != 0) continue;

                        var arguments = (command.takes) ? ' [' + command.takes.order.join('] [') + ']' : '';
                        commands.push('<b>' + name + arguments + '</b>: ' + command.preview);
                    }
                }
                self.showInfo(commands.join("<br/>"));
            }
        });

        // -- SETTINGS

        commandline.addCommand({
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
            },
        });

        // -- FILES

        commandline.addCommand({
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
        });

        commandline.addCommand({
            name: 'status',
            preview: 'get info on the current project and file',
            execute: function(self) {
              var file = _editSession.path || 'a new scratch file';
              self.showInfo('Hey ' + _editSession.username + ', you are editing ' + file + ' in project ' + _editSession.project);
            }
        });

        commandline.addCommand({
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
        });

        commandline.addCommand({
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
        });

        commandline.addCommand({
            name: 'clipboard',
            version: 0.1,
            preview: 'export the contents to the clipboard',
            execute: function(self) {
                Clipboard.copy(self.editor.model.getDocument());

                self.showInfo('Saved file contents to clipboard');
            }
        });

        commandline.addCommand({
            name: 'save',
            takes: ['filename'],
            preview: 'save the current contents',
            completeText: 'add the filename to save as, or use the current file',
            execute: function(self, filename) {
                document.fire("bespin:editor:savefile", {
                    filename: filename
                });
            }
        });

        commandline.addCommand({
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
        });

        commandline.addCommand({
            name: 'newfile',
            //aliases: ['new'],
            takes: ['filename'],
            preview: 'create a new buffer for file',
            completeText: 'optionally, name the new filename',
            execute: function(self, filename) {
                var opts = (filename) ? { newfilename: filename } : {};
                document.fire("bespin:editor:newfile", opts);
            }
        });

        commandline.addCommand({
            name: 'rm',
            aliases: ['remove', 'del'],
            takes: ['filename'],
            preview: 'remove the file',
            completeText: 'add the filename to remove',
            execute: function(self, filename) {
                self.files.removeFile(_editSession.project, filename, function() {
                    self.editor.model.clear();
                    self.showInfo('Removed file: ' + filename, true);
                });
            }
        });

        commandline.addCommand({
            name: 'clear',
            aliases: ['cls'],
            preview: 'clear the file',
            execute: function(self) {
                self.editor.model.clear();
            }
        });

        commandline.addCommand({
            name: 'goto',
            takes: ['linenumber'],
            preview: 'move it! make the editor head to your line number.',
            completeText: 'add the line number to move to',
            execute: function(self, linenumber) {
                if (linenum) {
                    var linenumAsInt = parseInt(linenumber) - 1;
                    // TODO: Cheats and jumps 10 down first so ensureCursorVisable doesn't show as the last line
                    self.editor.moveCursor({ row: linenumAsInt + 10, col: 0 });
                    self.editor.ui.ensureCursorVisible();
                    self.editor.moveCursor({ row: linenumAsInt, col: 0 });
                }
            }
        });

        commandline.addCommand({
            name: 'replace',
            takes: ['search', 'replace'],
            preview: 's/foo/bar/g',
            completeText: 'add the search regex, and then the replacement text',
            execute: function(self, args) {
                self.editor.model.replace(args.search, args.replace);
            }
        });

        commandline.addCommand({
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
        });

        commandline.addCommand({
            name: 'logout',
            preview: 'log out',
            execute: function(self) {
                delete _editSession.username;
                _server.logout();
            }
        });

        commandline.addCommand({
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
        });

        commandline.addCommand({
            name: 'action',
            takes: ['actionname'],
            preview: 'execute any editor action',
            hidden: true,
            execute: function(self, actionname) {
                document.fire("bespin:editor:doaction", {
                    action: actionname
                });
            }
        });

        commandline.addCommand({
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
        });

        commandline.addCommand({
            name: 'doctype',
            takes: ['section'], // part on the Wiki
            preview: 'grab the doctype info for a section',
            completeText: 'can you give me the Doctype wiki section?',
            execute: function(self, section) {
                //TODO grab the HTML: http://code.google.com/p/doctype/wiki/SectionElement?show=content
            }
        });
        
        commandline.addCommand({
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
        });

        commandline.addCommand({
            name: 'bindkey',
            takes: ['modifier', 'key', 'action'],
            preview: 'Bind a key to an action',
            completeText: 'give a modifier, key, and action name',
            hidden: true,
            execute: function(self, args) {
                if (args.modifiers == "none") args.modifiers = '';

                document.fire("bespin:editor:bindkey", args);
            }
        });

        commandline.addCommand({
            name: 'insert',
            takes: ['text'],
            preview: 'insert the given text at this point.',
            hidden: true,
            execute: function(self, text) {
                self.editor.model.insertChunk(self.editor.cursorPosition, text);
            }
        });

        commandline.addCommand({
            name: 'template',
            takes: ['type'],
            preview: 'insert templates',
            completeText: 'pass in the template name',
            templates: { 'in': "for (var key in object) {\n\n}"},
            execute: function(cmdline, type) {
                cmdline.editor.model.insertChunk(cmdline.editor.cursorPosition, this.templates[type]);
            }
        });

        commandline.addCommand({
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
        });

        commandline.addCommand({
            name: 'history',
            preview: 'show history of the commands',
            execute: function(self) {
                self.showInfo('<u>Command History</u><br/><br/>' + self.commandLineHistory.history.join('<br/>'));
            }
        });

        commandline.addCommand({
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
        });
    }
};
