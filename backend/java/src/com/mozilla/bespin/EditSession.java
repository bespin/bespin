package com.mozilla.bespin;

import org.json.simple.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class EditSession {
    private File file;
    private UserSession session;
    private EditMode editMode;
    private List<JSONObject> edits;
    private int lastEditBeforeSave = -1;

    EditSession(File file, UserSession session, EditMode editMode) {
        this.file = file;
        this.session = session;
        this.editMode = editMode;

        if (editMode == EditMode.ReadWrite) edits = new ArrayList<JSONObject>();
    }

    public UserSession getUser() {
        return session;
    }

    public EditMode getEditMode() {
        return editMode;
    }

    public File getFile() {
        return file;
    }

    public List<JSONObject> getEdits() {
        return (edits == null) ? new ArrayList<JSONObject>(0) : new ArrayList<JSONObject>(edits);
    }

    public List<JSONObject> getEditsSinceLastSave() {
        if (edits == null) return new ArrayList<JSONObject>(0);
        if (lastEditBeforeSave > edits.size() - 1) throw new IllegalStateException("lastEditBeforeSave set too high!");
        if (lastEditBeforeSave == edits.size() - 1) return new ArrayList<JSONObject>(0);
        return new ArrayList<JSONObject>(edits.subList(lastEditBeforeSave + 1, edits.size()));
    }

    public void addEdits(JSONObject... edits) {
        if (editMode != EditMode.ReadWrite) throw new IllegalStateException("Edit session is read-only; can't add edits");
        this.edits.addAll(Arrays.asList(edits));
    }

    public void clearEdits() {
        if (edits != null) edits.clear();
    }

    public int getLastEditBeforeSave() {
        return lastEditBeforeSave;
    }

    public void setLastEditBeforeSave(int lastEditBeforeSave) {
        this.lastEditBeforeSave = lastEditBeforeSave;
    }
}