/*
 * Orginal: http://adomas.org/javascript-mouse-wheel/
 * prototype extension by "Frank Monnerjahn" themonnie @gmail.com
 *
 * Tweaked to map everyting to Mozilla's event.detail result
 */
  
dojo.provide("bespin.util.mousewheelevent");

dojo.mixin(bespin.util.mousewheelevent, {
    wheel: function(event) {
        var delta = 0;
        if (!event) event = window.event;
        if (event.wheelDelta) {
            delta = -(event.wheelDelta/620);
            if (window.opera) delta = -delta;
        } else if (event.detail) {
            delta = event.detail;
        }  

        return Math.round(delta); // Safari Round
    }
});