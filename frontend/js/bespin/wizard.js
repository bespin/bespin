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

dojo.provide("bespin.wizard");

/**
 * A collection of functions for displaying Wizards
 */
dojo.mixin(bespin.wizard, {
    /**
     * This list of wizards that we can run. Each must have a url, which is a
     * pointer to the server side resource to display, and a set of functions
     * that are run by parts of the resource. A special onLoad function (note
     * the exact case) will be called when the wizard is first displayed.
     */
    _wizards: {
        newuser: { url: "/overlays/newuser.html" },
        overview: { url: "/overlays/overview.html" }
    },

    /**
     * Change the session settings when a new file is opened
     */
    show: function(instruction, type, warnOnFail) {
        var wizard = this._wizards[type];
        if (!wizard && instruction) {
            instruction.addErrorOutput("Unknown wizard: " + type);
            return;
        }

        // Warn when the HTML fetch fails
        var warn = function(xhr) {
            if (instruction) {
                instruction.addErrorOutput("Failed to display wizard: " + xhr.responseText);
            }
        };

        var localOnFailure = warnOnFail ? warn : null;
        var localOnSuccess = function(data) {
            bespin.wizard._onSuccess(data, wizard);
        };

        bespin.get('server').fetchResource(wizard.url, localOnSuccess, localOnFailure);
    },

    /**
     * Designed to be called by a button in a wizard:
     * Close the wizard
     */
    onClose: function() {
        bespin.util.webpieces.hideCenterPopup(this.element);
    },

    /**
     * Designed to be called by a button in a wizard:
     * Open a web page as we close the wizard
     */
    onJump: function(url) {
        window.open(url);
        this.onClose();
    },

    /**
     * Designed to be called by a button in a wizard:
     * Open another wizard page as we close this one
     */
    onWizard: function(type) {
        this.show(type);
        this.onClose();
    },

    /**
     * When the HTML fetch succeeds, display it in the centerpopup div
     */
    _onSuccess: function(data, wizard) {
        this.element = dojo.byId('centerpopup');
        this.element.innerHTML = data;
        dojo.query("#centerpopup script").forEach(function(node) {
            dojo.eval(node.innerHTML);
        });
        bespin.util.webpieces.showCenterPopup(this.element, true);
        if (typeof wizard.onLoad == "function") {
            wizard.onLoad();
        }
    }
});

/**
 * The wizard command to show a wizard
 */
bespin.command.store.addCommand({
    name: 'wizard',
    takes: ['type'],
    hidden: true,
    preview: 'display a named wizard to step through some process',
    completeText: 'The name of the wizard to run. Leave blank to list known wizards',
    usage: "[type] ...<br><br><em>[type] The name of the user to run (or blank to list wizards)</em>",
    execute: function(instruction, type) {
        if (!type) {
            var list = "";
            for (var name in bespin.wizard._wizards) {
                if (bespin.wizard._wizards.hasOwnProperty(name)) {
                    list += ", " + name;
                }
            }
            instruction.addOutput("Known wizards: " + list.substring(2));
            return;
        }

        bespin.wizard.show(instruction, type, true);
    }
});
