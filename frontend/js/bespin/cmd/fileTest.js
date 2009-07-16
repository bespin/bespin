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

dojo.provide("bespin.cmd.fileTest");

dojo.require("bespin.test");

bespin.test.addTests("cmd.file", {
    testParseArguments: function(test) {
        var session = bespin.get("editSession");

        test.isEqual(bespin.cmd.file._parseArguments("/bespin/docs/e"), {
            project: 'bespin',
            path: 'docs/',
            filter: 'e',
            projectPath: '/bespin/docs/'
        }, 1);

        test.isEqual(bespin.cmd.file._parseArguments("/bespin/docs/js/e"), {
            project: 'bespin',
            path: 'docs/js/',
            filter: 'e',
            projectPath: '/bespin/docs/js/'
        }, 2);

        test.isEqual(bespin.cmd.file._parseArguments("/bespin/docs/js/e/"), {
            project: 'bespin',
            path: 'docs/js/e/',
            filter: '',
            projectPath: '/bespin/docs/js/e/'
        }, 3);

        test.isEqual(bespin.cmd.file._parseArguments("/bespin/docs"), {
            project: 'bespin',
            path: '/',
            filter: 'docs',
            projectPath: '/bespin/'
        }, 4);

        test.isEqual(bespin.cmd.file._parseArguments("/bespin"), {
            project: '',
            path: '/',
            filter: 'bespin',
            projectPath: '/'
        }, 5);

        test.isEqual(bespin.cmd.file._parseArguments("fol"), {
            project: session.project,
            path: '/',
            filter: 'fol',
            projectPath: ''
        }, 6);
    }
});
