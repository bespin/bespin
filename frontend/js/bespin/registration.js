dojo.provide("bespin.registration"); 

// Registration functions for the Bespin front page.

var svr = new bespin.client.Server();
var go = bespin.util.navigate;

function whenLoginSucceeded() {
    go.dashboard();
}

function whenLoginFailed() {
    showStatus("Sorry, login didn't work. Try again? Caps lock on?");
}

function whenUsernameInUse() {
    showStatus("The username is taken. Please choose another.");
}

function showStatus(msg) {
    dojo.byId("status").innerHTML = msg;
    dojo.style('status', 'display', 'block');
}

function login() {
    if (showingBrowserCompatScreen()) return;

    if (dojo.byId("username").value && dojo.byId("password").value) {
        // try to find the httpSessionId
        var cookies = document.cookie.split(';');
        var foundValue = "";
        for (var i = 0; i < cookies.length; i++) {
            var cookie = cookies[i];
            while (cookie.charAt(0) == ' ') cookie = cookie.substring(1, cookie.length);
            if (cookie.indexOf("anticsrf=") == 0) {
                foundValue = cookie.substring(dwr.engine._sessionCookieName.length + 1, cookie.length);
                break;
            }
        }

        svr.login(dojo.byId("username").value, dojo.byId("password").value, foundValue, whenLoginSucceeded, whenLoginFailed)
    } else {
        showStatus("Please give me both a username and a password");
    }
}

function whenAlreadyLoggedIn(userinfo) {
    dojo.byId('display_username').innerHTML = userinfo.username;
    dojo.style('logged_in', 'display', 'block');
}

function whenNotAlreadyLoggedIn() {
    dojo.style('not_logged_in', 'display', 'block');
}

function logout() {
    svr.logout(); 
    dojo.style('logged_in', 'display', 'none');
    dojo.style('not_logged_in', 'display', 'block');
}

function centerOnScreen(el) {
    // retrieve required dimensions
    var elDims = dojo.coords(el);
    var browserDims = dijit.getViewport();

    // calculate the center of the page using the browser and element dimensions
    var y = (browserDims.h - elDims.h) / 2;
    var x = (browserDims.w - elDims.w) / 2;

    // set the style of the element so it is centered
    dojo.style(el, {
        position: 'absolute',
        top: y + 'px',
        left : x + 'px'
    });
}

// make sure that the browser can do our wicked shizzle
function checkBrowserAbility() {
    if (typeof dojo.byId('testcanvas').getContext != "function") return false; // no canvas

    var ctx = dojo.byId('testcanvas').getContext("2d");

    if (ctx.fillText || ctx.mozDrawText)
        return true; // you need text support my friend
    else
        return false;
}

function showingBrowserCompatScreen() {
    if (!checkBrowserAbility()) { // if you don't have the ability              
        dojo.style('browser_not_compat', 'display', 'block'); 
        centerOnScreen(dojo.byId('browser_not_compat'));
        dojo.style('opaque', 'display', 'block'); 
        
        return true;
    } else {
        return false;
    }
}

function hideBrowserCompatScreen() {
    dojo.style('browser_not_compat', 'display', 'none');
    dojo.style('opaque', 'display', 'none');
}

function validateEmail(str) {
    var filter=/^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i
    return filter.test(str);
}


var register = {
    checkUsername:function() {
        dojo.byId('register_username_error').innerHTML = (dojo.byId('register_username').value.length < 4) ? "Usernames must be at least 4 characters long" : "";
    },
    checkPassword:function() {
        dojo.byId('register_password_error').innerHTML = (dojo.byId('register_password').value.length < 6) ? "Passwords must be at least 6 characters long" : "";
    },
    checkConfirm:function() {
        dojo.byId('register_confirm_error').innerHTML = (dojo.byId('register_password').value != dojo.byId('register_confirm').value) ? "Passwords do not match" : "";
    },
    checkEmail:function() {
        dojo.byId('register_email_error').innerHTML = (!validateEmail(dojo.byId('register_email').value)) ? "Invalid email address" : "";
    },
    showForm:function() {
        if (showingBrowserCompatScreen()) return;
        dojo.style('logged_in', 'display', 'none');
        dojo.style('not_logged_in', 'display', 'none');
        dojo.style('opaque', 'display', 'block');
        dojo.style('register_border', 'display', 'block');            
        centerOnScreen(dojo.byId('register_border'));  
    },
    hideForm:function() {                                 
        dojo.style('opaque', 'display', 'none'); 
        dojo.style('register_border', 'display', 'none');
        svr.currentuser(whenAlreadyLoggedIn, whenNotAlreadyLoggedIn);
    },
    send:function() {
        register.hideForm();
        svr.signup(dojo.byId("register_username").value, dojo.byId("register_password").value, dojo.byId('register_email').value, whenLoginSucceeded, whenLoginFailed, whenUsernameInUse);
    },
    cancel:function() { 
        register.hideForm();
    }
};

dojo.addOnLoad(function(){
    bespin.displayVersion();
    svr.currentuser(whenAlreadyLoggedIn, whenNotAlreadyLoggedIn);
});