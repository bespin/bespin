//  ***** BEGIN LICENSE BLOCK *****
// Version: MPL 1.1
// 
// The contents of this file are subject to the Mozilla Public License  
// Version
// 1.1 (the "License"); you may not use this file except in compliance  
// with
// the License. You may obtain a copy of the License at
// http://www.mozilla.org/MPL/
// 
// Software distributed under the License is distributed on an "AS IS"  
// basis,
// WITHOUT WARRANTY OF ANY KIND, either express or implied. See the  
// License
// for the specific language governing rights and limitations under the
// License.
// 
// The Original Code is Bespin.
// 
// The Initial Developer of the Original Code is Mozilla.
// Portions created by the Initial Developer are Copyright (C) 2009
// the Initial Developer. All Rights Reserved.
// 
// Contributor(s):
// 
// ***** END LICENSE BLOCK *****
// 

var ArrayUtils = {
    /*
     * Returns a new array without the passed item, if it was present in the old array
     */
    remove: function(array, item) {
        var newa = [];
        for (var i = 0; i < array.length; i++) {
            if (array[i] !== item) newa.push(array[i]);
        }
        return newa;
    },

    /*
     * Wraps the passed object as an array if it is not one already
     */
    array: function(object) {
        return this.isArray(object) ? object : [ object ];
    },

    isArray: function(object) {
        return (object && object.constructor == Array);
    }
}