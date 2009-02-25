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

// = queryToObject =
//
// While dojo.queryToObject() is mainly for URL query strings,
// this version allows to specify a seperator character

bespin.util.queryToObject = function(str, seperator) {
    var ret = {};
    var qp = str.split(seperator);
    var dec = decodeURIComponent;
    dojo.forEach(qp, function(item){
    	if(item.length){
    		var parts = item.split("=");
    		var name = dec(parts.shift());
    		var val = dec(parts.join("="));
    		if(dojo.isString(ret[name])){
    			ret[name] = [ret[name]];
    		}
    		if(dojo.isArray(ret[name])){
    			ret[name].push(val);
    		}else{
    			ret[name] = val;
    		}
    	}
    });
    return ret;
};

bespin.util.endsWith = function(str, end) {
    return str.match(new RegExp(end + "$"));
};

bespin.util.include = function(array, item) {
    return dojo.indexOf(array, item) > -1;
};

bespin.util.last = function(array) {
    if (dojo.isArray(array)) {
        return array[array.length - 1];
    }
}

