var heightDiff;
var projects;
var scene;
var tree;
var infoPanel;

function sizeCanvas(canvas) {
    if (!heightDiff) {
        heightDiff = $("header").clientHeight + $("subheader").clientHeight + $("footer").clientHeight;
    }
    var height = window.innerHeight - heightDiff + 11;
    canvas.writeAttribute({ width: window.innerWidth, height: height });
}

Event.observe(window, "resize", function() {
    sizeCanvas($("canvas"));
});

Event.observe(document, "dom:loaded", function() {
    sizeCanvas($("canvas"));

    scene = new Scene($("canvas"));

    tree = new HorizontalTree({ style: { backgroundColor: "rgb(76, 74, 65)",
                                             backgroundColorOdd: "rgb(82, 80, 71)",
                                             font: "9pt Tahoma",
                                             color: "white" }});
    var renderer = new Label({ style: { border: new EmptyBorder({ size: 3 }) } });
    renderer.old_paint = renderer.paint;
    renderer.paint = function(ctx) {
        var d = this.d();

        if (this.selected) {
            ctx.fillStyle = "rgb(177, 112, 20)";
            ctx.fillRect(0, 0, d.b.w, 1);

            var gradient = ctx.createLinearGradient(0, 0, 0, d.b.h);
            gradient.addColorStop(0, "rgb(172, 102, 1)");
            gradient.addColorStop(1, "rgb(219, 129, 1)");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 1, d.b.w, d.b.h - 2);

            ctx.fillStyle = "rgb(160, 95, 1)";
            ctx.fillRect(0, d.b.h - 1, d.b.w, 1);
        }

        if (this.item.contents) {
            renderer.styleContext(ctx);
            var metrics = ctx.measureText(">");
            ctx.fillText(">", d.b.w - metrics.width - 5, d.b.h / 2 + (metrics.ascent / 2) - 1);
        }

        this.old_paint(ctx);
    }
    tree.renderer = renderer;

    projects = new BespinProjectPanel();

    var topPanel = new Panel();
    topPanel.add([ projects, tree ]);
    topPanel.layout = function() {
        var d = this.d();
        projects.bounds = { x: d.i.l, y: d.i.t, width: projects.getPreferredWidth(d.b.h - d.i.h), height: d.b.h - d.i.h };
        tree.bounds = { x: projects.bounds.x + projects.bounds.width, y: d.i.t, width: d.b.w - d.i.w - projects.bounds.width, height: d.b.h - d.i.h };
    }
    projects.list.renderer = renderer;

    infoPanel = new ExpandingInfoPanel({ style: { backgroundColor: "rgb(61, 59, 52)" } });

    var splitPanel = new SplitPanel({ id: "splitPanel", attributes: {
        orientation: GTK.VERTICAL,
        regions: [ { size: "75%", contents: topPanel }, { size: "25%", contents: infoPanel } ]
    } });

    splitPanel.attributes.regions[0].label = new Label({
            id: "foobar",
            text: "Open Sessions",
            style: {
                color: "white",
                font: "9pt Tahoma"
            },
            border: new EmptyBorder({ size: 4 })
    });

    scene.root.add(splitPanel);

    scene.render();

    scene.bus.bind("dblclick", tree, function() {
        var path = tree.getSelectedPath();
        if (path.length == 0) return;
        editFile(currentProject, getFilePath(path));
    });

    scene.bus.bind("itemselected", projects.list, function(e) {
        currentProject = e.item;
        svr.list(e.item, null, displayFiles )
    });
});

function editFile(project, path) {
    location.href = 'editor.html#project=' + project + '&path=' + path;
}

var svr = new Server();
var currentProject;

function loggedIn(xhr) {
    svr.list(null, null, displayProjects);  // get projects
    svr.listOpen(displaySessions);   // get sessions
}

function notLoggedIn(xhr) {
    location.href = "index.html"; // take me home Scottie!
}

function displayFiles(files) {
    tree.setData(prepareFilesForTree(files));
}

function prepareFilesForTree(files) {
    if (files.length == 0) return [];

    var fdata = [];
    for (var i = 0; i < files.length; i++) {
        if (files[i].endsWith("/")) {
            var name = files[i].substring(0, files[i].length - 1);
            var contents = fetchFiles;
            fdata.push({ name: name, contents: contents });
        } else {
            fdata.push({ name: files[i] });
        }
    }

    return fdata;
}

function getFilePath(treePath) {
    var filepath = "";
    for (var i = 0; i < treePath.length; i++) filepath += treePath[i].name + ((i < treePath.length - 1) ? "/" : "");
    return filepath;
}

function fetchFiles(path, tree) {
    var filepath = currentProject + "/" + getFilePath(path);

    svr.list(filepath, null, function(files) {
        tree.updateData(path[path.length - 1], prepareFilesForTree(files));
    });
}

function displaySessions(sessions) {
    infoPanel.removeAll();

    for (var project in sessions) {
        for (var file in sessions[project]) {
            var lastSlash = file.lastIndexOf("/");
            var path = (lastSlash == -1) ? "" : file.substring(0, lastSlash);
            var name = (lastSlash == -1) ? file : file.substring(lastSlash + 1);

            var panel = new BespinSessionPanel({ filename: name, project: project, path: path });
            infoPanel.add(panel);
            panel.bus.bind("dblclick", panel, function(e) {
                editFile(e.thComponent.session.project, e.thComponent.session.path + "/" + e.thComponent.session.filename);
            });
        }
    }
    scene.render();

    setTimeout(function() {
        svr.listOpen(displaySessions);   // get sessions
    }, 3000);
}

function displayProjects(projectItems) {
    for (var i = 0; i < projectItems.length; i++) {
        projectItems[i] = projectItems[i].substring(0, projectItems[i].length - 1);
    }
    projects.list.items = projectItems;
    scene.render();
}

function setupDashboard() {
    // get logged in name; if not logged in, display an error of some kind
    svr.currentuser(loggedIn, notLoggedIn);
}