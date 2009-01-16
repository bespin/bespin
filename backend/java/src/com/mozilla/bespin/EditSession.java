/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 * 
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 * 
 * The Original Code is Bespin.
 * 
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 * 
 * Contributor(s):
 *     Bespin Team (bespin@mozilla.com)
 *
 * 
 * ***** END LICENSE BLOCK ***** */

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