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

dojo.provide("bespin.cmd.editor");

/**
 * 'search' command
 */
bespin.command.store.addCommand({
    name: 'search',
    takes: ['searchString'],
    preview: 'searches the current file for the given searchString',
    completeText: 'type in a string to search',
    execute: function(instruction, str) {
        bespin.get('actions').startSearch(str, 'commandLine');
        bespin.publish("ui:escape", { keepSearchUp: true });
    }
});

/**
 * 'goto' command
 */
(function () {
    var previewFull      = 'move it! make the editor head to a line number or a function name.';
    var preview          = 'move it! make the editor head to a line number.';
    var completeTextFull = 'add the line number to move to, or the name of a function in the file';
    var completeText     = 'add the line number to move to in the file';
    var gotoCmd = {
        name: 'goto',
        takes: ['value'],
        preview: previewFull,
        completeText: completeTextFull,
        execute: function(instruction, value) {
            var settings = bespin.get("settings");
            if (value) {
                var linenum = parseInt(value, 10); // parse the line number as a decimal

                if (isNaN(linenum)) { // it's not a number, so for now it is a function name
                    if(settings.isOn(settings.get("syntaxcheck"))) {
                        bespin.publish("parser:gotofunction", {
                            functionName: value
                        });
                    } else {
                        instruction.addErrorOutput("Please enter a valid line number.");
                    }
                } else {
                    bespin.publish("editor:moveandcenter", {
                        row: linenum
                    });
                    bespin.publish("ui:escape", {});
                }
            }
        }
    };
    bespin.command.store.addCommand(gotoCmd);
    bespin.subscribe("settings:set:syntaxcheck", function () {
        var settings = bespin.get("settings");
        if(settings.isOn(settings.get("syntaxcheck"))) {
            gotoCmd.preview = previewFull;
            gotoCmd.completeText = completeTextFull;
        } else {
            gotoCmd.preview = preview;
            gotoCmd.completeText = completeText;
        }
    });
})();

/**
 * 'replace' command
 */
bespin.command.store.addCommand({
    name: 'replace',
    takes: ['search', 'replace'],
    preview: 's/foo/bar/g',
    completeText: 'add the search regex, and then the replacement text',
    execute: function(instruction, args) {
        bespin.get("editor").ui.actions.replace(args);
    }
});

/**
 * 'sort' command
 */
bespin.command.store.addCommand({
    name: 'sort',
    takes: ['direction'],
    preview: 'sort the current buffer',
    completeText: 'optionally, sort descending',
    execute: function(instruction, direction) {
        var buffer = bespin.get("editor").model.getDocument().split(/\n/);
        buffer.sort();
        if (direction && /^desc/.test(direction.toLowerCase())) {
            buffer.reverse();
        }
        bespin.get("editor").model.insertDocument(buffer.join("\n"));
    }
});

/**
 * 'trim' command
 */
bespin.command.store.addCommand({
    name: 'trim',
    takes: ['side'], // left, right, both
    preview: 'trim trailing or leading whitespace',
    completeText: 'optionally, give a side of left, right, or both (defaults to right)',
    execute: function(instruction, side) {
        if (!side) side = "right";
        var replaceArgs = {
            replace: ''
        };

        if (bespin.util.include(["left", "both"], side)) {
            replaceArgs.search = "^\\s+";
            bespin.get("editor").ui.actions.replace(replaceArgs);
        }

        if (bespin.util.include(["right", "both"], side)) {
            replaceArgs.search = "\\s+$";
            bespin.get("editor").ui.actions.replace(replaceArgs);
        }
    }
});

/**
 * 'uc' command
 */
bespin.command.store.addCommand({
    name: 'uc',
    preview: 'Change all selected text to uppercase',
    withKey: "CMD SHIFT U",
    execute: function(instruction) {
        var args = { stringCase: 'u' };
        bespin.get("editor").ui.actions.selectionChangeCase(args);
    }
});

/**
 * 'lc' command
 */
bespin.command.store.addCommand({
    name: 'lc',
    preview: 'Change all selected text to lowercase',
    withKey: "CMD SHIFT L",
    execute: function(instruction) {
        var args = { stringCase: 'l' };
        bespin.get("editor").ui.actions.selectionChangeCase(args);
    }
});

/**
 * 'outline' command
 */
bespin.command.store.addCommand({
    name: 'outline',
    preview: 'show outline of source code',
    withKey: "ALT SHIFT O",
    execute: function(instruction) {
        bespin.publish("parser:showoutline");
    }
});
