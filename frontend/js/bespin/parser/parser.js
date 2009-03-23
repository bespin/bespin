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

// = Source Parser =
//
// Module for dealing parsing and getting meta info about source.
//
// The core model talks to specific engines to do the work and then packages it up to send to the editor.
// Works similar to syntax highlighting engine

dojo.provide("bespin.parser.parser");

//** {{{ bespin.parser.CodeInfo }}} **
//
// Saves Info about current source code 
//
// To get meta data about code subscribe to bespin:parser:metainfo and bespin:parser:error
dojo.declare("bespin.parser.CodeInfo", null, {
    constructor: function(source) {
        var self       = this;
        this._started  = false;
        
        this.currentMetaInfo;
        
        // ** {{{ Event: bespin:parser:error }}} **
        // 
        // Parser found an error in the source code
        bespin.subscribe("parser:error", function(error) {
            bespin.publish("cmdline:showinfo", { 
                msg: 'Syntax error: ' + error.message + ' on line ' + error.row,
                autohide: true
            })
        })
        
        // ** {{{ Event: bespin:parser:showoutline }}} **
        // 
        // Show a window with a code structure outline of the current document
        bespin.subscribe("parser:showoutline", function() {
            var info = self.currentMetaInfo;
            var html;
            
            if (info) {
                html = '<u>Outline</u><br/><br/>';
                html +='<div style="overflow:auto; max-height: 400px;" id="outlineInfo">';
                if (info.noEngine) {
                    html += 'No outline available for this document type.';
                } else {
                    dojo.forEach(info.functions, function(func) { 
                        var name = func.name;
                        if (typeof name == "undefined") {
                            name = "anonymous";
                        }
                        html += '<a href="javascript:bespin.get(\'editor\').cursorManager.moveCursor({ row: '+func.row+', col: 0 });bespin.publish(\'bespin:editor:doaction\', { action: \'moveCursorRowToCenter\' })">Function: '+name+'</a><br/>';
                    });
                }
                html += '</div>';
                bespin.publish("cmdline:showinfo", { 
                    msg: html
                });
            }
        });
        
        // ** {{{ Event: bespin:parser:showoutline }}} **
        // 
        // Show a window with a code structure outline of the current document
        bespin.subscribe("parser:gotofunction", function(event) {
            var functionName = event.functionName;
            var html;

            if (!functionName) {
                bespin.publish("cmdline:showinfo", { msg: "Please pass me a valid function name." });
                return;
            }

            var info = self.currentMetaInfo;
            if (info) {
                if (info.noEngine) {
                    html = "Unable to find a function in this file type.";
                } else {
                    var matches = dojo.filter(info.functions, function(func) {
                        return func.name == functionName
                    });
                    if (matches.length > 0) {
                        var match = matches[0];
                        
                        bespin.publish("editor:moveandcenter", {
                            row: match.row
                        });
                    } else {
                        html = "Unable to find the function " + functionName + " in this file.";
                    }
                }
            }
            bespin.publish("cmdline:showinfo", { msg: html });
        });
    },
    
    // ** {{{ start }}} **
    //
    // Start collecting meta info
    // will start listening for doc change events and run the parser every time
    start: function() {
        var self = this;
        
        var editor = bespin.get("editor");
        if (!editor.language) {
            // we should not start until the language was set once
            bespin.subscribe("settings:syntax", function() {
                self.start()
            })
            return;
        }
        
        if (!self._started) {
            self._started = true;
            
            self.fetch();
            
            var timeout;
            
            // rerun parser every time the doc changes
            bespin.subscribe("editor:document:changed", function() {
                
                // only to a fetch at max every N millis
                // so we dont run during active typing
                if(timeout) {
                    clearTimeout(timeout);
                }
                timeout = setTimeout(function() {
                    self.fetch();
                }, 400)
            })
        }
    },
    
    // ** {{{ fetch }}} **
    //
    // Ask the parser for meta info (once)
    fetch: function() {
        var self = this;
        
        // parsing is too slow to run in the UI thread
        if (bespin.parser.AsyncEngineResolver.__hasWorkers__) {
            
            var editor = bespin.get("editor");
            var type   = editor.language;
            
            if (type) { 
                var source = editor.model.getDocument();
                
                bespin.parser.AsyncEngineResolver.parse(type, source, "getMetaInfo").and(function(data) { 
                    if (data.isError) {
                        // publish custom event if we found an error
                        // error constains row (lineNumber) and message
                        bespin.publish("parser:error", data)
                    } else {
                        // publish custome event for new meta info
                        bespin.publish("parser:metainfo", data)
                        self.currentMetaInfo = data;
                    }
                })
            }
        }
    }
})

// ** {{{ bespin.parser.JavaScript }}} **
//
// Parses JavaScript
// This implementation uses narcissus by Brandan Eich in the background
// To be executed inside a web worker.
dojo.declare("bespin.parser.JavaScript", null, {
    constructor: function(source) {
    },
    
    // walk the AST generated by narcissus
    walk: function(tree, callback) {
        this._walk(callback, tree, null, null)
    },
    
    _visitNode: function(callback, tree, node, parent, index) {
        callback.call(this, node, tree, index)
        
        // we are actually an array of nodes
        if(node.length) {
            this._walk(callback, node, tree, i)
        }
        
        // all these properties can be sub trees
        if(node.expression) {
            this._walk(callback, node.expression, tree, i)
        }
        if(node.body) {
            this._walk(callback, node.body, tree, i)
        }
        if(node.value) {
            this._walk(callback, node.value, tree, i)
        }
    },
    
    _walk: function(callback, tree, parent, index) {
        if(typeof tree == "string") return
        if(tree.length) {
            for(var i = 0; i < tree.length; ++i) {
                var node = tree[i];
            
                this._visitNode(callback, tree, node, parent, i)
            }
        } else {
            // we are not an array of nodes, so we are a node
            this._visitNode(callback, tree, tree, parent, 0)
        }
    },
    
    getMetaInfo: function(tree) {
        var funcs = [];
        this.walk(tree, function(node, parent, index) {
            if(node.type == 74) { // 74 is the magic number for functions
                var name = node.name;
                if(name == null && parent && index > 0) {
                    // if we have no name. Look up the tree and check for the value
                    // this catches this case: { name: function() {} }
                    var pred = parent[index-1]
                    name = pred.value;
                }
                funcs.push({
                    name: name,
                    row: node.lineno - 1,
                })
            }
        })
        
        return {
            functions: funcs
        }
    },

    parse: function(source, task) {
        var tree;
        try {
            // parse is global function from narcissus
            tree = parse(source)
        } catch(e) {
            // catch syntax error and return it
            // TODO: Check whether this is really a syntax error
            return {
                row:     e.lineNumber || e.line,
                message: e.message,
                isError: true
            }
        }
        
        if(task) { // if we have a task, execute that instead
            return this[task](tree);
        }
        
        return tree;
    }
});

// ** {{{ bespin.parser.EngineResolver }}} **
//
// The resolver holds the engines that are available to do the actual parsing
bespin.parser.EngineResolver = function() {

  return {
      
      engines: {},
      
      // ** {{{ parse }}} **
      //
      // A high level parse function that uses the {{{type}}} to get the engine, and asks it to parse
      parse: function(type, source, task) {
          var engine = this.resolve(type);
          if (engine) {
              return engine.parse(source, task);
          } else {
              return {
                  noEngine: true
              }
          }
      },

      // ** {{{ register }}} **
      //
      // Engines register themselves,
      // e.g. {{{bespin.parser.EngineResolver.register(new bespin.parser.CSSParserEngine(), ['css']);}}}
      register: function(parserEngine, types) {
          for (var i = 0; i < types.length; i++) {
              this.engines[types[i]] = parserEngine;
          }
      },

      // ** {{{ resolve }}} **
      //
      // Hunt down the engine for the given {{{type}}} (e.g. css, js, html)
      resolve: function(type) {
          return this.engines[type];
      }
  };
}();

bespin.parser.EngineResolver.register(new bespin.parser.JavaScript(), ['js', "javascript", "ecmascript"]);

// Turn us into a worker-thread
bespin.parser.AsyncEngineResolver = new bespin.worker.WorkerFacade(
    bespin.parser.EngineResolver,
    1, // just one worker please
    // we need these libs. Should probably move to a property of the JS engine
    ["/js/jsparse/jsdefs.js", "/js/jsparse/jsparse.js"]);

// As soon as a doc is opened we are a go
bespin.subscribe("editor:openfile:opensuccess", function() {
    bespin.register("parser", new bespin.parser.CodeInfo())
    bespin.get("parser").start()
})