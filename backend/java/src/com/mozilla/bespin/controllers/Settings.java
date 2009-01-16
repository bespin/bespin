package com.mozilla.bespin.controllers;

import com.mozilla.bespin.RequiresLogin;
import org.json.simple.JSONObject;

import java.io.IOException;

public class Settings extends BespinController {
    @RequiresLogin
    public void get() {
        if (getCtx().getParameterList().isEmpty()) {
            getAll();
        } else {
            String value = getUserSettings().get(getCtx().parameter(0));
            print(JSONObject.escape(value));
        }
    }

    @RequiresLogin
    public void getAll() {
        JSONObject output = new JSONObject();
        output.putAll(getUserSettings());
        print(output.toString());
    }

    @RequiresLogin
    public void post() throws IOException {
        String setting = getBody();


        String[] params = setting.split("&");
        for (String param : params) {
            String[] namevalue = param.split("=");

// TODO: can allow an empty?            
//        if (namevalue.length != 2) {
//            getCtx().getResp().sendError(400, "Post body should contain a key/value pair delimited with an equals symbol");
//            return;
//        }

            getUserSettings().put(namevalue[0], namevalue[1]);
        }

    }

    @RequiresLogin
    public void delete() {
        String settingKey = getCtx().parameter(0);
        getUserSettings().remove(settingKey);
    }
}
