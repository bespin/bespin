dojo.provide("bespin.editor.component");

dojo.require("bespin.bespin");

dojo.require("bespin.util.canvas");
dojo.require("bespin.util.keys");
dojo.require("bespin.util.navigate");
dojo.require("bespin.util.path");
dojo.require("bespin.util.tokenobject");
dojo.require("bespin.util.util");
dojo.require("bespin.util.mousewheelevent");
dojo.require("bespin.util.urlbar");

dojo.require("bespin.client.filesystem");
dojo.require("bespin.client.settings");
dojo.require("bespin.client.status");
dojo.require("bespin.client.server");
dojo.require("bespin.client.session");

dojo.require("bespin.editor.actions");
dojo.require("bespin.editor.clipboard");
dojo.require("bespin.editor.cursor");
dojo.require("bespin.editor.editor");
dojo.require("bespin.editor.events");
dojo.require("bespin.editor.model");
dojo.require("bespin.editor.toolbar");
dojo.require("bespin.editor.undo");

dojo.require("bespin.themes.default");

dojo.require("bespin.syntax.base");
dojo.require("bespin.syntax.simple._base");

dojo.require("bespin.cmd.commandline");
dojo.require("bespin.cmd.cmd");
dojo.require("bespin.cmd.config");
dojo.require("bespin.cmd.editor");
dojo.require("bespin.cmd.file");
dojo.require("bespin.cmd.other");
dojo.require("bespin.cmd.project");
dojo.require("bespin.cmd.editorcommands");

dojo.require("th.compressed");

// = Editor Component =
//
// This is a component that you can use to embed the Bespin Editor component anywhere you wish.
//
// There are a set of options that you pass in, as well as the container element
//
// * {{{loadfromdiv}}} : Take the innerHTML from the given div and load it into the editor
// * {{{content}}} : Feed the editor the string as the initial content (loadfromdiv trumps this)
// * {{{language}}} : The given syntax highlighter language to turn on (not people language!)
// * {{{dontstealfocus}}} : by default the component will steal focus when it loads, but you can change that by setting this to true

dojo.declare("bespin.editor.Component", null, {
    // ** {{{ constructor }}} **
    //
    // Takes a container element, and the set of options for the component which include those noted above.
    constructor: function(container, opts) {
        opts.actsAsComponent = true;

        var initialcontent;
        if (opts.loadfromdiv) {
            if (dojo.byId('BESPIN_EDITOR_CODE')) {
                var code = dojo.byId('BESPIN_EDITOR_CODE');
                initialcontent = code.value;
            } else {
                initialcontent = dojo.byId(container).innerHTML;
            }
        } else if (opts.content) {
            initialcontent = opts.content;
        }

        this.editor = bespin.register('editor', opts.editor || new bespin.editor.API(container, opts));
        this.editSession = bespin.register('editSession', opts.editSession || new bespin.client.session.EditSession(this.editor));
        this.server = bespin.register('server', opts.server || new bespin.client.Server());
        this.files = bespin.register('files', opts.files || new bespin.client.FileSystem());

        // Fancy a command line anyone?
        if (opts.commandline) {
            dojo.require("bespin.cmd.commandline");

            var commandlineElement;

            if (typeof opts.commandline == "boolean") { // literally, true
                commandlineElement = dojo.create("div", {
                   id: "commandlinewrapper",
                   hidden: true
                }, dojo.body());
                commandlineElement.innerHTML = '<table style="display: none;" cellpadding="0"><tr><td id="prompt"><img id="promptimg" src="https://bespin.mozilla.com/images/icn_command.png" alt=">" ></td><td id="commandline"><input id="command" spellcheck="false"></td></tr></table>';
            } else {
                commandlineElement = dojo.byId(opts.commandline);
            }

            this.commandLine = bespin.register('commandLine', new bespin.cmd.commandline.Interface(commandlineElement, bespin.command.Store));
        }

        // Use in memory settings here instead of saving to the server which is default. Potentially use Cookie settings
        bespin.register('settings', opts.settings || new bespin.client.settings.Core(bespin.client.settings.InMemory));

        // How about a Jetpack?
        if (opts.jetpack) {
            var jetpacktoolbar = dojo.create("div", {
                id: "jetpacktoolbar"
            }, dojo.byId(container));

            jetpacktoolbar.innerHTML = '<div class="button"><button id="install" onclick="_editorComponent.executeCommand(\'jetpack install yourfirstjetpack\')">&uarr; Install This JetPack Feature</button></div>\
            <div>Hey, <a href="https://jetpack.mozillalabs.com/">install JetPack first</a>.</div>\
            <style type="text/css">\
                #jetpacktoolbar {\
                    position: relative;\
                    top: -15px;\
                    left: 0;\
                    height: 40px;\
                    background-image: url(https://bespin.mozilla.com/images/footer_bg.png);\
                    background-repeat: repeat-x;\
                    color: white;\
                    font-family: Helvetica, Arial, sans-serif;\
                    font-size: 11px;\
                }\
                #jetpacktoolbar div {\
                    padding: 17px 12px;\
                    float: left;\
                }\
                #jetpacktoolbar div.button {\
                    float: right;\
                    padding: 13px 0;\
                }\
                #jetpacktoolbar button {\
                    margin:0 7px 0 0;\
                }\
                #jetpacktoolbar a {\
                    color: #eee;\
                }\
            </style>';
        }

        dojo.connect(window, 'resize', opts.resize || dojo.hitch(this, function() {
            this.editor.paint();
        }));

        if (initialcontent) {
            this.setContent(initialcontent);
        }

        if (opts.language) { // -- turn on syntax highlighting
            bespin.publish("settings:language", { language: opts.language });
        }

        if (!opts.dontstealfocus) {
            this.editor.canvas.focus();
        }

        if (opts.set) { // we have generic settings
            for (var key in opts.set) {
                if (opts.set.hasOwnProperty(key)) {
                    this.set(key, opts.set[key]);
                }
            }
        }
    },

    // ** {{{ getContent }}} **
    //
    // Returns the contents of the editor
    getContent: function() {
        return this.editor.model.getDocument();
    },

    // ** {{{ setContent }}} **
    //
    // Takes the content and inserts it fresh into the document
    setContent: function(content) {
        return this.editor.model.insertDocument(content);
    },

    // ** {{{ setFocus(bool) }}} **
    //
    // If you pass in true, focus will be set on the editor, if false, it will not.
    setFocus: function(bool) {
        return this.editor.setFocus(bool);
    },

    // ** {{{ setLineNumber }}} **
    //
    // Pass in the line number to jump to (and refresh)
    setLineNumber: function(linenum) {
        bespin.publish("editor:moveandcenter", {
            row: linenum
        });
    },

    // ** {{{ setLineNumber }}} **
    //
    // Talk to the Bespin settings structure and pass in the key/value
    set: function(key, value) {
        bespin.publish("settings:set", {
           key: key,
           value: value
        });
    },

    // ** {{{ onchange }}} **
    //
    // Track changes in the document
    onchange: function(callback) {
        bespin.subscribe("editor:document:changed", callback);
    },

    // ** {{{ bindKey }}} **
    //
    // Given the options that should contain a modifier, key, and action.
    //
    // For example,
    //
    // {
    //   modifiers: "ctrl",
    //   key: "b",
    //   action: "moveCursorLeft"
    // }
    bindKey: function(opts) {
        bespin.get('editor').bindKey(opts.action, opts.modifiers + ' ' + opts.key);
    },

    // ** {{{ executeCommand }}} **
    //
    // Execute a given command
    executeCommand: function(command) {
        try {
            this.commandLine.executeCommand(command);
        } catch (e) {
            // catch the command prompt errors
        }
    },

    // ** {{{ dispose }}} **
    //
    // Disposes the editor as best as possible, clearing resources, clipboard helpers, and the like.
    dispose: function() {
        this.editor.dispose();
    }
});
