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

dojo.provide("bespin.editor.quickopen");

dojo.declare("bespin.editor.quickopen.API", null, {
    constructor: function() {
        this.requestFinished = true;
        this.preformNewRequest = false;
        this.openSessionFiles = [];

        this.scene = new th.WindowScene( {
            canvasOrId: document.getElementById("quickopen"),
            isVisible: false,
            isDraggable: true,
            title: "Find Files"
        });

        this.focusManager = new th.FocusManager(th.global_event_bus, th.byId('quickopen_input_first'), th.byId('quickopen_input_last'));
        this.scene.focusManager = this.focusManager;
        this.focusManager.relateTo(this.scene);

        this.input = this.scene.byId('quickopen_input');
        this.input.selectAll();

        this.list = this.scene.byId('quickopen_list');
        this.list.items = [ 'Loading...'];
        this.list.remove(this.list.renderer);
        this.list.renderer = new th.HtmlLabel();
        this.list.add(this.list.renderer);
        this.list.renderer.addCss('padding', '2px 5px');

        this.label = this.scene.byId('quickopen_label');

        //this.focusManager.subscribe(this.list);
        this.focusManager.subscribe(this.input);
        this.focusManager.focus(this.input);

        this.scene.render();
        this.scene.center();

        // add some key bindings
        this.input.key.bind("", this.input.key.ARROW_UP, this.list.moveSelectionUp, this.list);
        this.input.key.bind("", this.input.key.ARROW_DOWN, this.list.moveSelectionDown, this.list);
        this.input.key.bind("", this.input.key.ESCAPE, function() { bespin.publish("ui:escape"); }, this);
        this.input.key.bind("", this.input.key.ENTER, this.openFile, this);

        // bind to some events

        this.scene.bus.bind("dblclick", this.list, this.openFile, this);

        this.scene.bus.bind("itemselected", this.list, function(e) {
            this.label.text = e.item.filename;
            this.label.repaint();
        }, this);

        this.input.bus.bind("text:changed", this.input, function() {
            if (this.input.text == '') {
                this.showFiles(this.openSessionFiles, true);
            } else {
                // the text has changed!
                if (this.requestFinished) {
                    this.requestFinished = false;
                    bespin.get('server').searchFiles(bespin.get('editSession').project, this.input.text, this.displayResult);
                } else {
                    this.preformNewRequest = true;
                }
            }
        }, this);

        // load the current opened files at startup
        bespin.subscribe('settings:loaded', dojo.hitch(this, function() {
            bespin.get('server').listOpen(this.displaySessions);
        }));

        bespin.subscribe('ui:escape', dojo.hitch(this, function() {
            if (this.scene.isVisible) {
                this.toggle();
                bespin.get('editor').setFocus(true);
            }
        }));
    },

    toggle: function() {
        this.scene.toggle();

        if (!this.scene.isVisible) {
            this.focusManager.removeFocus();
        } else {
            setTimeout(dojo.hitch(this, function() {
                this.focusManager.focus(this.input);
                this.input.setText('');
            }, 10));
        }
    },

    openFile: function() {
        var item = this.list.selected;
        if (!item) return; // short circuit if we don't have an item to click on

        // save the current file and load up the new one
        bespin.publish("editor:savefile", {});
        bespin.publish("editor:openfile", { filename: item.filename });

        // adds the new opened file to the top of the openSessionFiles
        if (this.openSessionFiles.indexOf(item.filename) != -1) {
            this.openSessionFiles.splice(this.openSessionFiles.indexOf(item.filename), 1);
        }
        this.openSessionFiles.unshift(item.filename);

        this.toggle();
        bespin.get('editor').setFocus(true);
    },

    highlightText: function(text, highlight) {
        if (highlight == '') return text;
        var lastIndex = 0, startIndex = -1;
        var lowerText = text.toLowerCase();
        highlight = highlight.toLowerCase();
        var result = '';
        for (var i=0; i < highlight.length; i++) {
            lastIndex = startIndex;
            startIndex = lowerText.indexOf(highlight[i], startIndex);
            if (startIndex == -1) break;
            result += text.substring(lastIndex + 1, startIndex) + '<#000000>' + text[startIndex] + '</#000000>';
        }
        result += text.substring(startIndex + 1);
        return result.replace(/<\/#000000><#000000>/g, '');
    },

    showFiles: function(files, sortFiles) {
        sortFiles = sortFiles || false;
        var items = new Array();
        var sortedItems = new Array();
        var quickopen = bespin.get('quickopen');
        var settings = bespin.get('settings');
        var lastFolder;
        var name;
        var path;
        var lastSlash;
        var file;

        for (var x = 0; x < files.length; x++) {
            file = files[x];
            lastSlash = file.lastIndexOf("/");
            path = (lastSlash == -1) ? "" : file.substring(0, lastSlash);
            name = (lastSlash == -1) ? file : file.substring(lastSlash + 1);
            if (settings && settings.isSettingOff('dotmode') && name[0] == '.') {
                continue;
            }

            // look at the array if there is an entry with the same name => adds folder to it!
            lastFolder = false;
            for (var y = items.length - 1; y != -1 ; y--) {
                if (items[y].name == name) {
                    if (!items[y].lastFolder) {
                        lastFolder = items[y].filename.split('/');
                        items[y].lastFolder = (lastFolder.length > 1 ? lastFolder[lastFolder.length - 2] : '');
                    }

                    lastFolder = file.split('/');
                    lastFolder = (lastFolder.length > 1 ? lastFolder[lastFolder.length - 2] : '');
                    break;
                }
            }
            items.push({text: quickopen.highlightText(name, quickopen.input.text), filename: file, lastFolder: lastFolder});
        }

        // for the moment there are only 12 files displayed...
        items = items.slice(0, 14);

        if (sortFiles) {
            items.sort(function(a, b) {
                var x = a.text.toLowerCase();
                var y = b.text.toLowerCase();
                return ((x < y) ? -1 : ((x > y) ? 1 : 0));
            });
        }

        quickopen.list.items = items;
        if (items.length != 0) {
            quickopen.list.selected = items[0];
            quickopen.label.text = items[0].filename;
        }
        quickopen.scene.render();
        //quickopen.window.layoutAndRender();
    },

    displayResult: function(files) {
        var quickopen = bespin.get('quickopen');
        quickopen.showFiles(files);

        quickopen.requestFinished = true;

        if (quickopen.preformNewRequest) {
            quickopen.requestFinished = false;
            quickopen.preformNewRequest = false;
            quickopen.requestText = quickopen.input.text;
            bespin.get('server').searchFiles(bespin.get('editSession').project, quickopen.input.text, quickopen.displayResult);
        }
    },

    displaySessions: function(sessions) {
        var quickopen =  bespin.get('quickopen');
        var currentProject = bespin.get('editSession').project;
        var currentFile = bespin.get('editSession').path;
        var items = new Array();

        var files = sessions[currentProject];
        for (var file in files) {
            if (currentFile == file) {
                currentFile = false;
            }
            items.push(file);
        }

        if (currentFile) {
            items.push(currentFile);
        }

        if (items) {
            quickopen.showFiles(items, true);
            quickopen.openSessionFiles = items;
        }
    }
});