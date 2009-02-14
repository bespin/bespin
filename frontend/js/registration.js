// Registration functions for the Bespin front page.

var svr = new Bespin.Server();
var go = Bespin.Navigate;

function processLogin(xhr) {
    go.dashboard();
}

function notLoggedIn(xhr) {
    showStatus("Sorry, login didn't work. Try again? Caps lock on?");
}

function usernameInUse() {
    showStatus("The username is taken. Please choose another.");
}

function showStatus(msg) {
    $("status").innerHTML = msg;
    $("status").show();
}

function login() {
    if (showingBrowserCompatScreen()) return;
    
    if ($("username").value && $("password").value) {
        svr.login($("username").value, $("password").value, processLogin, notLoggedIn)
    } else {
        showStatus("Please give me both a username and a password");
    }
}

function isLoggedIn(userinfo) {
    $('display_username').innerHTML = userinfo.username;
    $('logged_in').show();
}

function isNotLoggedIn() {
    $('not_logged_in').show();
}

function logout() {
    svr.logout();
    $('logged_in').hide();
    $('not_logged_in').show();
}

function centerOnScreen(el) {
    // retrieve required dimensions
    var elDims = el.getDimensions();
    var browserDims = document.body.getDimensions();

    // calculate the center of the page using the browser and element dimensions
    var y = (browserDims.height - elDims.height) / 2;
    var x = (browserDims.width - elDims.width) / 2;

    // set the style of the element so it is centered
    var styles = { 
        position: 'absolute',
        top: y + 'px',
        left : x + 'px' 
    };
    el.setStyle(styles);
}

// make sure that the browser can do our wicked shizzle
function checkBrowserAbility() {
    if (typeof $('testcanvas').getContext != "function") return false; // no canvas
    
    var ctx = $('testcanvas').getContext("2d");
    
    if (ctx.fillText || ctx.mozDrawText) 
        return true; // you need text support my friend
    else
        return false;
}

function showingBrowserCompatScreen() {
    if (!checkBrowserAbility()) { // if you don't have the ability
        centerOnScreen($('browser_not_compat'));
        $('browser_not_compat').show();
        $('opaque').show();
        return true;
    } else {
        return false;
    }
}

function hideBrowserCompatScreen() {
    $('browser_not_compat').hide();
    $('opaque').hide();
}

function validateEmail(str) {
    var filter=/^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i
    return filter.test(str);
}


var register = {
    checkUsername:function() {
        $('register_username_error').innerHTML = ($F('register_username').length < 4) ? "Usernames must be at least 4 characters long" : "";
    },
    checkPassword:function() {
        $('register_password_error').innerHTML = ($F('register_password').length < 6) ? "Passwords must be at least 6 characters long" : "";
    },
    checkConfirm:function() {
        $('register_confirm_error').innerHTML = ($F('register_password') != $F('register_confirm')) ? "Passwords do not match" : "";
    },
    checkEmail:function() {
        $('register_email_error').innerHTML = (!validateEmail($F('register_email'))) ? "Invalid email address" : "";
    },
    showForm:function() {
        if (showingBrowserCompatScreen()) return;
        $('logged_in').hide();
        $('not_logged_in').hide();
        centerOnScreen($('register_border'));
        $('register_border').show();
        $('opaque').show();
    },
    hideForm:function() {
        $('opaque').hide();
        $('register_border').hide();
        svr.currentuser(isLoggedIn, isNotLoggedIn);
    },
    send:function() {
        register.hideForm();
        svr.signup($("register_username").value, $("register_password").value, $('register_email').value, processLogin, notLoggedIn);

    },
    cancel:function() {
        register.hideForm();
    }
};

Event.observe(document, "dom:loaded", function() {
    Bespin.displayVersion();
    svr.currentuser(isLoggedIn, isNotLoggedIn);
});
