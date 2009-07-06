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

/**
 * This is the root of it all: The 'bespin' namespace.
 * <p>All of the JavaScript for Bespin is in this namespace
 */

dojo.provide("bespin.bespin");

/**
 * The main bespin namespace
 */
dojo.mixin(bespin, {

    // BEGIN VERSION BLOCK
    /** The core version of the Bespin system */
    versionNumber: 'tip',
    /** The version number to display to users */
    versionCodename: 'DEVELOPMENT MODE',
    /** The version number of the API (to ensure that the client and server are talking the same language) */
    apiVersion: 'dev',
    // END VERSION BLOCK

    /** Basic setting. TODO: Explain why this is here or move it */
    defaultTabSize: 4,

    /** The name of the project that contains the users client side settings */
    userSettingsProject: "BespinSettings",

    /** A list of the events that have fired at least once, for fireAfter */
    _eventLog: {},

    /** Holds the count to keep a unique value for setTimeout */
    _lazySubscriptionCount: 0,

    /** Holds the timeouts so they can be cleared later */
    _lazySubscriptionTimeout: {},

    /**
     * Given a topic and a set of parameters, publish onto the bus.
     * maps onto dojo.publish but lets us abstract away for the future
     */
    publish: function(topic, args) {
        //console.log("publish", topic, args);
        bespin._eventLog[topic] = true;
        dojo.publish("bespin:" + topic, dojo.isArray(args) ? args : [ args || {} ]);
    },

    /**
     * Given an array of topics, fires given callback as soon as all of the
     * topics have fired at least once
     */
    fireAfter: function(topics, callback) {
        if (!dojo.isArray(topics)) {
            throw new Error("fireAfter() takes an array of topics. '" + topics + "' is not an array.");
        }

        var count = topics.length;
        var done  = function () {
            if (count == 0) {
                callback();
            }
        };

        for (var i = 0; i < topics.length; ++i) {
            var topic = topics[i];
            if (bespin._eventLog[topic]) {
                --count;
            } else {
                bespin.subscribe(topic, function () {
                    --count;
                    done();
                });
            }
            done();
        }
    },

    /**
     * Given a topic and a function, subscribe to the event.
     * <p>If minTimeBetweenPublishMillis is set to an integer the subscription
     * will not be invoked more than once within this time interval.
     * <p>Maps onto dojo.subscribe but lets us abstract away for the future
     * TODO: Is minTimeBetweenPublishMillis ever used? I'm not sure that it's
     * that useful given our synchronous implementation, and we should perhaps
     * replace this parameter with a scope with which to call the callback
     */
    subscribe: function(topic, callback, minTimeBetweenPublishMillis) {
        if (minTimeBetweenPublishMillis) {
            var orig = callback;

            var count = this._lazySubscriptionCount++;

            var self = this;
            callback = function() { // lazySubscriptionWrapper
                if (self._lazySubscriptionTimeout[count]) {
                    clearTimeout(self._lazySubscriptionTimeout[count]);
                }

                self._lazySubscriptionTimeout[count] = setTimeout(function() {
                    orig.apply(self, arguments);
                    delete self._lazySubscriptionTimeout[count];
                }, minTimeBetweenPublishMillis);
            };
        }
        return dojo.subscribe("bespin:" + topic, callback);
    },

    /**
     * Unsubscribe the functions from the topic.
     * <p>Maps onto dojo.unsubscribe but lets us abstract away for the future
     */
    unsubscribe: dojo.unsubscribe,

    /**
     * Methods for registering components with the main system
     */
    registeredComponents: {},

    /**
     * Given an id and an object, register it inside of Bespin.
     * <p>The way to attach components into bespin for others to get them out
     */
    register: function(id, object) {
        this.registeredComponents[id] = object;

        bespin.publish("component:register:" + id, { id: id, object: object });

        return object;
    },

    /**
     * Given an id, return the component.
     */
    get: function(id) {
        return this.registeredComponents[id];
    },

    /**
     * Given an id, and function to run, execute it if the component is available
     */
    withComponent: function(id, func) {
        var component = this.get(id);
        if (component) {
            return func(component);
        }
    },

    /**
     * Set innerHTML on the element given, with the Bespin version info
     */
    displayVersion: function(el) {
        var el = dojo.byId(el) || dojo.byId("version");
        if (!el) return;
        el.innerHTML = '<a href="https://wiki.mozilla.org/Labs/Bespin/ReleaseNotes" title="Read the release notes">Version <span class="versionnumber">' + this.versionNumber + '</span> "' + this.versionCodename + '"</a>';
    }
});

bespin.subscribe("extension:loaded:bespin.subscribe", function(ext) {
    var subscription = bespin.subscribe(ext.topic, function(e) {
        ext.load(function(func) {
            func(e);
        })
    });
    ext.subscription = subscription;
});

bespin.subscribe("extension:removed:bespin.subscribe", function(ext) {
    if (ext.subscription) {
        bespin.unsubscribe(ext.subscription);
    }
});
