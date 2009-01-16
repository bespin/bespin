package com.mozilla.bespin;

import org.apache.commons.io.FileUtils;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.FileOutputStream;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;
import java.nio.charset.Charset;

/**
 * Abstraction for file I/O.
 */
public class FileSystem {
    private File base;
    private File template;

    public FileSystem(File base, File template) {
        this.base = base;
        this.template = template;
    }

    /**
     *
     * @param path relative to the base directory
     * @return
     */
    public File[] list(UserSession session, String path) {
        return new File(getUserHome(session), path).listFiles();
    }

    /**
     * Returns a file as a String.
     *
     * @param path
     * @param session the user requesting the file
     * @return
     * @throws FileNotFoundException
     */
    public String read(UserSession session, String path) throws FileNotFoundException {
        File file = getFileHandle(session, path);

        if (file.isDirectory()) throw new FileNotFoundException(String.format("Passed file %1$s is a directory not a file", file));
        if (!file.exists()) throw new FileNotFoundException(String.format("Passed file %1$s does not exist", file));

        try {
            FileInputStream in = new FileInputStream(file);
            byte[] bytes = new byte[(int) file.length()];
            in.read(bytes);
            in.close();

            return new String(bytes, Charset.forName("UTF-8"));
        } catch (IOException e) {
            System.err.println("Obscure I/O error encountered (stack trace to follow)");
            e.printStackTrace();
            return "IO ERROR";
        }
    }

    public void write(UserSession session, String path, String contents) throws IOException {
        File file = getFileHandle(session, path);

        if (file.isDirectory()) throw new FileNotFoundException(String.format("Passed file %1$s is a directory not a file", file));

        if (!file.exists()) file.getParentFile().mkdirs();
        
        byte[] bytes = contents.getBytes(Charset.forName("UTF-8"));
        FileOutputStream out = new FileOutputStream(file);
        out.write(bytes);
        out.close();
    }

    public void delete(UserSession session, String path) throws FileNotFoundException {
        File file = getFileHandle(session, path);

        if (file.equals(base)) return;
        if (file.isDirectory()) return; // TODO: implement this
        if (file.exists()) {
            file.delete();
        }
    }


    public File getFileHandle(UserSession session, String path) throws FileNotFoundException {
        return new File(getUserHome(session), path);
    }


    public File getUserHome(UserSession session) {
        File userHome = new File(base, session.username);

        if (userHome.exists()) {
            userHome.mkdirs();

            // try to copy the template directory to the newly-created user home directory
            try {
                FileUtils.copyDirectory(template, userHome);
            } catch (IOException e) {
                System.err.println(String.format("Couldn't copy template \"%1$s\" directory to new user directory \"%2$s\"; stacktrace follows", template, userHome));
                e.printStackTrace();
            }
        }

        return userHome;
    }
}