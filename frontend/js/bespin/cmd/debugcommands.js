dojo.provide("bespin.cmd.debugcommands");

(function() {
    var commandStore = bespin.get("commandLine").commandStore;

    // ** {{{Command: action}}} **
    commandStore.addCommand({
        name: 'action',
        takes: ['actionname'],
        preview: 'execute any editor action',
        hidden: true,
        execute: function(commandline, actionname) {
            bespin.publish("editor:doaction", {
                action: actionname
            });
        }
    });

    // ** {{{Command: echo}}} **
    commandStore.addCommand({
        name: 'echo',
        takes: ['message ...'],
        preview: 'A test echo command',
        // ** {{{execute}}}
        execute: function(commandline, args) {
            commandline.addOutput(args);
        }
    });

    // ** {{{Command: login}}} **
    commandStore.addCommand({
        name: 'login',
        // aliases: ['user'],
        //            takes: ['username', 'password'],
        hidden: true,
        takes: {
            order: ['username', 'password'],
            username: {
                "short": 'u'
            },
            password: {
                "short": 'p',
                optional: true
            }
        },
        preview: 'login to the service',
        completeText: 'pass in your username and password',
        execute: function(commandline, args) {
            if (!args) { // short circuit if no username
                commandline.executeCommand("status");
                return;
            }
            bespin.get('editSession').username = args.user; // TODO: normalize syncing
            bespin.get('server').login(args.user, args.pass);
        }
    });

    // ** {{{Command: insert}}} **
    commandStore.addCommand({
        name: 'insert',
        takes: ['text'],
        preview: 'insert the given text at this point.',
        hidden: true,
        execute: function(commandline, text) {
            commandline.editor.model.insertChunk(commandline.editor.getModelPos(), text);
        }
    });

    // ** {{{Command: readonly}}} **
    commandStore.addCommand({
        name: 'readonly',
        takes: ['flag'],
        preview: 'Turn on and off readonly mode',
        hidden: true,
        execute: function(commandline, flag) {
            var msg;

            if (flag === undefined || flag == '') {
                flag = !commandline.editor.readonly;
                msg = "Toggling read only to " + flag;
            } else if (flag == 'off' || flag == 'false') {
                flag = false;
                msg = "No more read-only!";
            } else {
                flag = true;
                msg = "Read only mode turned on.";
            }
            commandline.editor.setReadOnly(flag);
            commandline.addOutput(msg);
        }
    });

    // ** {{{Command: showevents}}} **
    commandStore.addCommand({
        name: 'showevents',
        takes: ['arg'],
        preview: 'Display the events available via pub/sub.',
        hidden: true,
        execute: function(commandline, arg) {
            var all = typeof arg != "undefined" && arg == "all";
            var html = "<u>Showing all Bespin Events</u><br><br>";
            for (var topic in dojo._topics) {
                if (all || topic.indexOf("bespin:") == 0) {
                    html += topic + "<br>";
                }
            }
            commandline.addOutput(html);
        }
    });

    // ** {{{Command: typingtest}}} **
    commandStore.addCommand({
        name: 'typingtest',
        preview: 'type in the alphabet a few times',
        hidden: true,
        execute: function(commandline) {
            var start = Date.now();

            for (var i = 0; i < 3; i++) {
                dojo.forEach(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'], function(c) {
                    var args = { pos: bespin.editor.utils.copyPos(commandline.editor.getCursorPos()) };
                    args.newchar = c;
                    commandline.editor.ui.actions.insertCharacter(args);
                });
            }

            var stop = Date.now();

            commandline.addOutput("It took " + (stop - start) + " milliseconds to do this");
        }
    });

    // ** {{{Command: test}}} **
    commandStore.addCommand({
        name: 'test',
        preview: 'Run some automated end to end tests',
        script: [
            { send:"echo Starting", expect:/^Starting$/ },
            { send:"follow", expect:/sds/ },
            { send:"echo Finished", expect:/^Finished$/ }
        ],
        // ** {{{_setup}}}
        _setup: function(commandline, onSuccess) {
            this.originalShowInfo = commandline.showInfo;
            var self = this;
            bespin.get('server').request('POST', '/test/setup/', null, {
                onSuccess: onSuccess,
                onFailure: function(xhr) {
                    self._cleanup(commandline, "_setup() failed. Maybe due to: " + xhr.responseText);
                }
            });
        },
        // ** {{{_cleanup}}}
        _cleanup: function(commandline, reason) {
            commandline.showInfo = this.originalShowInfo;
            commandline.addOutput(reason);
            bespin.get('server').request('POST', '/test/cleanup/', null, {
                onSuccess: function() {
                    console.log("Server cleanup completed");
                },
                onFailure: function(xhr) {
                    commandline.addErrorOutput("_setup() failed. Maybe due to: " + xhr.responseText);
                }
            });
        },
        // ** {{{_runNextElement}}}
        _runNextElement: function(commandline, script, index) {
            console.log("_runNextElement", index);
            if (index >= script.length) {
                this._cleanup(commandline, "Finished running tests");
                return;
            }
            var element = script[index];
            var self = this;
            commandline.showInfo = function(html, autohide) {
                var info = dojo.byId('info');
                info.innerHTML = html;
                var text = info.textContent;
                if (element.expect.test(text)) {
                    self._runNextElement(commandline, script, index + 1);
                }
                else {
                    console.error("Test failure at index:", index);
                    console.log("Command: ", element.send);
                    console.log("Expected: ", element.expect.source);
                    console.log("Received:", text);
                    self._cleanup(commandline, "Test failure at index: " + index + "<br/>Command: '" + element.send + "'<br/>Expected: /" + element.expect.source + "/<br/>Received: '" + text + "'");
                }
            };
            commandline.executeCommand(element.send);
        },
        // ** {{{execute}}}
        execute: function(commandline) {
            var self = this;
            this._setup(commandline, function() {
                self._runNextElement(commandline, self.script, 0);
            });
        }
    });
})();
