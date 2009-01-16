package com.mozilla.bespin;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import javax.servlet.ServletContext;
import javax.servlet.ServletConfig;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Bag for state managed by {@link BaseServlet}. Used in place of a {@link java.util.Map} to obviate need to cast for
 * common state types.
 */
public class RequestContext {
    private HttpServletRequest req;
    private HttpServletResponse resp;
    private HttpServlet servlet;
    private List<String> parameters = new ArrayList<String>();

    public RequestContext(HttpServlet servlet, HttpServletRequest req, HttpServletResponse resp) {
        this.servlet = servlet;
        this.req = req;
        this.resp = resp;
    }

    public RequestContext(HttpServlet servlet, HttpServletRequest req, HttpServletResponse resp, List<String> parameters) {
        this.servlet = servlet;
        this.req = req;
        this.resp = resp;
        this.parameters.addAll(parameters);
    }

    public HttpServlet getServlet() {
        return servlet;
    }

    public HttpServletRequest getReq() {
        return req;
    }

    public HttpServletResponse getResp() {
        return resp;
    }

    // -- Convenience
    public ServletContext getServletContext() {
        return servlet.getServletContext();
    }

    public ServletConfig getServletConfig() {
        return servlet.getServletConfig();
    }

    public HttpSession getSession() {
        return req.getSession();
    }

    /**
     * Guards against index out of bounds exceptions; returns null if the index is out of bounds
     *
     * @param index
     * @return
     */
    public String parameter(int index) {
        return (parameters.size() > index) ? parameters.get(index) : null;
    }

    /**
     * Returns an unmodifiable wrapper around the parameter list
     * 
     * @return
     */
    public List<String> getParameterList() {
        return Collections.unmodifiableList(parameters);
    }

    /**
     * Pops the first item off the parameter list
     *
     * @return
     */
    public String popParam() {
        return (parameters.isEmpty()) ? null : parameters.remove(0);
    }
}
