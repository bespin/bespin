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
