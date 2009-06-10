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

dojo.provide("bespin.util.util");

// === Helpful Utilities ===
//
// We gotta keep some of the Prototype spirit around :)

// = queryToObject =
//
// While dojo.queryToObject() is mainly for URL query strings,
// this version allows to specify a seperator character

bespin.util.queryToObject = function(str, seperator) {
    var ret = {};
    var qp = str.split(seperator);
    var dec = decodeURIComponent;
    dojo.forEach(qp, function(item) {
    	if (item.length){
    		var parts = item.split("=");
    		var name = dec(parts.shift());
    		var val = dec(parts.join("="));
    		if (dojo.isString(ret[name])){
    			ret[name] = [ret[name]];
    		}
    		if (dojo.isArray(ret[name])){
    			ret[name].push(val);
    		} else {
    			ret[name] = val;
    		}
    	}
    });
    return ret;
};

// = endsWith =
//
// A la Prototype endsWith(). Takes a regex exclusing the '$' end marker
bespin.util.endsWith = function(str, end) {
    return str.match(new RegExp(end + "$"));
};

// = include =
//
// A la Prototype include().
bespin.util.include = function(array, item) {
    return dojo.indexOf(array, item) > -1;
};

// = last =
//
// A la Prototype last().
bespin.util.last = function(array) {
    if (dojo.isArray(array)) return array[array.length - 1];
};

// = shrinkArray =
//
// Knock off any undefined items from the end of an array
bespin.util.shrinkArray = function(array) {
    var newArray = [];
    
    var stillAtBeginning = true;
    dojo.forEach(array.reverse(), function(item) {
        if (stillAtBeginning && item === undefined) {
            return;
        }

        stillAtBeginning = false;

        newArray.push(item);
    });

    return newArray.reverse();
};

// = makeArray =
//
// {{number}} - The size of the new array to create
// {{character}} - The item to put in the array, defaults to ' '
bespin.util.makeArray = function(number, character) {
    if (number < 1) return []; // give us a normal number please!
    if (!character) character = ' ';

    var newArray = [];
    for (var i = 0; i < number; i++) {
        newArray.push(character);
    }
    return newArray;
};

// = leadingSpaces =
//
// Given a row, find the number of leading spaces.
// E.g. an array with the string "  aposjd" would return 2
//
// {{row}} - The row to hunt through
bespin.util.leadingSpaces = function(row) {
    var numspaces = 0;
    for (var i = 0; i < row.length; i++) {
        if (row[i] == ' ' || row[i] == '' || row[i] === undefined) {
            numspaces++;
        } else {
            return numspaces;
        }
    }
    return numspaces;
};

// = leadingTabs =
//
// Given a row, find the number of leading tabs.
// E.g. an array with the string "\t\taposjd" would return 2
//
// {{row}} - The row to hunt through
bespin.util.leadingTabs = function(row)
{
    var numtabs = 0;
    for (var i = 0; i < row.length; i++) {
        if (row[i] == '\t' || row[i] == '' || row[i] === undefined) {
            numtabs++;
        } else {
            return numtabs;
        }
    }
    return numtabs;
};

// = leadingWhitespace =
//
// Given a row, extract a copy of the leading spaces or tabs.
// E.g. an array with the string "\t    \taposjd" would return an array with the
// string "\t    \t".
//
// {{row}} - The row to hunt through
bespin.util.leadingWhitespace = function(row)
{
    var leading = [];
    for (var i = 0; i < row.length; i++) {
        if (row[i] == ' ' || row[i] == '\t' || row[i] == '' || row[i] === undefined) {
            leading.push(row[i]);
        } else {
            return leading;
        }
    }
    return leading;
};


// = englishFromCamel =
//
// Given a camelCaseWord convert to "Camel Case Word"
bespin.util.englishFromCamel = function(camel) {
    dojo.trim(camel.replace(/([A-Z])/g, function(str) { return " " + str.toLowerCase(); }));
};

// = isMac =
//
// I hate doing this, but we need some way to determine if the user is on a Mac
// The reason is that users have different expectations of their key combinations.
//
// Take copy as an example, Mac people expect to use CMD or APPLE + C
// Windows folks expect to use CTRL + C
bespin.util.isMac = function() {
    return navigator.appVersion.indexOf("Macintosh") >= 0;
};

// = contains =
//
// Return true if with contains(a, b) the element b exists within the element a
bespin.util.contains = document.compareDocumentPosition ? function(a, b) {
	return a.compareDocumentPosition(b) & 16;
} : function(a, b) {
	return a !== b && (a.contains ? a.contains(b) : true);
};

// = randomPassword =
//
// Create a random password of the given length (default 16 chars)
bespin.util.randomPassword = function(length) {
    length = length || 16;
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    pass = "";
    for (var x = 0; x < length; x++) {
        var charIndex = Math.floor(Math.random() * chars.length);
        pass += chars.charAt(charIndex);
    }
    return pass;
};
