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
 
dojo.provide("bespin.client.dashboard");

var heightDiff;
var projects;
var scene;
var tree;
var infoPanel;
var go = bespin.util.navigate; // short cut static method

function sizeCanvas(canvas) {
    if (!heightDiff) {
        heightDiff = dojo.byId("header").clientHeight + dojo.byId("subheader").clientHeight + dojo.byId("footer").clientHeight;
    }
    var height = window.innerHeight - heightDiff + 11;
    dojo.attr(canvas, { width: window.innerWidth, height: height });
}

dojo.connect(window, "resize", function() {
    sizeCanvas(dojo.byId("canvas"));
});

dojo.addOnLoad(function(){
    sizeCanvas(dojo.byId("canvas"));
    
    dojo.forEach(['subheader', 'header'], function(i){ dojo.setSelectable(i, false); })
    
    bespin.displayVersion(); // display the version on the page

    scene = new bespin.th.Scene(dojo.byId("canvas"));  
    
    tree = new bespin.th.components.HorizontalTree({ style: {
        backgroundColor: "rgb(76, 74, 65)",
        backgroundColorOdd: "rgb(82, 80, 71)",
        font: "9pt Tahoma",
        color: "white",
        scrollTopImage: dojo.byId("vscroll_track_top"),
        scrollMiddleImage: dojo.byId("vscroll_track_middle"),
        scrollBottomImage: dojo.byId("vscroll_track_bottom"),
        scrollHandleTopImage: dojo.byId("vscroll_top"),
        scrollHandleMiddleImage: dojo.byId("vscroll_middle"),
        scrollHandleBottomImage: dojo.byId("vscroll_bottom"),
        scrollUpArrow: dojo.byId("vscroll_up_arrow"),
        scrollDownArrow: dojo.byId("vscroll_down_arrow")
    }});

    var renderer = new bespin.th.components.Label({ style: { border: new bespin.th.borders.EmptyBorder({ size: 3 }) } });
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

    projects = new bespin.client.dashboard_components.BespinProjectPanel();

    var topPanel = new bespin.th.components.Panel();
    topPanel.add([ projects, tree ]);
    topPanel.layout = function() {
        var d = this.d();
        projects.bounds = { x: d.i.l, y: d.i.t, width: projects.getPreferredWidth(d.b.h - d.i.h), height: d.b.h - d.i.h };
        tree.bounds = { x: projects.bounds.x + projects.bounds.width, y: d.i.t, width: d.b.w - d.i.w - projects.bounds.width, height: d.b.h - d.i.h };
    }
    projects.list.renderer = renderer;

    infoPanel = new bespin.th.components.ExpandingInfoPanel({ style: { backgroundColor: "rgb(61, 59, 52)" } });

    var splitPanel = new bespin.th.components.SplitPanel({ id: "splitPanel", attributes: {
        orientation: bespin.th.VERTICAL,
        regions: [ { size: "75%", contents: topPanel }, { size: "25%", contents: infoPanel } ]
    } });

    splitPanel.attributes.regions[0].label = new bespin.th.components.Label({
            id: "foobar",
            text: "Open Sessions",
            style: {
                color: "white",
                font: "9pt Tahoma"
            },
            border: new bespin.th.borders.EmptyBorder({ size: 4 })
    });

    scene.root.add(splitPanel);

    scene.render();

    scene.bus.bind("dblclick", tree, function(e) {
        var newTab = e.shiftKey;
        var path = tree.getSelectedPath();
        if (path.length == 0 || path[path.length - 1].contents) return; // don't allow directories either
        go.editor(currentProject, getFilePath(path), newTab);
    });

    scene.bus.bind("itemselected", projects.list, function(e) {
        currentProject = e.item;
        _server.list(e.item, null, displayFiles);
    });

    // setup the command line
    _server      = new bespin.client.Server();
    _settings    = new bespin.client.settings.Core();
    _files       = new bespin.client.FileSystem();
    _commandLine = new bespin.cmd.commandline.Interface(dojo.byId('command'), bespin.cmd.dashboardcommands.Commands);
    
    // Handle jumping to the command line
    dojo.connect(document, "keydown", function(e) {
        var handled = _commandLine.handleCommandLineFocus(e);
        if (handled) return false;
    });

    // get logged in name; if not logged in, display an error of some kind
    _server.currentuser(loggedIn, notLoggedIn);
});

var currentProject;

// After a project is imported or created, do a list
dojo.subscribe("bespin:project:imported", function(event) {
    _server.list(null, null, displayProjects); // get projects
});

dojo.subscribe("bespin:project:set", function(event) {
    _server.list(null, null, displayProjects); // get projects
});

function loggedIn(user) {
    _server.list(null, null, displayProjects); // get projects
    _server.listOpen(displaySessions); // get sessions
}

function notLoggedIn(xhr) {
    go.home();
}

function displayFiles(files) {
    tree.setData(prepareFilesForTree(files));
    tree.render();
}

function prepareFilesForTree(files) {
    if (files.length == 0) return [];

    var fdata = [];
    for (var i = 0; i < files.length; i++) {
		var name = files[i].name;
        if (/\/$/.test(name)) {
            var name = name.substring(0, name.length - 1);
            var contents = fetchFiles;
            fdata.push({ name: name, contents: contents });
        } else {
            fdata.push({ name: name });
        }
    }

    return fdata;
}

function getFilePath(treePath) {
    var filepath = "";

    for (var i = 0; i < treePath.length; i++) {
        if (treePath[i] && treePath[i].name)
            filepath += treePath[i].name + ((i < treePath.length - 1) ? "/" : "");
    }
    return filepath;
}

function fetchFiles(path, tree) {
    var filepath = currentProject + "/" + getFilePath(path);

    _server.list(filepath, null, function(files) {
        tree.updateData(path[path.length - 1], prepareFilesForTree(files));
        tree.render();
    });
}

function displaySessions(sessions) {
    infoPanel.removeAll();

    for (var project in sessions) {
        for (var file in sessions[project]) {
            var lastSlash = file.lastIndexOf("/");
            var path = (lastSlash == -1) ? "" : file.substring(0, lastSlash);
            var name = (lastSlash == -1) ? file : file.substring(lastSlash + 1);

            var panel = new bespin.client.dashboard_components.BespinSessionPanel({ filename: name, project: project, path: path });
            infoPanel.add(panel);
            panel.bus.bind("dblclick", panel, function(e) {
                var newTab = e.shiftKey;
                go.editor(e.thComponent.session.project, e.thComponent.session.path + "/" + e.thComponent.session.filename, newTab);
            });
        }
    }
    infoPanel.render();

// -- Comment this out, and you don't auto refresh.
//    setTimeout(function() {
//        _server.listOpen(displaySessions);   // get sessions
//    }, 3000);
}

function displayProjects(projectItems) {
    for (var i = 0; i < projectItems.length; i++) {
        projectItems[i] = projectItems[i].name.substring(0, projectItems[i].name.length - 1);
    }
    projects.list.items = projectItems;
    scene.render();
}