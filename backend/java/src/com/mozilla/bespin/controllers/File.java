package com.mozilla.bespin.controllers;

import com.mozilla.bespin.EditMode;
import com.mozilla.bespin.EditSession;
import com.mozilla.bespin.FileSystem;
import com.mozilla.bespin.RequiresLogin;
import com.mozilla.bespin.SessionTracker;
import org.apache.commons.lang.StringUtils;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class File extends BespinController {
    @RequiresLogin
    public void list() throws IOException {
        FileSystem filesys = getFilesystem();
        java.io.File[] files = filesys.list(getUser(), getPath());
        JSONArray array = new JSONArray();
        for (int i = 0; i < files.length; i++) {
            String name = files[i].getName();
            if (files[i].isDirectory()) name += "/";
            array.add(name);
        }
        print(array.toString());
    }

    /**
     * Opens a session for the requested file.
     * <p>
     * If the file is already open in read/write mode by another user and read/write was requested, error 409 will be returned.
     * <p>
     * If the file is already open in read-only mode by another user and read-only or read/write was requested, the request will
     * succeed (depending on the outcomes below).
     * <p>
     * If the file is already open in read/write mode by the same user and read-only was requested, error 400 will be returned.
     * <p>
     * If the file is already open in read/write mode by the same user and read/write was requested, the request will success and
     * no new edit session will be created. Ditto for read-only mode.
     * <p>
     * If the file is already open in read-only mode by the same user and read/write was requested, the request will succeed and
     * the previous edit session will be replaced with a new edit session.
     * @throws IOException
     */
    @RequiresLogin
    public void get() throws IOException {
        getCtx().popParam(); // get rid of the /at/
        java.io.File requestedFile = getFilesystem().getFileHandle(getUser(), getPath());
        EditMode editMode = EditMode.ReadWrite;

        SessionTracker tracker = getSessionTracker();

        synchronized (tracker) {
            List<EditSession> editSessions = tracker.getSessions(requestedFile);

            // cover our error conditions
            if (editMode == EditMode.ReadWrite) {
                // check for other editors
                for (EditSession session : editSessions) {
                    if (!session.getUser().equals(getUser())) {
                        if (session.getEditMode() == EditMode.ReadWrite) {
                            getCtx().getResp().sendError(409, "User \"" + session.getUser().username + "\" is already editing the requested file");
                            return;
                        }
                    }
                }
            } else if (editMode == EditMode.Read) {
                // check for an existing read/write session from this user
                for (EditSession session : editSessions) {
                    if (session.getUser().equals(getUser())) {
                        getCtx().getResp().sendError(400, "File already opened by this user in read/write mode; cannot open in read-only mode");
                        return;
                    }
                }
            }

            boolean openSession = true;

            // check for an existing edit session from the current user
            EditSession session = tracker.getSession(requestedFile, getUser());
            if (session != null) {
                if (session.getEditMode() == editMode) openSession = false;
                if ((session.getEditMode() == EditMode.Read) && (editMode == EditMode.ReadWrite)) {
                    tracker.closeSession(requestedFile, getUser());
                }
            }

            if (openSession) {
                tracker.openSession(requestedFile, getUser(), editMode);
            }

            try {
                String contents = getFilesystem().read(getUser(), getPath());
                print(contents);
            } catch (FileNotFoundException e) {
                getCtx().getResp().sendError(404, "File not found");
            }
        }
    }

    @RequiresLogin
    public void put() throws IOException {
        java.io.File file = getFilesystem().getFileHandle(getUser(), getPath());

        SessionTracker tracker = getSessionTracker();
        synchronized (tracker) {
            EditSession session = tracker.getSession(file, getUser());

            // check if the lastEdit parameter was sent
            String lastEdit = getCtx().getReq().getParameter("lastEdit");
            if (StringUtils.isNumeric(lastEdit) && StringUtils.isNotBlank(lastEdit)) {
                // verify that the user has a session open
                if ((session == null) || (session.getEditMode() != EditMode.ReadWrite)) {
                    getCtx().getResp().sendError(400, "File not open for read/write access");
                    return;
                }

                session.setLastEditBeforeSave(Integer.parseInt(lastEdit));
            } else {
                // TODO: We may not be in a collaborate mode, but still want to save back
//                if ((session != null) && (session.getEditMode() == EditMode.ReadWrite)) {
//                    getCtx().getResp().sendError(400, "File open for read/write access; could not save without lastEdit parameter");
//                    return;
//                }
            }
            getFilesystem().write(getUser(), getPath(), getBody());
        }
    }

    @RequiresLogin
    public void delete() throws IOException {
        java.io.File file = getFilesystem().getFileHandle(getUser(), getPath());

        SessionTracker tracker = getSessionTracker();
        synchronized (tracker) {
            // make sure no one else has a session open on the file
            List<EditSession> sessions = tracker.getSessions(file);
            for (EditSession session : sessions) {
                if ((session.getEditMode() == EditMode.ReadWrite) || (!session.getUser().equals(getUser()))) {
                    getCtx().getResp().sendError(409, "Someone else has the file open for read/write access, or you are in read/write mode; cannot delete");
                    return;
                }
            }

            getFilesystem().delete(getUser(), getPath());

            // close any edit sessions open on the file
            for (EditSession session : sessions) tracker.closeSession(file, session.getUser());
        }
    }

    @RequiresLogin
    public void close() throws IOException {
        java.io.File file = getFilesystem().getFileHandle(getUser(), getPath());

        SessionTracker tracker = getSessionTracker();
        tracker.closeSession(file, getUser());
    }

    @RequiresLogin
    public void listopen() throws IOException {
        FileSystem filesys = getFilesystem();
        SessionTracker tracker = getSessionTracker();
        List<EditSession> sessions = tracker.getSessions(getUser());

        JSONObject data = new JSONObject();

        // determine the "project" for the open file and sort by it based on the file name
        for (EditSession session : sessions) {
            java.io.File file = session.getFile();

            List<String> pathnames = new ArrayList<String>();

            java.io.File temp = file;
            while (!temp.equals(filesys.getUserHome(getUser()))) {
                pathnames.add(temp.getName());
                temp = temp.getParentFile();
                if (temp == null) break;
            }

            // only deal with the file if it is in the user's home directory; if it's not, ignore it for now
            if (temp.equals(filesys.getUserHome(getUser()))) {
                Collections.reverse(pathnames);
                String project = pathnames.remove(0);
                JSONObject projectDict = (JSONObject) data.get(project);
                if (projectDict == null) {
                    projectDict = new JSONObject();
                    data.put(project, projectDict);
                }
                String filename = StringUtils.join(pathnames, "/");
                projectDict.put(filename, session.getEditMode().toString());
            }
        }

        print(data.toString());
    }
}
