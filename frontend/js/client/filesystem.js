//  ***** BEGIN LICENSE BLOCK *****
// Version: MPL 1.1
// 
// The contents of this file are subject to the Mozilla Public License  
// Version
// 1.1 (the "License"); you may not use this file except in compliance  
// with
// the License. You may obtain a copy of the License at
// http://www.mozilla.org/MPL/
// 
// Software distributed under the License is distributed on an "AS IS"  
// basis,
// WITHOUT WARRANTY OF ANY KIND, either express or implied. See the  
// License
// for the specific language governing rights and limitations under the
// License.
// 
// The Original Code is Bespin.
// 
// The Initial Developer of the Original Code is Mozilla.
// Portions created by the Initial Developer are Copyright (C) 2009
// the Initial Developer. All Rights Reserved.
// 
// Contributor(s):
// 
// ***** END LICENSE BLOCK *****
// 

/*
 * Remote Web Service File System
 */
var FileSystem = Class.create({

    newFile: function(project, path, callback) {
        this.whenFileDoesNotExist(project, path, {
            execute: function() {
                _editSession.startSession(project, path || "new.txt");
                callback();
            },
            elseFailed: function() {
                document.fire("bespin:cmdline:showinfo", { msg: 'The file ' + path + ' already exists my friend.'});
            }
        });
    },

    loadFile: function(project, path, callback) {
        _editSession.startSession(project, path);

        _server.loadFile(project, path, function(content) {
            if (content.endsWith("\n")) content = content.substr(0, content.length - 1);

            callback({
                name: path,
                content: content,
                timestamp: new Date().getTime()
            });
        });
    },

    projects: function(callback) {
        _server.projects(callback);
    },

    fileNames: function(project, callback) {
        _server.list(project, '', callback);
    },

    saveFile: function(project, file) {
        // Unix files should always have a trailing new-line; add if not present
        if (!file.content.endsWith("\n")) file.content += "\n";

        _server.saveFile(project, file.name, file.content, file.lastOp);
    },

    removeFile: function(project, path, onSuccess, onFailure) {
        _server.removeFile(project, path, onSuccess, onFailure);
    },
    
    closeFile: function(project, path, callback) {
        _server.closeFile(project, path, callback);
    },

    whenFileExists: function(project, path, callbacks) {
        _server.list(project, Bespin.Path.directory(path), function(files) {
            if (files && files.include(path)) {
                callbacks['execute']();
            } else {
                if (callbacks['elseFailed']) callbacks['elseFailed']();
            }
        });
    },

    whenFileDoesNotExist: function(project, path, callbacks) {
        _server.list(project, Bespin.Path.directory(path), function(files) {
            if (!files || !files.include(path)) {
                callbacks['execute']();
            } else {
                if (callbacks['elseFailed']) callbacks['elseFailed']();
            }
        });
    }

});
