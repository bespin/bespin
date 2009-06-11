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
    },

    checkInit: function() {
        if (this.inited) return;
        this.inited = true;

        var self = this;

        this.canvas = dojo.create("canvas", {
            id: "piefilepopupcanvas",
            tabIndex: -1,
            style: {
                position: "absolute",
                zIndex: 400,
                display: "none"
            }
        }, dojo.body());

        this.scene = new th.Scene(this.canvas);
        this.scene.root.addCss("background-color", "blue");

        // make the root transparent
        // this.scene.root.paintSelf = function() {}

        this.tree = new th.HorizontalTree({ id: "htree" });

        // invoking showChildren() here causes the List containing the children to be created, which is necessary
        // for us to manipulate it a touch here
        this.tree.showChildren(null, [{name: ''}]);

        // set various properties of this first list, which contains the projects to display
        this.tree.lists[0].addTopLabel(new th.Label({ text: "Projects" }));
        this.tree.lists[0].allowDeselection = false;

        var topPanel = new th.Panel();
        topPanel.add([ this.tree ]);
        topPanel.layout = function() {
            var d = this.d();
            self.tree.bounds = { x: d.i.l, y: d.i.t, width: d.b.w - d.i.w, height: d.b.h - d.i.h };
        };

        this.scene.root.add(topPanel);

        this.scene.render();

        this.scene.bus.bind("dblclick", this.tree, function(e) {
            var newTab = e.shiftKey;
            var path = this.tree.getSelectedPath();
            if (!path) {
                console.error("Got tree.getSelectedPath == null, bailing out");
                return;
            }
            if (path.length == 0 || path[path.length - 1].contents) {
                return; // don't allow directories either
            }
            var file = this.getFilePath(path.slice(1, path.length));
            bespin.publish("editor:openfile", { filename:file, project:this.currentProject });
        }, this);

        this.scene.bus.bind("itemselected", this.tree, function(e) {
            var pathSelected = this.tree.getSelectedPath(true);
            // this keeps the url to be changed if the file path changes to frequently
            if (this.urlTimeout) {
                clearTimeout(this.urlTimeout);
            }

            // TODO: This makes urlbar try (and fail) to load a file. Sure that's not right
            /*
            this.urlTimeout = setTimeout(function () {
                this.lastSelectedPath = pathSelected;
                location.hash = '#path=' + pathSelected;
            }, 300);
            */
        }, this);

        this.scene.bus.bind("itemselected", this.tree.lists[0], function(e) {
            this.currentProject = e.item.name;
            bespin.publish("project:set", {
                project: this.currentProject,
                suppressPopup: true,
                fromDashboardItemSelected: true
            });
        }, this);

        // get logged in name; if not logged in, display an error of some kind
        bespin.get("server").list(null, null, dojo.hitch(this, this.displayProjects));

        // provide history for the dashboard
        bespin.subscribe("url:changed", function(e) {
            var pathSelected =  (new bespin.client.settings.URL()).get('path');
            // TODO throw new TooManyAliasesForThisException();
            //bespin.page.dashboard.restorePath(pathSelected);
            self.restorePath(pathSelected);
        });

        // TODO: commenting this out as it is throwing errors at the moment
        // provide arrow navigation to dashboard
        dojo.connect(window, "keydown", dojo.hitch(this, function(e) {
            var key = bespin.util.keys.Key;
            var path = this.tree.getSelectedPath();
            if (path === undefined) return;
            // things to make life much more easy :)
            var index = path.length - 1;
            var list = this.tree.lists[index];
            var listNext = (this.tree.lists.length > index ? this.tree.lists[index + 1] : false);
            var listPre = (index != 0 ? this.tree.lists[index - 1] : false);

            switch (e.keyCode) {
                case key.LEFT_ARROW:
                    if (!listPre) break;
                    // listPre.selected.lastSelected = list.selected.name;  // save the selection, if the user comes back to this list
                    listPre.bus.fire("itemselected", { container: listPre, item: list.selected }, listPre);
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
                    this.bus.fire("dblclick", e, this.tree);
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

    getFilePath: function(treePath) {
        var filepath = "";

        for (var i = 0; i < treePath.length; i++) {
            if (treePath[i] && treePath[i].name) {
                filepath += treePath[i].name + ((i < treePath.length - 1) ? "/" : "");
            }
        }
        return filepath;
    },

    fetchFiles: function(path, tree) {
        var filepath = this.getFilePath(path);

        var self = this;
        bespin.get("server").list(filepath, null, function(files) {
            tree.updateData(path[path.length - 1], self.prepareFilesForTree(files));
            tree.render();
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
        this.currentProject = newPath[0];

        this.tree.lists[0].selectItemByText(newPath[0]);    // this also perform a rendering of the project.list
        this.scene.renderAllowed = false;

        var sameLevel = 1;  // the value is 1 and not 0, as the first list (the project list) is not affected!
        while (sameLevel < Math.min(newPath.length, oldPath.length) && newPath[sameLevel] == oldPath[sameLevel] && newPath[sameLevel] != '') {
            sameLevel ++;
        }

        var fakePath = new Array(newPath.length);
        for (var x = 1; x < newPath.length; x++) {
            var fakeItem = new Object();
            fakeItem.name = newPath[x];
            if (x != newPath.length - 1) {
                fakeItem.contents = 'fake';
            }
            if (x > this.tree.lists.length - 1) {
                this.tree.showChildren(null, new Array(fakeItem));
            }
            if (newPath[x] != '') {
                this.tree.lists[x].selectItemByText(newPath[x]);
            }
            fakePath[x] = fakeItem;
        }

        if (newPath.length <= this.tree.lists.length) {
            this.tree.removeListsFrom(newPath.length);
        }

        var contentsPath = new Array(newPath.length);
        var countSetupPaths = sameLevel;

        // get the data for the lists
        for (var x = sameLevel; x < newPath.length; x++) {
            var selected = this.tree.lists[x - 1].selected;
            if (selected && selected.contents && dojo.isArray(selected.contents)) {
                // restore filelist from local memory (the filelists was ones fetched)
                if (x > this.tree.lists.length - 1) {
                    this.tree.showChildren(null, selected.contents);
                } else {
                    this.tree.replaceList(x, selected.contents);
                }
                this.tree.lists[x].selectItemByText(fakePath[x].name);
                countSetupPaths++;
            } else {
                // load filelist form this.server
                var filepath = this.currentProject + "/" + this.getFilePath(fakePath.slice(1, x));

                var self = this;
                // Closure creator to capture the value of x in index
                bespin.get("server").list(filepath, null, (function(index) {
                    return function(files) {
                        // "this" is the callbackData object!
                        var contents = self.prepareFilesForTree(files);
                        if (index != 0) {
                            contentsPath[index] = contents;
                        }

                        self.tree.replaceList(index, contents);
                        self.tree.lists[index].selectItemByText(fakePath[index].name);
                        countSetupPaths++;

                        if (countSetupPaths == newPath.length) {
                            for (var x = 0; x < newPath.length - 1; x++) {
                                // when the path is not restored from the root,
                                // then there are contents without contents!
                                if (contentsPath[x + 1]) {
                                    // todo: I added the if () to fix an error,
                                    // not sure if it was a symptom of something larger
                                    if (self.tree.lists[x].selected) {
                                        self.tree.lists[x].selected.contents = contentsPath[x + 1];
                                    }
                                }
                            }
                        }
                    };
                })(x));
            }
        }

        // deselect lists if needed
        for (var x = newPath.length; x < this.tree.lists.length; x++) {
            delete this.tree.lists[x].selected;
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

        this.tree.replaceList(0, projectItems);

        // Restore the last selected file
        var path =  (new bespin.client.settings.URL()).get('path');
        if (!this.lastSelectedPath) {
            this.restorePath(path);
        } else {
            this.scene.render();
        }
    },

    refreshProjects: function() {
        bespin.get("server").list(null, null, dojo.hitch(this, this.displayProjects));
    }
});


th.BespinProjectPanel = Class.define({
    type: "BespinProjectPanel",

    superclass: th.Panel,

    member: {
        init: function(parms) {
            if (!parms) parms = {};
            this['super'](parms);

            this.projectLabel = new th.Label({ text: "Projects", className: "projectLabel" });

            this.list = new th.List();

            this.splitter = new th.Splitter({ orientation: th.HORIZONTAL });

            this.footer = new th.BespinProjectPanelFooter();

            this.add([ this.projectLabel, this.list, this.splitter, this.footer ]);

            this.bus.bind("dragstart", this.splitter, this.ondragstart, this);
            this.bus.bind("drag", this.splitter, this.ondrag, this);
            this.bus.bind("dragstop", this.splitter, this.ondragstop, this);

            // this is a closed container
            delete this.add;
            delete this.remove;
        },

        ondragstart: function(e) {
            this.startWidth = this.bounds.width;
        },

        ondrag: function(e) {
            var delta = e.currentPos.x - e.startPos.x;
            this.prefWidth = this.startWidth + delta;
            this.getScene().render();
        },

        ondragstop: function(e) {
            delete this.startWidth;
        },

        getPreferredSize: function() {
            return { width: this.prefWidth || 150, height: 0 };
        },

        layout: function() {
            var d = this.d();

            var y = d.i.t;

            // todo: when I have a better way to do uni-dimensional preferred sizing, restore this
            //var lh = this.projectLabel.getPreferredHeight(d.b.w);
            var lh = this.projectLabel.getPreferredSize().height;

            this.projectLabel.bounds = { y: y, x: d.i.l, height: lh, width: d.b.w };
            y += lh;

            var sw = this.splitter.getPreferredSize().width;
            this.splitter.bounds = { x: d.b.w - d.i.r - sw, height: d.b.h - d.i.b - y, y: y, width: sw };

            var innerWidth = d.b.w - d.i.w - sw;

            // todo: when I have a better way to do uni-dimensional preferred sizing, restore this
//            var ph = this.footer.getPreferredHeight(innerWidth);
            var ph = this.footer.getPreferredSize().height;

            this.footer.bounds = { x: d.i.l, y: d.b.h - ph, width: innerWidth, height: ph };

            this.list.bounds = { x: d.i.l, y: y, width: innerWidth, height: this.splitter.bounds.height };
        }
    }
});

