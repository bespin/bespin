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

dojo.provide("bespin.util.path");

/**
 * Deal with paths that are sent into Bespin
 */
dojo.mixin(bespin.util.path, {
    /**
     * Take the given arguments and combine them with one path separator:
     * <pre>
     * combine("foo", "bar") -&gt; foo/bar
     * combine(" foo/", "/bar  ") -&gt; foo/bar
     * </pre>
     */
    combine: function() {
        // clone to a true array
        var args = Array.prototype.slice.call(arguments);

        var path = args.join('/');
        path = path.replace(/\/\/+/g, '/');
        path = path.replace(/^\s+|\s+$/g, '');
        return path;
    },

    /**
     * Given a <code>path</code> return the directory
     * <li>directory("/path/to/directory/file.txt") -&gt; /path/to/directory/
     * <li>directory("/path/to/directory/") -&gt; /path/to/directory/
     * <li>directory("foo.txt") -&gt; ""
     */
    directory: function(path) {
        var dirs = path.split('/');
        if (dirs.length == 1) {
            // no directory so return blank
            return "";
        } else if ((dirs.length == 2) && dirs[dirs.length -1] == "") {
            // a complete directory so return it
            return path;
        } else {
            return dirs.slice(0, dirs.length - 1).join('/');
        }
    },

    /**
     * Given a <code>path</code> make sure that it returns as a directory
     * (As in, ends with a '/')
     * <pre>
     * makeDirectory("/path/to/directory") -&gt; /path/to/directory/
     * makeDirectory("/path/to/directory/") -&gt; /path/to/directory/
     * </pre>
     */
    makeDirectory: function(path) {
        if (!/\/$/.test(path)) path += '/';
        return path;
    },

    /**
     * Take the given arguments and combine them with one path separator and
     * then make sure that you end up with a directory
     * <pre>
     * combine("foo", "bar") -&gt; foo/bar/
     * combine(" foo/", "/bar  ") -&gt; foo/bar/
     * </pre>
     */
    combineAsDirectory: function() {
        return this.makeDirectory(this.combine.apply(this, arguments));
    },

    /**
     * This function doubles down and calls <code>combine</code> and then
     * escapes the output
     */
    escape: function() {
        return escape(this.combine.apply(this, arguments));
    },

    /**
     * This function returns a file type based on the extension
     * (foo.html -&gt; html)
     */
    fileType: function(path) {
        if (!path) {
            console.error("path falsy in bespin.util.path.fileType", path);
            // console.trace();
            return "";
        }

        if (path.indexOf('.') >= 0) {
            var split = path.split('.');
            if (split.length > 1) {
                return split[split.length - 1];
            }
        }
    }
});
