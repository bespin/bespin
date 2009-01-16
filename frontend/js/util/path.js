/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 * 
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 * 
 * The Original Code is Bespin.
 * 
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s):
 *     Bespin Team (bespin@mozilla.com)
 *
 * 
 * ***** END LICENSE BLOCK ***** */

var Path = {
    combine: function() {
        var args = Array.prototype.slice.call(arguments); // clone to a true array

        var path = args.join('/');
        path = path.replace(/\/\/+/g, '/');
        path = path.replace(/^\s+|\s+$/g, '');
        return path;
    },

    directory: function(path) {
        var dirs = path.split('/');
        if (dirs.length == 1) { // no directory so return blank
            return "";
        } else if ((dirs.length == 2) && dirs.last() == "") { // a complete directory so return it
            return path;
        } else {
            return dirs.slice(0, dirs.length - 1).join('/');
        }
    },

    escape: function() {
        return escape(Path.combine.apply(this, arguments));
    }
}
