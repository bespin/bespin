package com.mozilla.bespin;

import org.json.simple.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.ConcurrentModificationException;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

public class SessionTracker {

    private Map<File, List<EditSession>> sessionsByFile = new HashMap<File, List<EditSession>>();
    private Map<UserSession, List<EditSession>> sessionsByUser = new HashMap<UserSession, List<EditSession>>();


    /**
     * Returns the edits that a user has applied to a specified file.
     *
     * @param file
     * @param session
     * @return always returns a list; if no edits have been applied, an empty list is returned. The returned list is not live.
     */
    public synchronized List<JSONObject> getEdits(File file, UserSession session) {
        EditSession editSession = getSession(file, session);
        return (editSession != null) ? editSession.getEdits() : Collections.EMPTY_LIST;
    }

    /**
     * Returns any edit sessions that may be open for this file; returned list is not live
     *
     * @return
     */
    public synchronized List<EditSession> getSessions(File file) {
        return new ArrayList<EditSession>(getLiveSessions(file));
    }

    /**
     * Returns any edit sessions open by the passed user; returned list is not live
     * @param user
     * @return
     */
    public synchronized List<EditSession> getSessions(UserSession user) {
        return new ArrayList<EditSession>(getLiveSessions(user));
    }

    /**
     * Returns the EditSession corresponding to the passed UserSession, or null if one does not exist
     * 
     * @param file
     * @param session
     * @return
     */
    public synchronized EditSession getSession(File file, UserSession session) {
        List<EditSession> editSessions = sessionsByFile.get(file);
        if (editSessions == null) return null;

        for (EditSession editSession : editSessions) {
            if (editSession.getUser().equals(session)) return editSession;
        }

        return null;
    }

    public synchronized EditSession openSession(File file, UserSession session, EditMode mode) {
        if (getSession(file, session) != null) throw new ConcurrentModificationException("Edit session already exists");

        EditSession editSession = new EditSession(file, session, mode);
        getLiveSessions(file).add(editSession);
        getLiveSessions(session).add(editSession);
        return editSession;
    }

    public synchronized void closeSession(File file, UserSession session) {
        EditSession edit = getSession(file, session);
        if (edit != null) {
            getLiveSessions(file).remove(edit);
            getLiveSessions(session).remove(edit);
        }
    }

    public synchronized void resetEdits(File file) {
        List<EditSession> edits = getLiveSessions(file);
        for (EditSession edit : edits) {
            edit.clearEdits();
        }
    }

    public synchronized void resetEdits() {
        Collection<List<EditSession>> edits = sessionsByFile.values();
        for (Iterator<List<EditSession>> iterator = edits.iterator(); iterator.hasNext();) {
            List<EditSession> lists = iterator.next();
            for (EditSession edit : lists) {
                edit.clearEdits();
            }
        }
    }

    private synchronized List<EditSession> getLiveSessions(UserSession user) {
        List<EditSession> sessions = this.sessionsByUser.get(user);
        if (sessions == null) {
            sessions = new ArrayList<EditSession>();
            this.sessionsByUser.put(user, sessions);
        }
        return sessions;
    }

    private synchronized List<EditSession> getLiveSessions(File file) {
        List<EditSession> sessions = this.sessionsByFile.get(file);
        if (sessions == null) {
            sessions = new ArrayList<EditSession>();
            this.sessionsByFile.put(file, sessions);
        }
        return sessions;
    }
}
