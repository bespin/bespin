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
})();
