package com.mozilla.bespin;

import java.sql.*;

/**
 * Created by IntelliJ IDEA.
 * User: dion
 * Date: Dec 10, 2008
 * Time: 12:15:28 PM
 */
public class Database {
    private static Database DB = null;

    private Database() {
    }

    public static Database getInstance() {
        if (DB == null) {
            DB = new Database();
            DB.init();
        }
        return DB;
    }

    private Connection conn;

    public Connection getDB() {
        if (this.conn == null) {
            try {
                this.conn = DriverManager.getConnection("jdbc:sqlite:/bespin/db/backend.db");
            } catch (SQLException e) {
                e.printStackTrace();
            }

        }
        return this.conn;
    }

    public void init() {
        try {
            Class.forName("org.sqlite.JDBC");
            Connection conn = this.getDB();

            Statement stat = conn.createStatement();
            //stat.executeUpdate("drop table if exists users;");
            stat.executeUpdate("create table users (username, password);");
            PreparedStatement prep = conn.prepareStatement("insert into users values (?, ?);");

            prep.setString(1, "dion");
            prep.setString(2, "dion");
            prep.addBatch();

            prep.setString(1, "ben");
            prep.setString(2, "ben");
            prep.addBatch();

            prep.setString(1, "demo");
            prep.setString(2, "demo");
            prep.addBatch();

            conn.setAutoCommit(false);
            prep.executeBatch();
            conn.setAutoCommit(true);

            conn.close();

        } catch (Exception e) {
            e.printStackTrace(); // gulp!
        }
    }

    public String users() {
        String users = "";
        try {
            Statement stat = this.getDB().createStatement();

            ResultSet rs = stat.executeQuery("select * from users;");
            while (rs.next()) {
                users += "username = " + rs.getString("username") + "," + "password = " + rs.getString("password") + "\n";
            }
            rs.close();
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return users;
    }
}
