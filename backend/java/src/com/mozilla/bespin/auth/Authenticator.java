package com.mozilla.bespin.auth;

import com.mozilla.bespin.RequestContext;

/**
 * Created by IntelliJ IDEA.
 * User: dion
 * Date: Jan 5, 2009
 * Time: 11:33:54 AM
 * To change this template use File | Settings | File Templates.
 */
public interface Authenticator {
    public String authenticate(RequestContext ctx, String username, String password);

    public Object verify(RequestContext ctx);
}
