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