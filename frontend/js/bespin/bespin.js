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

// = Bespin =
//
// This is the root of it all. The {{{ bespin }}} namespace.
// All of the JavaScript for Bespin will be placed in this namespace later.
//
// {{{ bespin.versionNumber }}} is the core version of the Bespin system
// {{{ bespin.apiVersion }}} is the version number of the API (to ensure that the
//                          client and server are talking the same language)
// {{{ bespin.commandlineHeight }}} is the height of the command line
// {{{ bespin.displayVersion }}} is a function that sets innerHTML on the element given, with the Bespin version info


dojo.provide("bespin.bespin");
    
dojo.mixin(bespin, {
    // BEGIN VERSION BLOCK
    versionNumber: 'tip',
    versionCodename: '(none)',
    apiVersion: 'dev',
    // END VERSION BLOCK
    
    commandlineHeight: 95,
    userSettingsProject: "BespinSettings",
    
    publish: function(topic, args) {
        dojo.publish(topic, dojo.isArray(args) ? args : [ args ]);
    },
    
    subscribe: dojo.subscribe,
    
    displayVersion: function(el) {
        if (!el) el = dojo.byId("version");
        if (!el) return;
        el.innerHTML = '<a href="https://wiki.mozilla.org/Labs/Bespin/ReleaseNotes" title="Read the release notes">Version <span class="versionnumber">' + this.versionNumber + '</span> "' + this.versionCodename + '"</a>';
    }
});