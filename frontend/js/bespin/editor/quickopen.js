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

dojo.provide("bespin.editor.quickopen");

dojo.declare("bespin.editor.quickopen.Panel", th.components.Panel, {
    constructor: function(parms) {
        if (!parms) parms = {};

        var imgFileLabel = new Image();
        imgFileLabel.src = '../images/files_pop_top.png';
        this.fileLabel = new th.components.Label({ text: "Find Files", style: { color: "white", font: "8pt Tahoma" } });
        this.fileLabel.oldPaint = this.fileLabel.paint;
        this.fileLabel.paint = function(ctx) {
            var d = this.d();
            ctx.drawImage(imgFileLabel, -8, -7);
            this.oldPaint(ctx);
        };

        this.list = new th.components.List({ allowDeselection: false, style: { backgroundColor: "#D5D0C0", color: "black", font: "8pt Tahoma" } });

        var renderer = new th.components.Label({ style: { border: new th.borders.EmptyBorder({ size: 3 }) } });
        renderer.old_paint = renderer.paint;
        renderer.paint = function(ctx) {
            var d = this.d();

            if (this.selected) {
                ctx.fillStyle = "#DDAC7C";
                ctx.fillRect(0, 0, d.b.w, d.b.h);
            }

            this.old_paint(ctx);
        };
        var list = this.list;
        list.renderer = renderer;
        list.oldGetRenderer = list.getRenderer;
        list.getRenderer = function(rctx) {
            var label = list.oldGetRenderer(rctx);
            label.attributes.text = rctx.item.name;
            return label;
        }
        
        this.scrollbar = new th.components.Scrollbar({ attributes: { orientation: th.HORIZONTAL } });
        this.scrollbar.style.backgroundColor = "#413D35";
        this.scrollbar.loadImages('../images/','dash_vscroll');
        this.scrollbar.scrollable = list;

        this.pathLabel = new th.components.Label({ style: { backgroundColor: "#D5D0C0", color: "black", font: "8pt Tahoma" }, text: "Select item!" });
        this.add([ this.fileLabel, this.list, this.scrollbar, this.pathLabel]);

        // this is a closed container
        delete this.add;
        delete this.remove;
    },

    layout: function() {
        var d = this.d();
        d.i.l += 1;
        d.b.w -= 2;

        var y = d.i.t;
        var lh = this.fileLabel.getPreferredHeight(d.b.w);
        this.fileLabel.bounds = { y: y, x: d.i.l, height: lh, width: d.b.w };
        y = 47;

        lh = this.pathLabel.getPreferredHeight(d.b.w);

        var sw = 14;
        var sh = d.b.h - d.i.b - y - lh;
        var innerWidth = d.b.w - d.i.w - sw;
        
        // this.scrollbar.bounds = { x: d.b.w - d.i.r - sw, height: sh - 2, y: y, width: sw }; 
        // this.list.bounds = { x: d.i.l, y: y, width: innerWidth, height: sh - 2 };
        // this.pathLabel.bounds = { x: d.i.l, y: y + sh, width: innerWidth + sw, height: lh };

        this.list.bounds = { x: d.i.l, y: y, width: innerWidth + sw, height: sh - 2 };
        this.pathLabel.bounds = { x: d.i.l, y: y + sh - 1, width: innerWidth + sw, height: lh };
    },
    
    paintSelf: function(ctx) {
        var y = Math.abs(this.list.bounds.y + this.list.bounds.height + 1);
        
        ctx.fillStyle = "#86857F";
        ctx.fillRect(0, 10, 220, 46);
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = "black";
        ctx.beginPath();              
        ctx.moveTo(0, y);
        ctx.lineTo(220, y);
        ctx.moveTo(0, 47);
        ctx.lineTo(220, 47);
        ctx.closePath();
        ctx.stroke();
        
        ctx.strokeStyle = "#2E1F1A";
        ctx.strokeRect(0, 0, 220, 269);
    }
});

dojo.declare("bespin.editor.quickopen.API", null, {
    constructor: function(container) {        
        this.container = dojo.byId(container);
        this.isVisible = false;
        this.lastText = '';
        this.requestFinished = true;
        this.preformNewRequest = false;
        
        dojo.byId(container).innerHTML += "<canvas id='quickopen_canvas' width='220' height='270' moz-opaque='true' tabindex='-1'></canvas>";        
        this.canvas = dojo.byId('quickopen_canvas');
        this.input = dojo.byId('quickopen_text');
        
        var scene = new th.Scene(this.canvas);  
        this.panel = new bespin.editor.quickopen.Panel();
        this.panel.list.items = [{name: 'test'}];
        scene.root.add(this.panel);        
        this.scene = scene;
        
        // item selected in the list => show full path in label
        scene.bus.bind("itemselected", this.panel.list, dojo.hitch(this, function(e) {
            this.panel.pathLabel.attributes.text = e.item.filename;
            this.layoutAndRender();
        }));
        
        // item double clicked => load this file
        scene.bus.bind("dblclick", this.panel.list, dojo.hitch(this, function(e) {
            var item = this.panel.list.selected;
            if (!item)  return;
            
            bespin.publish("bespin:editor:savefile", {});
            bespin.publish("bespin:editor:openfile", { filename: item.filename });
            
            this.toggle();
        }));
        
        // hides quickopen if the users clicks outside the quickopen.container
        dojo.connect(window, "mousedown", dojo.hitch(this, function(e) {
            if (!this.isVisible) return;

            var d = dojo.coords(this.container);
            if (e.clientX < d.l || e.clientX > (d.l + d.w) || e.clientY < d.t || e.clientY > (d.t + d.h)) {
                this.toggle();
            } else {
                this.input.focus();
                dojo.stopEvent(e);
            }
        }));
        
        // handle ARROW_UP and ARROW_DOWN to select items in the list
        dojo.connect(window, "keydown", dojo.hitch(this, function(e) {
            if (!this.isVisible) return;
            
            var key = bespin.util.keys.Key;
            
            if (e.keyCode == key.ARROW_UP) {
                this.panel.list.moveSelectionUp();
                dojo.stopEvent(e);
            } else if (e.keyCode == key.ARROW_DOWN) {
                this.panel.list.moveSelectionDown();
                dojo.stopEvent(e);
            } else if (e.keyCode == key.ENTER) {
                this.scene.bus.fire("dblclick", {}, this.panel.list);     
            } else if (e.keyCode == 'T'.charCodeAt() && (e.ctrlKey || e.metaKey)) {
                this.toggle();
                dojo.stopEvent(e);
            }
        }));
        
        // look at the seachinput => has it changed?
        dojo.connect(this.input, "keyup", dojo.hitch(this, function() {            
            if (this.lastText != this.input.value) {
                // the text has changed!
                if (this.requestFinished) {
                    this.requestFinished = false;
                    bespin.get('server').searchFiles(bespin.get('editSession').project, this.input.value, this.displayResult);
                } else {
                    this.preformNewRequest = true;
                }
                
                this.lastText = this.input.value;
            }
        }));
        
        // load the current opend files at startup
        bespin.subscribe('bespin:settings:loaded', function() {            
            bespin.get('server').listOpen(bespin.get('quickopen').displaySessions);
        });
    },
    
    toggle: function() {
        var quickopen = bespin.get('quickopen');
        quickopen.isVisible = !quickopen.isVisible;
        
        if (quickopen.isVisible) {
            quickopen.container.style.display = 'block';
            quickopen.container.style.top = Math.round((window.innerHeight - 270) * 0.25) + 'px';
            quickopen.container.style.left = Math.round((window.innerWidth - 220) / 2) + 'px';
            quickopen.input.value = '';
            quickopen.input.focus();
            quickopen.layoutAndRender();
        } else {
            quickopen.container.style.display = 'none';
            quickopen.lastText = '';
            quickopen.input.blur();
        }
    },
    
    layoutAndRender: function() {
        var quickopen = bespin.get('quickopen');
        quickopen.scene.layout();
        quickopen.scene.render();
    },
    
    showFiles: function(files, sortFiles) {
        var items = new Array();
        var quickopen = bespin.get('quickopen'); 
        var file;
        sortFiles = sortFiles || false;
                
        files = files.slice(0, 12);
                
        for (var x = 0; x < files.length; x++) {                
            file = files[x];
            var lastSlash = file.lastIndexOf("/");
            var path = (lastSlash == -1) ? "" : file.substring(0, lastSlash);
            var name = (lastSlash == -1) ? file : file.substring(lastSlash + 1);

            items.push({name: name, filename: file});                
        }
        
        if (sortFiles) {
            items.sort(function(a, b) {
                var x = a.name.toLowerCase();
                var y = b.name.toLowerCase();
                return ((x < y) ? -1 : ((x > y) ? 1 : 0));
            });
        }
        
        quickopen.panel.list.items = items;
        if (items.length != 0) {
            quickopen.panel.list.selectItemByText(items[0].name);
            quickopen.panel.pathLabel.attributes.text = items[0].filename;
        }
        quickopen.layoutAndRender();
    },
    
    displayResult: function(files) {
        var quickopen = bespin.get('quickopen');
        quickopen.showFiles(files);
        
        quickopen.requestFinished = true;
        
        if (quickopen.preformNewRequest) {
            quickopen.requestFinished = false;
            quickopen.preformNewRequest = false;
            console.log('## Search files: ' + quickopen.input.value);
            bespin.get('server').searchFiles(bespin.get('editSession').project, quickopen.input.value, quickopen.displayResult);
        }
    },
    
    displaySessions: function(sessions) {        
        var currentProject = bespin.get('editSession').project;
        var currentFile = bespin.get('editSession').path;
        var items = new Array();

        var files = sessions[currentProject];
        for (var file in files) {
            if (currentFile == file) {
                currentFile = false;
            }
            items.push(file);
        }
        
        if (currentFile) {
            items.push(currentFile);
        }
        
        bespin.get('quickopen').showFiles(items, true);                    
    },
    
    handleKeys: function(e) {
        if (this.isVisible) return true; // in the command line!

        if (e.charCode == 't'.charCodeAt() && (e.ctrlKey || e.metaKey)) { // send to command line
            bespin.get('quickopen').toggle();

            dojo.stopEvent(e);
            return true;
        }
    }
});