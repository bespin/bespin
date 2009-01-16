package com.mozilla.bespin.controllers;

import com.mozilla.bespin.EditSession;
import com.mozilla.bespin.RequiresLogin;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class Edit extends BespinController {
    @RequiresLogin
    public void list() throws IOException {
        JSONArray array = new JSONArray();
        String path = getPath();

        List<JSONObject> edits = getEdits(path);

        array.addAll(edits);
        print(array.toString());
    }

    @RequiresLogin
    public void recent() throws IOException {
        int editIndex;
        try {
            editIndex = Integer.parseInt(getCtx().popParam());
        } catch (Exception e) {
            getCtx().getResp().sendError(400, "Couldn't get index of recent edit");
            return;
        }

        String path = getPath();

        List<JSONObject> editList = getEdits(path);

        JSONArray array = new JSONArray();
        array.addAll(editList.subList(editIndex, editList.size()));
        print(array.toString());
    }

    @RequiresLogin
    public void put() throws IOException {
        String path = getPath();
        String json = getBody();
        Object obj = JSONValue.parse(json);

        if (obj instanceof JSONArray) {
            JSONArray array = (JSONArray) obj;
            addEdits(path, (JSONObject[]) array.toArray(new JSONObject[0]));
        } else {
            addEdits(path, (JSONObject) obj);
        }
    }

    @RequiresLogin
    public void reset() throws IOException {
        if (getCtx().getParameterList().size() == 0) {
            getSessionTracker().resetEdits();
        } else {
            java.io.File file = getFilesystem().getFileHandle(getUser(), getPath());
            getSessionTracker().resetEdits(file);
        }
    }

    private void addEdits(String path, JSONObject... edits) throws IOException {
        // first get the file handle
        java.io.File file = getFilesystem().getFileHandle(getUser(), path);

        // get the edit session
        EditSession editSession = getSessionTracker().getSession(file, getUser());
        if (editSession == null) {
            getCtx().getResp().sendError(400, "No edit session open for file");
            return;
        }

        editSession.addEdits(edits);
    }

    /**
     * Returns a copy of the list of edits for a given file
     *
     * @param path
     * @return
     */
    private List<JSONObject> getEdits(String path) throws IOException {
        // first get the file handle
        java.io.File file = getFilesystem().getFileHandle(getUser(), path);

        // get the edit session
        EditSession editSession = getSessionTracker().getSession(file, getUser());

        if (editSession != null) {
            return editSession.getEdits();
        } else {
            return new ArrayList<JSONObject>();
        }
    }
}