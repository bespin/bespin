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

// This list of wizards that we can run. Each must have a url, which is a
// pointer to the server side resource to display, and a set of functions that
// are run by parts of the resource. A special onLoad function (note the exact
// case) will be called when the wizard is first displayed.
bespin.wizard._wizards = {
    newuser: {
        url: "/overlays/newuser.html"
    },
    overview: {
        url: "/overlays/overview.html"
    }
};

//** {{{ Command: wizard }}} **
bespin.cmd.commands.add({
    name: 'wizard',
    takes: ['type'],
    preview: 'display a named wizard to step through some process',
    completeText: 'The name of the wizard to run. Leave blank to list known wizards',
    usage: "[type] ...<br><br><em>[type] The name of the user to run (or blank to list wizards)</em>",
    // ** {{{execute}}}
    execute: function(self, type) {
        if (!type) {
            var list = "";
            for (name in bespin.wizard._wizards) {
                list += ", " + name;
            }
            bespin.publish("message", { msg: "Known wizards: " + list.substring(2) });
            return;
        }

        bespin.publish("wizard:show", { type:type, warnOnFail:true });
    }
});

// Designed to be called by a button in a wizard:
// Close the wizard
bespin.wizard.onClose = function() {
    bespin.util.webpieces.hideCenterPopup(bespin.wizard.el);
}

// Designed to be called by a button in a wizard:
// Open a web page as we close the wizard
bespin.wizard.onJump = function(url) {
    window.open(url);
    bespin.wizard.onClose();
}

// Designed to be called by a button in a wizard:
// Open another wizard page as we close this one
bespin.wizard.onWizard = function(type) {
    bespin.publish("wizard:show", { type:type });
    bespin.wizard.onClose();
}

// ** {{{ Event: wizard:show }}} **
//
// Change the session settings when a new file is opened
bespin.subscribe("wizard:show", function(event) {
    if (!event.type) {
        throw new Error("wizard:show event must have a type member");
    }

    var wizard = bespin.wizard._wizards[event.type];
    if (!wizard) {
        bespin.publish("message", { msg: "Unknown wizard: " + event.type });
        return;
    }
    
    if (event.showonce) {
        console.log('here');
        bespin.get('settings').set('hidewelcomescreen', 'true');
    }

    var localOnFailure = event.warnOnFail ? bespin.wizard._onFailure : null;
    var localOnSuccess = function(data) {
        bespin.wizard._onSuccess(data, wizard);
    };

    bespin.get('server').fetchResource(wizard.url, localOnSuccess, localOnFailure);
});

// When the HTML fetch succeeds, display it in the centerpopup div
bespin.wizard._onSuccess = function(data, wizard) {
    bespin.wizard.el = dojo.byId('centerpopup');
    bespin.wizard.el.innerHTML = data;
    dojo.query("#centerpopup script").forEach(function(node) {
        dojo.eval(node.innerHTML);
    });
    bespin.util.webpieces.showCenterPopup(bespin.wizard.el, true);
    if (typeof wizard.onLoad == "function") {
        wizard.onLoad();
    }
};

// Warn when the HTML fetch fails
bespin.wizard._onFailure = function(xhr) {
    bespin.publish("message", { msg: "Failed to display wizard: " + xhr.responseText });
};
