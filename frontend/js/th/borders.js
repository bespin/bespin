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

var SimpleBorder = Class.define({
    type: "SimpleBorder",

    superclass: Border,

    members: {
        init: function(parms) {
            this._super(parms);
        },

        getInsets: function() {
            return { left: 1, right: 1, top: 1, bottom: 1 };
        },

        paint: function(ctx) {
            var b = this.component.bounds;
            ctx.strokeStyle = this.style.color;
            ctx.strokeRect(0, 0, b.width, b.height);
        }
    }
});

var EmptyBorder = Class.define({
    type: "EmptyBorder",

    superclass: Border,

    members: {
        init: function(parms) {
            this._super(parms);

            if (this.size) {
                this.insets = { left: this.size, right: this.size, top: this.size, bottom: this.size };
            } else {
                this.insets = parms.insets;
            }
        },

        getInsets: function() {
            return this.insets;
        }
    }
});