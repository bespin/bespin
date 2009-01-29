package com.mozilla.bespin;

import org.apache.commons.lang.StringUtils;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class BaseServlet extends HttpServlet {
    private Map<MethodCacheKey, Method> methodCache = new HashMap<MethodCacheKey, Method>();

    /**
     * Dispatches a request to the appropriate handler method.
     *
     * @param request
     * @param response
     * @throws ServletException
     * @throws IOException
     */
    @Override
    protected void service(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        List<String> paths = new ArrayList<String>(Arrays.asList(request.getRequestURI().toLowerCase().substring(1).split("/")));
        String controllerName = StringUtils.capitalize(paths.remove(0));

        Controller controller;
        try {
            Class controllerClazz = Class.forName("com.mozilla.bespin.controllers." + controllerName);
            controller = (Controller) controllerClazz.newInstance();
        } catch (ClassNotFoundException e) {
            response.sendError(404, String.format("Controller \"%1$s\" not found", controllerName));
            return;
        } catch (Exception e) {
            response.sendError(500, String.format("Controller \"%1$s\" could not be instantiated (%2$s)", controllerName, e.getClass() + ": " + e.getMessage()));
            return;
        }

        // if there's a path element, check for a method with that name
        Method method = null;
        if (!paths.isEmpty()) {
            method = getMethod(paths.get(0), controller.getClass());
            if (method != null) paths.remove(0); // if the method was found, remove that path element from the list b/c it is not an arg
        }

        // if the method is still null, check for a method with the name of the HTTP method
        if (method == null) method = getMethod(request.getMethod().toLowerCase(), controller.getClass());

        // if the method is still null, check for a default method
        if (method == null) method = getMethod("handler", controller.getClass());

        if (method != null) {
            RequestContext ctx = new RequestContext(this, request, response, paths);
            controller.setCtx(ctx);
            try {
                if (method.isAnnotationPresent(RequiresLogin.class)) {
                    if (!controller.isAuthenticated()) {
                        response.sendError(401, "You're not logged in, and this request requires you to be");
                        return;
                    }
                }

                // if there are any parameters, it'll be for a single RequestContext instance
                if (method.getParameterTypes().length != 0) {
                    method.invoke(controller, ctx);
                } else {
                    method.invoke(controller);
                }
            } catch (Exception e) {
                response.sendError(500, String.format("Error invoking method for request"));
                return;
            }
        } else {
            response.sendError(400, String.format("Couldn't map request \"%1$s\" to a controller/method", request.getRequestURI()));
        }
    }

    private Method getMethod(String methodName, Class<? extends Object> controllerClass) {
        MethodCacheKey key = new MethodCacheKey(controllerClass, methodName);
        Method m = methodCache.get(key);
        if (m != null) return m;

        m = getMethodReflectively(methodName, controllerClass);
        if (m != null) methodCache.put(key, m);

        return m;
    }

    private Method getMethodReflectively(String method, Class clazz) {
        try {
            return clazz.getMethod(method);
        } catch (NoSuchMethodException e) {
            // fall through to next attempt
        } catch (Exception e) {
            System.err.println("Unexpected exception in hasMethod");
            e.printStackTrace();
            return null;
        }

        // try a method that has a RequestContext arg
        try {
            return clazz.getMethod(method, RequestContext.class);
        } catch (NoSuchMethodException e) {
            return null;
        } catch (Exception e) {
            System.err.println("Unexpected exception in hasMethod");
            e.printStackTrace();
            return null;
        }
    }

    private class MethodCacheKey {
        private Class controller;
        private String method;

        private MethodCacheKey(Class controller, String method) {
            this.controller = controller;
            this.method = method;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;

            MethodCacheKey that = (MethodCacheKey) o;

            if (!controller.equals(that.controller)) return false;
            if (!method.equals(that.method)) return false;

            return true;
        }

        @Override
        public int hashCode() {
            int result = controller.hashCode();
            result = 31 * result + method.hashCode();
            return result;
        }
    }
}
