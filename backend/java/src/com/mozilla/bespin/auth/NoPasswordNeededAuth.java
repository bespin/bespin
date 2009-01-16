package com.mozilla.bespin.auth;

import com.mozilla.bespin.RequestContext;

/**
 * Created by IntelliJ IDEA.
 * User: dion
 * Date: Jan 5, 2009
 * Time: 11:52:59 AM
 * To change this template use File | Settings | File Templates.
 */
public class NoPasswordNeededAuth implements Authenticator {
    public String authenticate(RequestContext ctx, String username, String password) {
        return username;
    }

    public Object verify(RequestContext ctx) {
        return null;  // No need to verify in this scheme
    }
}
