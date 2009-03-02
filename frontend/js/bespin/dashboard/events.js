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
 
dojo.provide("bespin.dashboard.events");

// After a project is imported or created, do a list
bespin.subscribe("bespin:project:imported", function(event) {
    bespin.dashboard.refreshProjects(); // get projects
});

bespin.subscribe("bespin:project:set", function(event) {
    bespin.dashboard.refreshProjects(); // get projects
});

bespin.subscribe("bespin:project:create", function(event) {
    bespin.dashboard.refreshProjects(); // get projects
});

bespin.subscribe("bespin:project:delete", function(event) {
    bespin.dashboard.refreshProjects(); // get projects
});

// ** {{{ Event: bespin:editor:newfile }}} **
// 
// Observe a request for a new file to be created
bespin.subscribe("bespin:editor:newfile", function(event) {
    var project = event.project;
    if (!project) {
        bespin.publish("bespin:cmdline:showinfo", { msg: 'The new file action requires a project' });
        return;
    }
    
    var newfilename = event.newfilename || "new.txt";
    
    bespin.util.navigate.editor(project, newfilename);
});
