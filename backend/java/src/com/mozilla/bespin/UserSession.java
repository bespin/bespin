package com.mozilla.bespin;

public class UserSession {
    public static final String MESSAGE_NOT_LOGGED_IN = "You are not logged in";
    public static final String MESSAGE_LOGGED_IN = "You are logged in as %1$s";
    public static final String MESSAGE_LOGGED_OUT = "You are logged out";

    public String username;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;

        UserSession that = (UserSession) o;

        if (!username.equals(that.username)) return false;

        return true;
    }

    @Override
    public int hashCode() {
        return username.hashCode();
    }
}
