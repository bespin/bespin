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

//** {{{ Command: wizard }}} **
bespin.cmd.commands.add({
    name: 'wizard',
    takes: ['type'],
    preview: 'display a named wizard to step through some process',
    completeText: 'The name of the wizard to run. Initially this is limited to \'newuser\'.',
    usage: "[type] ...<br><br><em>[type] The name of the user to run</em>",
    // ** {{{execute}}}
    execute: function(self, type) {
        if (!type) {
            bespin.publish("message", { msg: "Please specify the type of wizard to display" });
        }
        else {
            bespin.publish("wizard:show", { type:type });
        }
    }
});

(function() {
    // ** {{{ Event: editor:openfile:opensuccess }}} **
    //
    // Change the session settings when a new file is opened
    bespin.subscribe("wizard:show", function(event) {
        console.log(event);
    });
})();
