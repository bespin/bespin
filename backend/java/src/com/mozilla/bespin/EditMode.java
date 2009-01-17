package com.mozilla.bespin;

// uses an enum to reserve space for future modes, like owner, collaborator, etc.
public enum EditMode {
    Read      ("r"),
    ReadWrite ("rw");

    private String code;

    EditMode(String code) {
        this.code = code;
    }

    @Override
    public String toString() {
        return code;
    }
}
