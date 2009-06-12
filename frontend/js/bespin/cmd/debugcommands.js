dojo.provide("bespin.cmd.debugcommands");

(function() {
    var commandStore = bespin.get("commandLine").commandStore;

    // ** {{{Command: action}}} **
    commandStore.addCommand({
        name: 'action',
        takes: ['actionname'],
        preview: 'execute any editor action',
        hidden: true,
        execute: function(instruction, actionname) {
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
        execute: function(instruction, args) {
            instruction.addOutput(args);
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
        execute: function(instruction, args) {
            if (!args) { // short circuit if no username
                bespin.get('commandLine').executeCommand("status");
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
        execute: function(instruction, text) {
            var editor = bespin.get("editor");
            editor.model.insertChunk(editor.getModelPos(), text);
        }
    });

    // ** {{{Command: readonly}}} **
    commandStore.addCommand({
        name: 'readonly',
        takes: ['flag'],
        preview: 'Turn on and off readonly mode',
        hidden: true,
        execute: function(instruction, flag) {
            var msg;

            if (flag === undefined || flag == '') {
                flag = !bespin.get("editor").readonly;
                msg = "Toggling read only to " + flag;
            } else if (flag == 'off' || flag == 'false') {
                flag = false;
                msg = "No more read-only!";
            } else {
                flag = true;
                msg = "Read only mode turned on.";
            }
            bespin.get("editor").setReadOnly(flag);
            instruction.addOutput(msg);
        }
    });

    // ** {{{Command: showevents}}} **
    commandStore.addCommand({
        name: 'showevents',
        takes: ['arg'],
        preview: 'Display the events available via pub/sub.',
        hidden: true,
        execute: function(instruction, arg) {
            var all = typeof arg != "undefined" && arg == "all";
            var html = "<u>Showing all Bespin Events</u><br><br>";
            for (var topic in dojo._topics) {
                if (all || topic.indexOf("bespin:") == 0) {
                    html += topic + "<br>";
                }
            }
            instruction.addOutput(html);
        }
    });

    // ** {{{Command: typingtest}}} **
    commandStore.addCommand({
        name: 'typingtest',
        preview: 'type in the alphabet a few times',
        hidden: true,
        execute: function(instruction) {
            var start = Date.now();

            for (var i = 0; i < 3; i++) {
                dojo.forEach(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'], function(c) {
                    var args = { pos: bespin.editor.utils.copyPos(bespin.get('editor').getCursorPos()) };
                    args.newchar = c;
                    bespin.get('editor').ui.actions.insertCharacter(args);
                });
            }

            var stop = Date.now();

            instruction.addOutput("It took " + (stop - start) + " milliseconds to do this");
        }
    });
})();
