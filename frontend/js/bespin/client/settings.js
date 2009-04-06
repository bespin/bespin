/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 * See the License for the specific language governing rights and
 * limitations under the License.
 *
 * The Original Code is Bespin.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bespin Team (bespin@mozilla.com)
 *
 * ***** END LICENSE BLOCK ***** */

dojo.provide("bespin.client.settings");

// = Settings =
//
// This settings module provides a base implementation to store settings for users.
// It also contains various "stores" to save that data, including:
//
// * {{{bespin.client.settings.Core}}} : Core interface to settings. User code always goes through here.
// * {{{bespin.client.settings.Server}}} : The main store. Saves back to the Bespin Server API
// * {{{bespin.client.settings.InMemory}}} : In memory settings that are used primarily for debugging
// * {{{bespin.client.settings.Cookie}}} : Store in a cookie using cookie-jar
// * {{{bespin.client.settings.URL}}} : Intercept settings in the URL. Often used to override
// * {{{bespin.client.settings.DB}}} : Commented out for now, but a way to store settings locally
// * {{{bespin.client.settings.Events}}} : Custom events that the settings store can intercept and send

// ** {{{ bespin.client.settings.Core }}} **
//
// Handles load/save of user settings.
// TODO: tie into the sessions servlet; eliminate Gears dependency

dojo.declare("bespin.client.settings.Core", null, {
    constructor: function(store) {
        this.browserOverrides = {};
        this.fromURL = new bespin.client.settings.URL();
        this.customEvents = new bespin.client.settings.Events(this);

        this.loadStore(store);    // Load up the correct settings store
    },

    loadSession: function() {
        var path    = this.fromURL.get('path') || this.get('_path');
        var project = this.fromURL.get('project') || this.get('_project');
        
        bespin.publish("settings:init", { // -- time to init my friends
            path: path,
            project: project
        });
    },

    defaultSettings: function() {
        return {
            'tabsize': '2',
            'tabmode': 'off',
            'tabarrow': 'on',
            'fontsize': '10',
            'autocomplete': 'off',
            'collaborate': 'off',
            'language': 'auto',
            'strictlines': 'on',
            'syntaxengine': 'simple',
            'preview': 'window',
            'smartmove': 'on',
        };
    },

    isOn: function(value) {
        return value == 'on' || value == 'true';
    },

    isOff: function(value) {
        return value == 'off' || value == 'false';
    },
    
    isSettingOn: function(key) {
        return this.isOn(this.get(key));
    },

    isSettingOff: function(key) {
        return this.isOff(this.get(key));
    },

    // ** {{{ Settings.loadStore() }}} **
    //
    // This is where we choose which store to load
    loadStore: function(store) {
        this.store = new (store || bespin.client.settings.Server)(this);

//        this.store = new Bespin.Settings.Cookie(this);

// TODO: ignore gears for now:
// this.store = (window['google']) ? new Bespin.Settings.DB : new Bespin.Settings.InMemory;
// this.store = new Bespin.Settings.InMemory;
    },

    toList: function() {
        var settings = [];
        var storeSettings = this.store.settings;
        for (var prop in storeSettings) {
            if (storeSettings.hasOwnProperty(prop)) {
                settings.push({ 'key': prop, 'value': storeSettings[prop] });
            }
        }
        return settings;
    },

    set: function(key, value) {
        this.store.set(key, value);

        bespin.publish("settings:set:" + key, { value: value });
    },

    get: function(key) {
        var fromURL = this.fromURL.get(key); // short circuit
        if (fromURL) return fromURL;

        return this.store.get(key);
    },

    unset: function(key) {
        this.store.unset(key);
    },

    list: function() {
        if (typeof this.store['list'] == "function") {
            return this.store.list();
        } else {
            return this.toList();
        }
    }

});

// ** {{{ bespin.client.settings.InMemory }}} **
//
// Debugging in memory settings (die when browser is closed)

dojo.declare("bespin.client.settings.InMemory", null, {
    constructor: function(parent) {
        this.parent = parent;
        this.settings = this.parent.defaultSettings(); 
        bespin.publish("settings:loaded"); 
    },

    set: function(key, value) {
        this.settings[key] = value;
    },

    get: function(key) {
        return this.settings[key];
    },

    unset: function(key) {
        delete this.settings[key];
    }
});

// ** {{{ bespin.client.settings.Cookie }}} **
//
// Save the settings in a cookie

dojo.declare("bespin.client.settings.Cookie", null, {
    constructor: function(parent) {
        var expirationInHours = 1;
        this.cookieSettings = {
            expires: expirationInHours / 24,
            path: '/'
        };

        var settings = dojo.fromJson(dojo.cookie("settings"));

        if (settings) {
            this.settings = settings;
        } else {
            this.settings = {
                'tabsize': '2',
                'fontsize': '10',
                'autocomplete': 'off',
                'collaborate': 'off',
                '_username': 'dion'
            };
            dojo.cookie("settings", dojo.toJson(this.settings), this.cookieSettings);
        }
        bespin.publish("settings:loaded");
    },

    set: function(key, value) {
        this.settings[key] = value;
        dojo.cookie("settings", dojo.toJson(this.settings), this.cookieSettings);
    },

    get: function(key) {
        return this.settings[key];
    },

    unset: function(key) {
        delete this.settings[key];
        dojo.cookie("settings", dojo.toJson(this.settings), this.cookieSettings);
    }
});    

// ** {{{ bespin.client.settings.Server }}} **
//
// The real grand-daddy that implements uses {{{Server}}} to access the backend

dojo.declare("bespin.client.settings.Server", null, {
    constructor: function(parent) {
        this.parent = parent;
        this.server = bespin.get('server');
        this.settings = this.parent.defaultSettings(); // seed defaults just for now!

        // TODO: seed the settings  
        this.server.listSettings(dojo.hitch(this, function(settings) {
            this.settings = settings;
            if (settings['tabsize'] === undefined) {
                this.settings = this.parent.defaultSettings();
                this.server.setSettings(this.settings);
            }
            bespin.publish("settings:loaded");
        }));
    },

    set: function(key, value) {
        this.settings[key] = value;
        this.server.setSetting(key, value);
    },

    get: function(key) {
        return this.settings[key];
    },

    unset: function(key) {
        delete this.settings[key];
        this.server.unsetSetting(key);
    }
});


// ** {{{ bespin.client.settings.DB }}} **
//
// Taken out for now to allow us to not require gears_db.js (and Gears itself).
// Experimental ability to save locally in the SQLite database.
// The plan is to migrate to ActiveRecord.js or something like it to abstract on top
// of various stores (HTML5, Gears, globalStorage, etc.)

/*
// turn off for now so we can take gears_db.js out

Bespin.Settings.DB = Class.create({
    initialize: function(parent) {
        this.parent = parent;
        this.db = new GearsDB('wideboy');

        //this.db.run('drop table settings');
        this.db.run('create table if not exists settings (' +
               'id integer primary key,' +
               'key varchar(255) unique not null,' +
               'value varchar(255) not null,' +
               'timestamp int not null)');

        this.db.run('CREATE INDEX IF NOT EXISTS settings_id_index ON settings (id)');
        bespin.publish("settings:loaded");
    },

    set: function(key, value) {
        this.db.forceRow('settings', { 'key': key, 'value': value, timestamp: new Date().getTime() }, 'key');
    },

    get: function(key) {
        var rs = this.db.run('select distinct value from settings where key = ?', [ key ]);
        try {
            if (rs && rs.isValidRow()) {
              return rs.field(0);
            }
        } catch (e) {
            console.log(e.message);
        } finally {
            rs.close();
        }
    },

    unset: function(key) {
        this.db.run('delete from settings where key = ?', [ key ]);
    },

    list: function() {
        // TODO: Need to override with browser settings
        return this.db.selectRows('settings', '1=1');
    },

    // -- Private-y
    seed: function() {
        this.db.run('delete from settings');

        // TODO: loop through the settings
        this.db.run('insert into settings (key, value, timestamp) values (?, ?, ?)', ['keybindings', 'emacs', 1183878000000]);
        this.db.run('insert into settings (key, value, timestamp) values (?, ?, ?)', ['tabsize', '2', 1183878000000]);
        this.db.run('insert into settings (key, value, timestamp) values (?, ?, ?)', ['fontsize', '10', 1183878000000]);
        this.db.run('insert into settings (key, value, timestamp) values (?, ?, ?)', ['autocomplete', 'off', 1183878000000]);
    }
});
*/

// ** {{{ bespin.client.settings.URL }}} **
//
// Grab the setting from the URL, either via # or ?   

dojo.declare("bespin.client.settings.URL", null, {
    constructor: function(queryString) {            
        this.results = dojo.queryToObject(this.stripHash(queryString || window.location.hash));
    },

    get: function(key) {
        return this.results[key];
    },

    set: function(key, value) {
        this.results[key] = value;
    },
    
    stripHash: function(url) {
        var tobe = url.split('');
        tobe.shift();
        return tobe.join('');
    }
});

// ** {{{ bespin.client.settings.Events }}} **
//
// Custom Event holder for the Settings work. 
// It deals with both settings themselves, and other events that
// settings need to watch and look for

dojo.declare("bespin.client.settings.Events", null, {
    constructor: function(settings) {
        var editSession = bespin.get('editSession');
        var editor = bespin.get('editor');

        // ** {{{ Event: settings:set }}} **
        // 
        // Watch for someone wanting to do a set operation
        bespin.subscribe("settings:set", function(event) {
            var key = event.key;
            var value = event.value;

            settings.set(key, value);
        });

        // ** {{{ Event: editor:openfile:opensuccess }}} **
        // 
        // Change the session settings when a new file is opened
        bespin.subscribe("editor:openfile:opensuccess", function(event) {
            editSession.path = event.file.name;

            settings.set('_project',  editSession.project);
            settings.set('_path',     editSession.path);
            settings.set('_username', editSession.username);

            if (editSession.syncHelper) editSession.syncHelper.syncWithServer();
        });

        // ** {{{ Event: editor:openfile:opensuccess }}} **
        // 
        // Change the syntax highlighter when a new file is opened
        bespin.subscribe("editor:openfile:opensuccess", function(event) {
            var split = event.file.name.split('.');
            var type = split[split.length - 1]; 

            if (type) {
                bespin.publish("settings:language", { language: type });
            }
        });

        // ** {{{ Event: settings:set:language }}} **
        // 
        // When the syntax setting is changed, tell the syntax system to change
        bespin.subscribe("settings:set:language", function(event) {
            bespin.publish("settings:language", { language: event.value, fromCommand: true });
        });

        // ** {{{ Event: settings:language }}} **
        // 
        // Given a new language command, change the editor.language
        bespin.subscribe("settings:language", function(event) {
            var language = event.language;
            var fromCommand = event.fromCommand;
            var languageSetting = settings.get('language') || "auto";

            if (language == editor.language) return; // already set to be that language

            if (bespin.util.include(['auto', 'on'], language)) {
                var split = window.location.hash.split('.');
                var type = split[split.length - 1];                
                if (type) editor.language = type;
            } else if (bespin.util.include(['auto', 'on'], languageSetting) || fromCommand) {
                editor.language = language;
            } else if (languageSetting == 'off') {
                editor.language = 'off';
            }
        });

        // ** {{{ Event: settings:set:collaborate }}} **
        // 
        // Turn on the collaboration system if set to be on
        bespin.subscribe("settings:set:collaborate", function(event) {
            editSession.collaborate = settings.isOn(event.value);
        });

        // ** {{{ Event: settings:set:fontsize }}} **
        // 
        // Change the font size for the editor
        bespin.subscribe("settings:set:fontsize", function(event) {
            var fontsize = parseInt(event.value);
            editor.theme.lineNumberFont = fontsize + "pt Monaco, Lucida Console, monospace";
        });

        // ** {{{ Event: settings:set:theme }}} **
        // 
        // Change the Theme object used by the editor
        bespin.subscribe("settings:set:theme", function(event) {
            var theme = event.value;

            if (theme) {
                var themeSettings = bespin.themes[theme];

                if (themeSettings) {
                    if (themeSettings != editor.theme) {
                        editor.theme = themeSettings;
                    }
                } else {
                    bespin.publish("message", {
                        msg: "Sorry old chap. No theme called '" + theme + "'. Fancy making it?"
                    });
                }
            }
        });

        // ** {{{ Event: settings:set:keybindings }}} **
        // 
        // Add in emacs key bindings
        bespin.subscribe("settings:set:keybindings", function(event) {
            var value = event.value;

            if (value == "emacs") {
                bespin.publish("editor:bindkey", {
                    modifiers: "ctrl",
                    key: "b",
                    action: "moveCursorLeft"
                });

                bespin.publish("editor:bindkey", {
                    modifiers: "ctrl",
                    key: "f",
                    action: "moveCursorRight"
                });

                bespin.publish("editor:bindkey", {
                    modifiers: "ctrl",
                    key: "p",
                    action: "moveCursorUp"
                });

                bespin.publish("editor:bindkey", {
                    modifiers: "ctrl",
                    key: "n",
                    action: "moveCursorDown"
                });

                bespin.publish("editor:bindkey", {
                    modifiers: "ctrl",
                    key: "a",
                    action: "moveToLineStart"
                });

                bespin.publish("editor:bindkey", {
                    modifiers: "ctrl",
                    key: "e",
                    action: "moveToLineEnd"
                });
            }
        });

        // ** {{{ Event: settings:set:cursorblink }}} **
        // 
        // The frequency of the cursor blink in milliseconds (defaults to 250)
        bespin.subscribe("settings:set:cursorblink", function(event) {
            var ms = parseInt(event.value); // get the number of milliseconds

            if (ms) {
                editor.ui.toggleCursorFrequency = ms;
            }
        });

        // ** {{{ Event: settings:set:trimonsave }}} **
        // 
        // Run the trim command before saving the file
        var _trimOnSave; // store the subscribe handler away

        bespin.subscribe("settings:set:trimonsave", function(event) {
            if (settings.isOn(event.value)) {
                _trimOnSave = bespin.subscribe("editor:savefile:before", function(event) {
                    bespin.publish("command:execute", { name: "trim" });
                });
            } else {
                bespin.unsubscribe(_trimOnSave);
            }
        });        

        // ** {{{ Event: settings:init }}} **
        // 
        // If we are opening up a new file
        bespin.subscribe("settings:init", function(event) {
            var path    = event.path;
            var project = event.project;

            // TODO: use the action and don't run a command itself
            var newfile = settings.fromURL.get('new');
            if (!newfile) { // scratch file
                if (project && (editSession.project != project)) {
                    bespin.publish("project:set", { project: project });
                }

                if (path) {
                    bespin.publish("editor:openfile", { filename: path });
                }
            }
        });

        // ** {{{ Event: settings:init }}} **
        // 
        // Setup the theme
        bespin.subscribe("settings:init", function(event) {
            bespin.publish("settings:set:theme", {
                value: settings.get('theme')
            });
        });

        // ** {{{ Event: settings:init }}} **
        // 
        // Setup the special keybindings
        bespin.subscribe("settings:init", function(event) {
            bespin.publish("settings:set:keybindings", {
                value: settings.get('keybindings')
            });
        });

        // ** {{{ Event: settings:init }}} **
        // 
        // Check for auto load
        bespin.subscribe("settings:init", function(event) {
            if (!settings.isOff(settings.get('autoconfig'))) {
                bespin.publish("editor:config:run");
            }
        });

        // ** {{{ Event: settings:init }}} **
        // 
        // Setup the font size that the user has configured
        bespin.subscribe("settings:init", function(event) {
            bespin.publish("settings:set:fontsize", {
                value: settings.get('fontsize')
            });
        });        

        // ** {{{ Event: settings:init }}} **
        // 
        // Setup the syntax engine if set
        bespin.subscribe("settings:init", function(event) {
            bespin.publish("settings:set:syntaxengine", {
                value: settings.get('syntaxengine')
            });
        });

        // ** {{{ Event: settings:init }}} **
        // 
        // Set trimonsave
        bespin.subscribe("settings:init", function(event) {
            bespin.publish("settings:set:trimonsave", {
                value: settings.get('trimonsave')
            });
        });
        
        // ** {{{ Event: settings:init }}} **
        // 
        // Set syntaxcheck
        bespin.subscribe("settings:init", function(event) {
            bespin.subscribe("settings:set:syntaxcheck", function (data) {
                if(settings.isOff(data.value)) {
                    bespin.publish("parser:stop")
                } else {
                    bespin.publish("parser:start")
                }
            })
            
            bespin.publish("settings:set:syntaxcheck", {
                value: settings.get('syntaxcheck')
            });
        });

    }
});
