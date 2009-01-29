package com.mozilla.bespin.controllers;

import com.mozilla.bespin.Controller;
import com.mozilla.bespin.FileSystem;
import com.mozilla.bespin.UserSession;
import com.mozilla.bespin.SessionTracker;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import org.apache.commons.io.FileUtils;

public class BespinController extends Controller {
    private static final String KEY_SESSION_TRACKER = "bespin.controller.session_tracker";
    private static final String KEY_FILESYSTEM = "bespin.controller.filesystem";
    private static final String KEY_USER_SETTINGS = "bespin.controller.usersettings";

    @Override
    protected boolean isAuthenticated() {
        return getCtx().getReq().getSession(true).getAttribute("userSession") != null;
    }

    protected synchronized FileSystem getFilesystem() throws IOException {
        FileSystem filesys = (FileSystem) getCtx().getServletContext().getAttribute(KEY_FILESYSTEM);
        if (filesys == null) {
            createFileSystemAndSessionTracker();
            filesys = (FileSystem) getCtx().getServletContext().getAttribute(KEY_FILESYSTEM);
        }
        return filesys;
    }

    protected void createFileSystemAndSessionTracker() throws IOException {
        String base = getCtx().getServletConfig().getInitParameter("base");
        if (base == null) throw new IOException("File system not seeded with base directory and could not be mounted (this is for you, Netbeans)");

        String template = getCtx().getServletConfig().getInitParameter("template");
        if (template == null) throw new IOException("Template directory not provided");

        java.io.File baseDir = new java.io.File(base);
        java.io.File templateDir = new java.io.File(template);

        FileSystem filesys = new FileSystem(baseDir, templateDir);
        getCtx().getServletContext().setAttribute(KEY_FILESYSTEM, filesys);

        SessionTracker sessions = new SessionTracker();
        getCtx().getServletContext().setAttribute(KEY_SESSION_TRACKER, sessions);
    }

    protected synchronized SessionTracker getSessionTracker() throws IOException {
        SessionTracker sessions = (SessionTracker) getCtx().getServletContext().getAttribute(KEY_SESSION_TRACKER);
        if (sessions == null) {
            createFileSystemAndSessionTracker();
            sessions = (SessionTracker) getCtx().getServletContext().getAttribute(KEY_SESSION_TRACKER);
        }
        return sessions;
    }

    /**
     * Return the settings for the current user; returns null if there is no current user
     * @return
     */
    protected synchronized Map<String, String> getUserSettings() {
        UserSession session = (UserSession) getCtx().getReq().getSession(true).getAttribute("userSession");
        if (session == null) return null;
        Map<UserSession, Map<String, String>> settingsMap = (Map<UserSession, Map<String, String>>) getCtx().getServletContext().getAttribute(KEY_USER_SETTINGS);
        if (settingsMap == null) {
            settingsMap = new HashMap<UserSession, Map<String, String>>();
            getCtx().getServletContext().setAttribute(KEY_USER_SETTINGS, settingsMap);
        }

        Map<String, String> settings = settingsMap.get(session);
        if (settings == null) {
            settings = new HashMap<String, String>();
            settingsMap.put(session, settings);
        }

        return settings;
    }

    protected String getPath() {
        StringBuilder builder = new StringBuilder();
        for (String pathItem : getCtx().getParameterList()) {
            if (builder.length() != 0) builder.append("/"); // using "/" instead of File.separator because these paths are used as keys in hashes that may cross OS boundaries
            builder.append(pathItem);
        }
        return builder.toString();
    }

    protected UserSession getUser() {
        return (UserSession) getCtx().getReq().getSession(true).getAttribute("userSession");
    }
}
