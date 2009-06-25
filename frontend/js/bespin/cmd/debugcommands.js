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

    // ** {{{Command: template}}} **
    commandStore.addCommand({
        name: 'template',
        takes: ['type'],
        preview: 'insert templates',
        completeText: 'pass in the template name',
        templates: { 'in': "for (var key in object) {\n\n}" },
        execute: function(instruction, type) {
            var value = this.templates[type];
            if (value) {
                var editor = bespin.get("editor");
                editor.model.insertChunk(editor.cursorPosition, value);
            } else {
                var names = [];
                for (var name in this.templates) { names.push(name); }
                var complain = (!type || type == "") ? "" : "Unknown pattern '" + type + "'.<br/>";
                instruction.addErrorOutput(complain + "Known patterns: " + names.join(", "));
            }
        }
    });

    // ** {{{Command: use}}} **
    commandStore.addCommand({
        name: 'use',
        takes: ['type'],
        preview: 'use patterns to bring in code',
        completeText: '"sound" will add sound support',
        uses: {
            sound: function() {
                bespin.get("editor").model.insertChunk({ row: 3, col: 0 },
                    '  <script type="text/javascript" src="soundmanager2.js"></script>\n');
                bespin.get("editor").model.insertChunk({ row: 4, col: 0 },
                    "  <script>\n  var sound; \n  soundManager.onload = function() {\n    sound =  soundManager.createSound('mySound','/path/to/mysoundfile.mp3');\n  }\n  </script>\n");
            },
            jquery: function() {
                var jslib = 'http://ajax.googleapis.com/ajax/libs/jquery/1.2.6/jquery.min.js';
                var script = '<script type="text/javascript" src="' + jslib + '"></script>\n';
                bespin.get("editor").model.insertChunk({ row: 3, col: 0 }, script);
            }
        },
        execute: function(instruction, type) {
            if (dojo.isFunction(this.uses[type])) {
                this.uses[type]();
                instruction.addOutput("Added code for " + type + ".<br>Please check the results carefully.");
            } else {
                var names = [];
                for (var name in this.uses) { names.push(name); }
                var complain = (!type || type == "") ? "" : "Unknown pattern '" + type + "'.<br/>";
                instruction.addErrorOutput(complain + "Known patterns: " + names.join(", "));
            }
        }
    });

    // ** {{{Command: codecomplete}}} **
    commandStore.addCommand({
        name: 'complete',
        preview: 'auto complete a piece of code',
        completeText: 'enter the start of the string',
        withKey: "SHIFT SPACE",
        execute: function(instruction, args) {
            console.log("Complete");
        }
    });

    //** {{{Command: slow}}} **
    commandStore.addCommand({
        name: 'slow',
        takes: ['seconds'],
        preview: 'create some output, slowly, after a given time (default 5s)',
        execute: function(instruction, seconds) {
            seconds = seconds || 5;

            setTimeout(instruction.link(function() {
                bespin.publish("session:status");
            }), seconds * 1000);
        }
    });

})();
