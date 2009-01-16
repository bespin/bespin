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

	removeFile: function(project, path, callback) {
	    _server.removeFile(project, path, callback);
	},

	whenFileExists: function(project, path, callbacks) {
		_server.list(project, Path.directory(path), function(files) {
			if (files && files.include(path)) {
				callbacks['execute']();
			} else {
				if (callbacks['elseFailed']) callbacks['elseFailed']();
			}
		});
	},

	whenFileDoesNotExist: function(project, path, callbacks) {
		_server.list(project, Path.directory(path), function(files) {
			if (!files || !files.include(path)) {
				callbacks['execute']();
			} else {
				if (callbacks['elseFailed']) callbacks['elseFailed']();
			}
		});
	}

});
