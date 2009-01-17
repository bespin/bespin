/*
 * Event Bus
 */

document.observe("bespin:editor:newfile", function(event) {
    var project = event.memo.project || _editSession.project;
    var newfilename = event.memo.newfilename || "new.txt";

    _files.newFile(project, newfilename, function() {
        document.fire("bespin:editor:openfile:opensuccess", { file: {
            name: newfilename,
            content: " ",
            timestamp: new Date().getTime()
        }});
    });
});

document.observe("bespin:editor:openfile", function(event) {
    var filename = event.memo.filename;

    if (_editSession.path == filename) return; // short circuit

    document.fire("bespin:editor:openfile:openbefore", { filename: filename });

    _files.loadFile(_editSession.project, filename, function(file) {
        if (!file) {
            document.fire("bespin:editor:openfile:openfail", { filename: filename });
        } else {
            document.fire("bespin:editor:openfile:opensuccess", { file: file });
        }
    });
});


document.observe("bespin:editor:savefile", function(event) {
    var filename = event.memo.filename;

    document.fire("bespin:editor:openfile:savebefore", { filename: filename });

    filename = filename || _editSession.path; // default to what you have
    var file = {
        name: filename,
        content: _editor.model.getDocument(),
        timestamp: new Date().getTime()
    };

    if (_editor.undoManager.syncHelper) { // only if ops are on
        file.lastOp = _editor.undoManager.syncHelper.lastOp;
    }

    _files.saveFile(_editSession.project, file); // it will save asynchronously.
    // TODO: Here we need to add in closure to detect errors and thus fire different success / error

    document.fire("bespin:editor:titlechange", { filename: filename });

    document.fire("bespin:cmdline:showinfo", { msg: 'Saved file: ' + file.name });
});


// Shell Events: Header, Chrome, etc

document.observe("bespin:editor:openfile:opensuccess", function(event) {
    var file = event.memo.file;

    $('status').innerHTML = '<span id="project" title="Current project">' + _editSession.project + '</span> <span class="seperator" style="">&rsaquo;</span> <span id="filename" title="Current file">' + file.name + '</span>';

    document.fire("bespin:editor:titlechange", { filename: file.name });

    document.fire("bespin:editor:urlchange", { project: _editSession.project, path: file.name });
});

document.observe("bespin:editor:titlechange", function(event) {
    var title;
    if (event.memo.filename) title = event.memo.filename + ' - editing with Bespin';
    else if (event.memo.title) title = event.memo.title;
    else title = 'Bespin &raquo; Welcome to the Cloud City';

    document.title = title;
});

document.observe("bespin:editor:urlchange", function(event) {
    var project = event.memo.project;
    var path = event.memo.path;

    document.location.hash = "project=" + project + "&path=" + path;
});

document.observe("bespin:cmdline:execute", function(event) {
    var commandname = event.memo.command.name;

    $('message').innerHTML = "last cmd: " + commandname; // set the status message area
});
