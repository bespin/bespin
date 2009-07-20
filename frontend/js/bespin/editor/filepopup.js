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

exports.FilePanel = Class.define({
members: {
    init: function() {
        // Old global definitions
        this.heightDiff = null;
        this.currentProject = null;
        
        // Old members mixed into this
        this.lastSelectedPath = null;
        this.firstdisplay = true;
        
        this.nodes = [];
        this.connections = [];
        this.subscriptions = [];

        // JS FTW!
        var self = this;

        // Joe's favorite Dojo feature in action, baby!
        this.canvas = dojo.create("canvas", {
            id: "filepopupcanvas",
            tabIndex: -1,
            style: {
                position: "absolute",
                zIndex: 400,
                display: "none"
            }
        }, dojo.body());
        this.nodes.push("filepopupcanvas");

        // create the Thunderhead scene representing the file browser; will consist of various lists in one column on the left,
        // and a horizontal tree component on the right
        this.scene = new th.Scene(this.canvas);

        // container for the scene
        var topPanel = new th.Panel({id: 'file_browser'});

        this.scene.root.add(topPanel);

        // create a scroll pane for the left column, and a top-level container to put in the scroll pane
        var leftColumnContents = new th.Panel();
        var leftColumnScrollPane = new th.ScrollPane({ splitter: true });
        leftColumnScrollPane.add(leftColumnContents);
        topPanel.add(leftColumnScrollPane);

        // add the project label and project list
        var projectLabel = new th.Label({ id: "projects_label", 
                                          text: "Projects" });
        leftColumnContents.add(projectLabel);
        this.projects = new th.List();
        this.projects.getItemText = function(item) { return item.name; };
        leftColumnContents.add(this.projects);

        // how to layout the two
        leftColumnContents.layout = function() {
            var top = this.children[0];
            var bottom = this.children[1];

            var d = this.d();

            top.setBounds(d.i.l, d.i.t, d.b.iw, top.getPreferredSize().height);
            bottom.setBounds(d.i.l, top.bounds.y + top.bounds.height, d.b.iw, d.b.ih - top.bounds.height);
        };

        // and a preferred size
        leftColumnContents.getPreferredSize = function() {
            var width = 200;    // todo: tie into CSS sizer thingie 
            var height = this.children[0].getPreferredSize().height + this.children[1].getPreferredSize().height;
            return { width: width, height: height };
        };

        // the horizontal tree that will display the contents of a selected project
        this.tree = new th.HorizontalTree({ id: "htree" });

        this.tree.getItemText = this.projects.getItemText;
        
        var fileActions = [];
        var action = {
            name: "Paste to Command Line",
            image: new Image(),
            action: dojo.hitch(this, this._commandlinePasteAction)
        }
        action.image.src = "images/actions/paste.gif";
        fileActions.push(action);
        
        action = {
            name: "Delete",
            image: new Image(),
            action: dojo.hitch(this, this._deleteAction)
        }
        action.image.src = "images/actions/delete.gif";
        fileActions.push(action);
        
        this.fileActionPanel = new th.Panel();
        this.fileActionPanel.addCss("background-color", "rgb(37,34,33)");
        
        var toplabel = new th.Label({text: "File Actions"});
        toplabel.addCss("background-color", "rgb(37,34,33)");
        toplabel.addCss("text-align", "center");
        this.fileActionPanel.layoutManager = new th.FlowLayout(th.VERTICAL);
        this.fileActionPanel.add(toplabel);
        
        this.fileActionPanel.bus.bind("mousemove", this.fileActionPanel, function(e) {
            if (toplabel.text != "File Actions") {
                toplabel.text = "File Actions";
                toplabel.parent.render();
                th.stopEvent(e);
            }
        });
        
        this.fileActionPanel.add(new exports.ActionPanel(toplabel, fileActions, 20, 20, 4));
        this.tree.getDetailPanel = dojo.hitch(this, this.getFileDetailPanel);

        topPanel.add(this.tree);

        // homegrown layout; sorry, that's how I roll
        topPanel.layout = function() {
            var d = this.d();

            var left = this.children[0];
            var right = this.children[1];

            var pref = left.getPreferredSize();

            left.setBounds(d.i.l, d.i.t, pref.width, d.b.ih);
            right.setBounds(left.bounds.x + left.bounds.width, d.i.t, d.b.iw - left.bounds.width, d.b.ih);
        };

        this.scene.render();

        this.scene.bus.bind("dblclick", this.tree, function(e) {
            var path = this.tree.getSelectedPath();
            if (!path) {
                console.error("Got tree.getSelectedPath == null, bailing out");
                return;
            }

            if (path.length === 0) {
                return;   // bad state, get out
            }

            if (path[path.length - 1].contents) {
                // if we're in a directory, refresh the files in the directory
                this.fetchFiles(path, this.tree);
                return;
            }

            var file = this.getFilePath(path, true);
            console.log("file", file, { filename:file, project:this.currentProject });
            bespin.getComponent("commandLine", function(cli) {
                cli.executeCommand("load " + file + " " + this.currentProject);
            }, this);

            var settings = bespin.get("settings");
            if (settings && settings.isSettingOn('keepfilepopuponopen')) {
                // keep the file popup up!
            } else {
                bespin.publish("ui:escape");
            }
        }, this);

        this.scene.bus.bind("itemselected", this.projects, function(e) {
            var item = e.item;
            this.fetchRootFiles(item.name, this.tree);

            this.currentProject = item.name;
        }, this);

        this.refreshProjects();
        
        var hitchedRefresh = dojo.hitch(this, this.refreshProjects);
        this.subscriptions.push(bespin.subscribe("project:created", hitchedRefresh));
        this.subscriptions.push(bespin.subscribe("project:deleted", hitchedRefresh));
        this.subscriptions.push(bespin.subscribe("project:renamed", hitchedRefresh));
        
        var fileUpdates = dojo.hitch(this, function(e) {
            this.updatePath(e.project, e.path);
        });
        this.subscriptions.push(bespin.subscribe("file:saved", fileUpdates));
        this.subscriptions.push(bespin.subscribe("file:removed", fileUpdates));
        this.subscriptions.push(bespin.subscribe("directory:created", fileUpdates));
        this.subscriptions.push(bespin.subscribe("directory:removed", fileUpdates));
        
        this.connections.push(dojo.connect(this.canvas, "keydown", dojo.hitch(this, function(e) {
            var key = bespin.util.keys.Key;
            var path = this.tree.getSelectedPath();
            
            if (path === undefined) {
                var list = this.projects;
                var listNext = this.tree.getList(0);
                var listPre = null;
            } else {
                // things to make life much more easy :)
                var index = path.length - 1;
                var list = this.tree.getList(index);
                var listNext = (this.tree.getListCount() > index ? this.tree.getList(index + 1) : false);
                var listPre = (index != 0 ? this.tree.getList(index - 1) : this.projects);
            }
        
            switch (e.keyCode) {
                case key.LEFT_ARROW:
                    if (!listPre) {
                        break;
                    }
                    listPre.selected.lastSelected = list.selected.name;  // save the selection, if the user comes back to this list
                    list.selected = null;
                    this.tree.repaint();
                    break;
                case key.RIGHT_ARROW:
                    if (!listNext) {
                        break;
                    }
                    if (list.selected.lastSelected) {
                        listNext.selectItemByText(list.selected.lastSelected);
                        listNext.bus.fire("itemselected", { container: listNext, item: list.selected }, listNext);
                    } else {
                        listNext.selected = listNext.items[0];
                        listNext.bus.fire("itemselected", { container: listNext, item: list.selected }, listNext);
                    }
                    break;
                case key.UP_ARROW:
                    list.moveSelectionUp();
                    break;
                case key.DOWN_ARROW:
                    list.moveSelectionDown();
                    break;
                case key.ENTER:
                    this.scene.bus.fire("dblclick", e, this.tree);
                    break;
                case key.ESCAPE:
                    bespin.getComponent("popup", function(popup) {
                        popup.hide();
                    });
                    break;
                case key.J:
                    if (e.ctrlKey || e.metaKey) {
                        bespin.getComponent("commandLine", function(cli) {
                            cli.showPanel("output");
                            cli.focus();
                        });
                    }
                    break;
           }
       })));
    },
    
    destroy: function() {
        dojo.forEach(this.subscriptions, function(sub) {
            bespin.unsubscribe(sub);
        });
        
        dojo.forEach(this.connections, function(conn) {
            dojo.disconnect(conn);
        });
        
        dojo.forEach(this.nodes, function(nodeId) {
            dojo.query("#" + nodeId).orphan();
        });
    },
    
    show: function(coords) {
        this.canvas.width = coords.w;
        this.canvas.height = coords.h;

        dojo.style(this.canvas, {
            display: "block",
            top: coords.t + "px",
            left: coords.l + "px"
        });
        
        this.scene.render();
        this.canvas.focus();

        if (this.firstdisplay) {
            this.firstdisplay = false;
            var session = bespin.get("editSession");
            var project = session.project;
            this.currentProject = project;
            var path = session.path;
            this.restorePath(path);
        }
    },

    hide: function() {
        this.canvas.style.display = "none";
    },

    // TODO: this isnt called in this file
    sizeCanvas: function(canvas) {
        if (!this.heightDiff) {
            this.heightDiff = dojo.byId("header").clientHeight + dojo.byId("subheader").clientHeight + dojo.byId("footer").clientHeight;
        }
        var height = window.innerHeight - this.heightDiff + 11;
        dojo.attr(canvas, { width: window.innerWidth, height: height });
    },

    prepareFilesForTree: function(files) {
        if (files.length == 0) return [];

        var name;
        var fdata = [];
        for (var i = 0; i < files.length; i++) {
            name = files[i].name;
            var settings = bespin.get("settings");
            if (settings && settings.isSettingOff('dotmode') && name[0] == '.') {
                continue;
            }
            if (/\/$/.test(name)) {
                fdata.push({
                    name: name.substring(0, name.length - 1),
                    contents: dojo.hitch(this, this.fetchFiles)
                });
            } else {
                fdata.push({ name: name });
            }
        }

        return fdata;
    },

    getFilePath: function(treePath, noProject) {
        var filepath = (noProject) ? "" : this.currentProject + "/";

        for (var i = 0; i < treePath.length; i++) {
            if (treePath[i] && treePath[i].name) {
                filepath += treePath[i].name + ((i < treePath.length - 1) ? "/" : "");
            }
        }
        return filepath;
    },

    fetchRootFiles: function(project, tree) {
        var self = this;
        bespin.get("server").list(project, null, function(files) {
            tree.setData(self.prepareFilesForTree(files));
            tree.render();
        });
    },

    fetchFiles: function(path, tree) {
        var filepath = this.getFilePath(path);

        var self = this;
        bespin.get("server").list(filepath, null, function(files) {
            tree.updateData(path[path.length - 1], self.prepareFilesForTree(files));
            tree.render();
        });
    },
    
    updatePath: function(project, filepath) {
        var tree = this.tree;
        
        if (filepath.substring(filepath.length-1) == "/") {
            filepath = filepath.substring(0, filepath.length - 1);
        }
        
        var selectedProject = this.projects.selected;
        if (selectedProject) {
            // If the currently selected project is not being displayed
            // we don't need to update. We're only updating what is
            // visible.
            if (selectedProject.name != project) {
                return;
            }
        } else {
            // no project currently being displayed, so there's nothing
            // to update
            return;
        }
        
        var selectedPath = tree.getSelectedPath();
        
        if (selectedPath === undefined) {
            selectedPath = [];
        }
        
        var filepathItems = filepath.split("/");
        var lengthToParent = filepathItems.length - 1;
        
        // we want to see if the *parent* of the file/directory
        // that has changed is visible and, if so, update that.
        for (var i = 0; i < lengthToParent; i++) {
            var fpitem = filepathItems[i];
            
            var item = selectedPath[i];
            
            if (item == undefined || !item.contents) {
                break;
            }
            
            if (item.name != fpitem) {
                return;
            }
        }
        
        var fetchPath = this.getFilePath(selectedPath.slice(0,i));
        
        var self = this;
        
        var listToUpdate = tree.getList(i);
        
        bespin.get("server").list(fetchPath, null, function(files) {
            var contents = self.prepareFilesForTree(files);
            fetchPath[fetchPath.length-1].contents = contents;
            
            if (listToUpdate) {
                listToUpdate.items = contents;
                tree.render();
            } else {
                tree.showChildren(null, contents);
            }
        });
    },

    restorePath: function(newPath) {
        this.lastSelectedPath = this.lastSelectedPath || '';
        newPath = newPath || '';
        var oldPath = this.lastSelectedPath;
        this.lastSelectedPath = newPath;
        
        if (newPath == oldPath && newPath != '') return;     // the path has not changed

        newPath = newPath.split('/');
        oldPath = oldPath.split('/');

        this.scene.renderAllowed = false;
        

        var sameLevel = 0;  // the value is 1 and not 0, as the first list (the project list) is not affected!
        while (sameLevel < Math.min(newPath.length, oldPath.length) && newPath[sameLevel] == oldPath[sameLevel] && newPath[sameLevel] != '') {
            sameLevel ++;
        }
        
        var fakePath = new Array(newPath.length);
        for (var x = 0; x < newPath.length; x++) {
            var fakeItem = new Object();
            fakeItem.name = newPath[x];
            if (x != newPath.length - 1) {
                fakeItem.contents = 'fake';
            }
            if (x > this.tree.scrollPanes.length - 1) {
                this.tree.showChildren(null, new Array(fakeItem));
            }
            if (newPath[x] != '') {
                this.tree.scrollPanes[x].view.selectItemByText(newPath[x]);
            }
            fakePath[x] = fakeItem;
        }
        
        if (newPath.length <= this.tree.scrollPanes.length) {
            this.tree.removeListsFrom(newPath.length);
        }

        var contentsPath = new Array(newPath.length);
        var countSetupPaths = sameLevel;
        
        // deselect lists if needed
        for (var x = newPath.length; x < this.tree.scrollPanes.length; x++) {
            delete this.tree.getList(x).selected;
        }
        
        // get the data for the lists
        for (var x = sameLevel; x < newPath.length; x++) {
            var selected = this.tree.scrollPanes[x].view.selected;
            if (selected && selected.contents && dojo.isArray(selected.contents)) {
                // restore filelist from local memory (the filelists was ones fetched)
                if (x > this.tree.scrollPanes.length - 1) {
                    this.tree.showChildren(null, selected.contents);
                } else {
                    this.tree.replaceList(x, selected.contents);
                }
                this.tree.getList(x).selectItemByText(fakePath[x].name);
                countSetupPaths++;
            } else {
                // load filelist form this.server
                var filepath = this.getFilePath(fakePath.slice(0, x));

                var self = this;
                // Closure creator to capture the value of x in index
                bespin.get("server").list(filepath, null, (function(index) {
                    return function(files) {
                        // "this" is the callbackData object!
                        var contents = self.prepareFilesForTree(files);
                        contentsPath[index] = contents;

                        self.tree.replaceList(index, contents);
                        var list = self.tree.getList(index);
                        list.selectItemByText(fakePath[index].name);
                        countSetupPaths++;

                        if (countSetupPaths == newPath.length) {
                            for (var x = 0; x < newPath.length - 1; x++) {
                                // when the path is not restored from the root,
                                // then there are contents without contents!
                                if (contentsPath[x]) {
                                    var list = self.tree.getList(x);
                                    // todo: I added the if () to fix an error,
                                    // not sure if it was a symptom of something larger
                                    if (list.selected) {
                                        list.selected.contents = contentsPath[x];
                                    }
                                }
                            }
                            self.tree.showDetails();
                        }
                    };
                })(x));
            }
        }
        
        this.scene.renderAllowed = true;
        this.scene.render();
    },

    displayProjects: function(projectItems) {

        for (var i = 0; i < projectItems.length; i++) {
            projectItems[i] = {
                name: projectItems[i].name.substring(0, projectItems[i].name.length - 1),
                contents: dojo.hitch(this, this.fetchFiles)
            };
        }

        this.projects.items = projectItems;
        if (this.currentProject) {
            this.projects.selectItemByText(this.currentProject);
        }
        this.projects.repaint();
    },

    refreshProjects: function() {
        console.log("refreshProjects");

        bespin.get("server").list(null, null, dojo.hitch(this, this.displayProjects));
    },
    
    _deleteAction: function(e) {
        var self = this;
        bespin.getComponent("commandLine", function(cli) {
            var path = self.tree.getSelectedPath();
            var file = self.getFilePath(path, true);
            cli.setCommandText("del " + file);
            cli.focus();
        });
        th.stopEvent(e);
    },
    
    _commandlinePasteAction: function(e) {
        var self = this;
        bespin.getComponent("commandLine", function(cli) {
            var path = self.tree.getSelectedPath();
            var file = self.getFilePath(path, true);
            cli.appendCommandText(" " + file);
        });
        th.stopEvent(e);
    },
        
    getFileDetailPanel: function(item) {
        return this.fileActionPanel;
    }
}});

exports.ActionPanel = Class.define({
type: "ActionPanel",
superclass: th.Panel,
members: {
    init: function(label, actions, width, height, columns, parms) {
        this._super(parms);
        this.label = label;
        this.actions = actions;
        
        for (var i = 0; i < actions.length; i++) {
            var ai = new exports.ActionIcon(actions[i], width, height);
            this.add(ai);
        }
        
        this.width = width;
        this.height = height;
        this.columns = columns;
    },
    
    getPreferredSize: function() {
        var width = this.parent.bounds.w;
        var height = this.height * Math.ceil(this.actions.length / this.columns);
        return {width: width, height: height};
    },
    
    layout: function() {
        var children = this.children;
        var width = this.width;
        var height = this.height;
        var columns = this.columns;
        
        var x = 0;
        var y = 0;
        var col = 0;
        
        for (var current = 0; current < children.length; current++) {
            children[current].setBounds(x, y, width, height);
            col += 1;
            if (col == columns) {
                x = 0;
                y += height;
                col = 0;
            } else {
                x += width;
            }
        }
    }
    
}});

exports.ActionIcon = Class.define({
type: "ActionIcon",
superclass: th.Panel,
members: {
    init: function(action, width, height, parms) {
        this._super(parms);
        this.action = action;
        this.width = width;
        this.height = height;
        this.bus.bind("mousedown", this, this._onmousedown, this);
        this.bus.bind("mousemove", this, this._onmousemove, this);
    },
    
    getPreferredSize: function() {
        return {width: this.width, height: this.height};
    },
    
    paint: function(ctx) {
        this._super(ctx);
        ctx.drawImage(this.action.image, 0, 0);
    },
    
    _onmousedown: function(e) {
        this.action.action(e);
    },
    
    _onmousemove: function(e) {
        var label = this.parent.label;
        if (label.text != this.action.name) {
            label.text = this.action.name;
            label.parent.layout();
            label.parent.repaint();
            th.stopEvent(e);
        }
    }
}});