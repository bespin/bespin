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

dojo.provide("bespin.editor.filepopup");

dojo.declare("bespin.editor.filepopup.MainPanel", null, {
    constructor: function() {
        // Old global definitions
        this.heightDiff = null;
        this.currentProject = null;
        
        // Old members mixed into this
        this.lastSelectedPath = null;
        this.inited = false;
        this.firstdisplay = true;
    },

    // creates the Thunderhead file browser scene
    checkInit: function() {
        // if we've already executed this method, bail--only need to setup the scene once
        if (this.inited) return;

        // prevent a second execution; see above
        this.inited = true;

        // JS FTW!
        var self = this;

        // Joe's favorite Dojo feature in action, baby!
        this.canvas = dojo.create("canvas", {
            id: "piefilepopupcanvas",
            tabIndex: -1,
            style: {
                position: "absolute",
                zIndex: 400,
                display: "none"
            }
        }, dojo.body());

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

            if (path.length == 0) return;   // bad state, get out

            if (path[path.length - 1].contents) {
                // if we're in a directory, refresh the files in the directory
                this.fetchFiles(path, this.tree);
                return;
            }

            var file = this.getFilePath(path, true);
            console.log("file", file);
            bespin.publish("editor:openfile", { filename:file, project:this.currentProject });

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
        bespin.subscribe("project:created", hitchedRefresh);
        bespin.subscribe("project:deleted", hitchedRefresh);
        bespin.subscribe("project:renamed", hitchedRefresh);
        
        var fileUpdates = dojo.hitch(this, function(e) {
            this.updatePath(e.project, e.path);
        });
        bespin.subscribe("file:saved", fileUpdates);
        bespin.subscribe("file:removed", fileUpdates);
        bespin.subscribe("directory:created", fileUpdates);
        bespin.subscribe("directory:removed", fileUpdates);
        
        dojo.connect(this.canvas, "keydown", dojo.hitch(this, function(e) {
            var key = bespin.util.keys.Key;
            var path = this.tree.getSelectedPath();
            if (path == undefined) {
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
                    if (!listPre) break;
                    listPre.selected.lastSelected = list.selected.name;  // save the selection, if the user comes back to this list
                    list.selected = null;
                    this.tree.repaint();
                    break;
                case key.RIGHT_ARROW:
                    if (!listNext) break;
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
                    bespin.get('piemenu').hide();
                    break;
           }
       }));
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
                        console.log("Selecting " + index);
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
    }
    
});