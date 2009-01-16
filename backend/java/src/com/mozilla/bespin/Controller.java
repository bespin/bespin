package com.mozilla.bespin;

import java.io.IOException;
import java.io.Reader;

public class Controller {
    private RequestContext ctx;

    public RequestContext getCtx() {
        return ctx;
    }

    public void setCtx(RequestContext ctx) {
        this.ctx = ctx;
    }

    /**
     * Convenience method that catches the exception and prints it out
     *
     * @param message
     */
    protected void print(String message) {
        try {
            getCtx().getResp().setHeader("Content-Type", "text/plain");
            getCtx().getResp().getWriter().print(message);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    /**
     * Convenience method for returning the body stream as a single string.
     *
     * @return
     * @throws IOException
     */
    protected String getBody() throws IOException {
        Reader reader = getCtx().getReq().getReader();
        StringBuffer sb = new StringBuffer();
        int i = 0;
        while ((i = reader.read()) != -1) sb.append((char) i);
        return sb.toString();
    }

    protected boolean isAuthenticated() {
        throw new UnsupportedOperationException("You must implement the isAuthenticated() method in your Controller subclass");
    }
}
