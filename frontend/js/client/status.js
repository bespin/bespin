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

var StatusChecker = Class.create({
    initialize: function() {
        this.interval;
        this.statusMessages = [
            "Bob is editing the file brick.html",
            "Emily is creating a new tag called 'v3.4'",
            "Jessica is saving the file kidly.html",
            "John is idle. Lazy git!",
            "Mickey has checked in a set of 4 files to project 'Bank'",
            "Don has created the function 'doCalculation' in class 'Bank'",
            "Benji is deleting the function 'doCalculation' in class 'Bank'"
        ];
    },

    start: function() {
        this.interval = setInterval(function() {
            this.updateStatus();
        }.bind(this), 12000);
    },

    stop: function() {
        clearInterval(this.interval);
    },

    updateStatus: function() {
        var randomMessage = this.randomStatus();
        this.setStatus(randomMessage);
    },

    randomStatus: function() {
        var random = Math.floor(Math.random() * this.statusMessages.length)
        return this.statusMessages[random];
    },

    setStatus: function(message) {
        $('message').innerHTML = message;
    }
})