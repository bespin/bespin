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
