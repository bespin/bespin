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

// = PubSub client =

dojo.provide("bespin.client.pubsub");

// ** {{{ bespin.client.pubsub.Proxy }}} **
//
// Proxies custom event to the server and receives them for re-publishing on the client

dojo.declare("bespin.client.pubsub.Proxy", null, {
    constructor: function() {
        this.server = bespin.get("server");
    },

    listen: function() {
        var self = this;
        var onSuccess = function(pub) {
            bespin.publish(pub.topic, pub.event);
            
            self.listen(); // recurse immediately
        };
        var url = "/event/listen/?queue=" + self.queue;
        this.server.request('GET', url, null, { 
            log: 'Message arrived', 
            onSuccess: onSuccess,
            evalJSON: true
        });
    },
    
    forward: function(topic, event) {
        var self = this;
        var url = "/event/forward/?queue=" + self.queue + "&topic=" + encodeURIComponent(topic) + "&event=" + encodeURIComponent(dojo.toJson(event));
        this.server.request('GET', url, null, { 
            log: 'Event ' + topic + " forwarded."
        });
    },
    
    bind: function() {
        var self = this;
        var url = "/event/bind/";
        this.server.request('GET', url, null, {
            evalJSON: true,
            onSuccess: function(info) {
                self.queue = info.queue; 
                var topics = info.topics;
                dojo.forEach(topics, function(topic) {
                    bespin.subscribe(topic, function(event) {
                        self.forward(topic, event);
                    });
                });
                self.listen();
            }
        });
    }
});

bespin.subscribe("bind", function() {
    var proxy = new bespin.client.pubsub.Proxy();
    proxy.bind();
});
