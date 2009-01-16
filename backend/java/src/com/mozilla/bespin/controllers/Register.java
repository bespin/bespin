package com.mozilla.bespin.controllers;

import com.mozilla.bespin.UserSession;
import com.mozilla.bespin.RequiresLogin;
import com.mozilla.bespin.auth.OpenIDAuth;
import com.mozilla.bespin.auth.Authenticator;
import com.mozilla.bespin.auth.NoPasswordNeededAuth;

import java.io.IOException;

import org.openid4java.consumer.ConsumerException;
import org.openid4java.discovery.Identifier;

public class Register extends BespinController {

    private Authenticator auth;

    public Authenticator getAuthenticator() {
        auth = (Authenticator) getCtx().getServletContext().getAttribute("login");
        if (auth == null) {
            //auth = new OpenIDAuth();
            auth = new NoPasswordNeededAuth();
            getCtx().getServletContext().setAttribute("login", auth);
        }
        return auth;
    }

    private void printUserJSON(String username) {
        print("({ 'username':" + username + ", 'project':" + "'secret'})");
    }

    @RequiresLogin
    public void userinfo() {
        UserSession session = (UserSession) getCtx().getReq().getSession(true).getAttribute("userSession");
        // TODO do the same sha1 has as the python clent
        this.printUserJSON(session.username);
    }

    public void login() throws IOException {
        String username = getCtx().parameter(0);
        if (username == null) {
            getCtx().getResp().sendError(400, "You must provide a username to the \"login\" request");
            return;
        }

        String password = getCtx().parameter(1);
        if (password == null) {
            password = "";
        }

        // -- if you are already logged in return
        UserSession session = (UserSession) getCtx().getReq().getSession(true).getAttribute("userSession");
        if (session != null && session.username.equals(username)) {
            this.printUserJSON(session.username);
        } else {
            String result = getAuthenticator().authenticate(getCtx(), username, password);
            if (result != null) {
                storeLoggedInUser(result);
                this.printUserJSON(session.username);
            }
        }
    }

    /**
     * Helper to handle the stored logged in user
     */
    private void storeLoggedInUser(String username) {
        UserSession session = new UserSession();
        session.username = username;
        getCtx().getReq().getSession(true).setAttribute("userSession", session);
    }

    /*
     * The OpenID provider returns to this action
     */
    public void verify() {
        Identifier verified = (Identifier) getAuthenticator().verify(getCtx());
        if (verified != null) {
            storeLoggedInUser(verified.getIdentifier());
            printStatus();
        } else {
            print("Unable to verify.");
        }
    }

    public void logout() {
        getCtx().getReq().getSession(true).removeAttribute("userSession");
        print(UserSession.MESSAGE_LOGGED_OUT);
    }

    public void handler() {
        printStatus();
    }

    private void printStatus() {
        UserSession session = (UserSession) getCtx().getReq().getSession(true).getAttribute("userSession");

        if (session == null) {
            print(UserSession.MESSAGE_NOT_LOGGED_IN);
            return;
        }

        print(String.format(UserSession.MESSAGE_LOGGED_IN, session.username));
    }
}