// Registration functions for the Bespin front page.

var svr = new Bespin.Server();
var go = Bespin.Navigate;

function processLogin(xhr) {
    go.dashboard();
}

function notLoggedIn(xhr) {
    $("status").innerHTML = "Login didn't work. Try again";
}

function usernameInUse() {
    $("status").innerHTML = "The username is taken. Please choose another."
}

function login() {
    svr.login($("username").value, $("password").value, processLogin, notLoggedIn)
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

Event.observe(document, "dom:loaded", function() {
    svr.currentuser(isLoggedIn, isNotLoggedIn);
});

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
        $('logged_in').hide();
        $('not_logged_in').hide();
        $('register_border').show();
    },
    hideForm:function() {
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

function validateEmail(str) {
    var filter=/^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i
    return filter.test(str);
}
