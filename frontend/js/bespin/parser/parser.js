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
// To get meta data about code subscribe to parser:metainfo and parser:error
dojo.declare("bespin.parser.CodeInfo", null, {
    constructor: function(source) {
        var self       = this;
        this._started  = false;
        
        this.currentMetaInfo;
        
        // ** {{{ Event: parser:error }}} **
        // 
        // Parser found an error in the source code
        bespin.subscribe("parser:error", function(error) {
            bespin.publish("message", { 
                msg: 'Syntax error: ' + error.message + ' on line ' + error.row,
                tag: 'autohide'
            })
        })
        
        // ** {{{ Event: parser:showoutline }}} **
        // 
        // Show a window with a code structure outline of the current document
        bespin.subscribe("parser:showoutline", function() {
            var info = self.currentMetaInfo;
            var html;
            
            var patterns = self.getCodePatterns();
            
            if (info) {
                html = '<u>Outline</u><br/><br/>';
                html +='<div style="overflow:auto; max-height: 400px;" id="outlineInfo">';
                if (info.noEngine) {
                    html += 'No outline available for this document type.';
                } else {
                    dojo.forEach(info.outline, function(ele) {
                        var type = ele.type;
                        var kind = type;
                        var name = ele.name;
                        var pattern = patterns[type];
                        if(pattern) {
                            if("declaration" in pattern) kind = pattern.declaration;
                            if("description" in pattern) kind = pattern.description;
                        }
                        if (typeof name == "undefined") {
                            return
                        }
                        var indent = "";
                        for(var i = 0; i < ele.depth; i++) indent += "&nbsp;";
                        html += indent+kind+': <a href="javascript:bespin.get(\'editor\').cursorManager.moveCursor({ row: '+ele.row+', col: 0 });bespin.publish(\'editor:doaction\', { action: \'moveCursorRowToCenter\' })">'+name+'</a><br/>';
                    });
                }
                html += '</div>';
                bespin.publish("message", { msg: html });
            }
        });
        
        // ** {{{ Event: parser:showoutline }}} **
        // 
        // Show a window with a code structure outline of the current document
        bespin.subscribe("parser:gotofunction", function(event) {
            var functionName = event.functionName;
            var html;

            if (!functionName) {
                bespin.publish("message", { msg: "Please pass me a valid function name." });
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
            bespin.publish("message", { msg: html });
        });
    },
    
    // ** {{{ start }}} **
    //
    // Start collecting meta info
    // will start listening for doc change events and run the parser every time
    start: function() {
        var self = this;
        
        // if we are not supposed to run, don't run
        var settings = bespin.get("settings");
        if(settings.isOff(settings.get("syntaxcheck"))) {
            return
        }
        
        var editor = bespin.get("editor");
        if (!editor.language) {
            // we should not start until the language was set once
            bespin.subscribe("settings:language", function() {
                self.start()
            })
            return;
        }
        
        if (!self._started) {
            self._started = true;
            
            self.fetch();
            
            var timeout;
            
            // rerun parser every time the doc changes
            var rerun = function() {
                
                // only to a fetch at max every N millis
                // so we dont run during active typing
                if(timeout) {
                    clearTimeout(timeout);
                }
                timeout = setTimeout(function() {
                    console.log("Syntax-Check")
                    self.fetch();
                }, 400)
            }
            var onChange =  bespin.subscribe("editor:document:changed", rerun)
            
            // ** {{{ Event: parser:stop }}} **
            // 
            // Stop parsing the document
            bespin.subscribe("parser:stop", function () {
                bespin.unsubscribe(onChange)
                self._started = false;
            })
        }
    },
    
    getCodePatterns: function () {        
        return {
            dojoClass: {
                declaration: "dojo.declare",
                description: "Class"
            },
            bespinEventPublish: {
                declaration: "bespin.publish",
                description: "Publish"
            },
            bespinEventSubscription: {
                declaration: "bespin.subscribe",
                description: "Subscribe to"
            },
            jooseClass: {
                declaration: "Class"
            },
            jooseModule: {
                declaration: "Module"
            },
            jooseType: {
                declaration: "Type"
            },
            jooseRole: {
                declaration: "Role"
            }
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
                
                bespin.parser.AsyncEngineResolver.parse(type, source, "getMetaInfo", self.getCodePatterns()).and(function(data) { 
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
        var parentStack = [];
        var indexStack  = [];
        var top = function () {
            if(this.length == 0) return null
            return this[this.length-1]
        };
        parentStack.top = top;
        indexStack.top  = top;
        this._walk(callback, tree, parentStack, indexStack)
    },
    
    _visitNode: function(callback, node, parentStack, indexStack) {
        callback.call(this, node, parentStack, indexStack)
        
        // we are actually an array of nodes
        if(node.length) {
            this._walk(callback, node, parentStack, indexStack)
        }
        
        // all these properties can be sub trees
        if(node.expression) {
            this._walk(callback, node.expression, parentStack, indexStack)
        }
        if(node.body) {
            this._walk(callback, node.body, parentStack, indexStack)
        }
        if(node.value) {
            this._walk(callback, node.value, parentStack, indexStack)
        }
    },
    
    _walk: function(callback, tree, parentStack, indexStack) {
        if(typeof tree == "string") return
        if(tree.length) {
            parentStack.push(tree)
            for(var i = 0; i < tree.length; ++i) {
                var node = tree[i];
                indexStack.push(i)
                this._visitNode(callback, node, parentStack, indexStack)
                indexStack.pop()
            }
            parentStack.pop()
        } else {
            // we are not an array of nodes, so we are a node
            this._visitNode(callback, tree, parentStack, indexStack)
        }
    },
    
    getMetaInfo: function(tree, codePatterns) {
        var funcs = [];
        var info = [];
        
        // preprocess for speed
        for(var type in codePatterns) {
            var ns = codePatterns[type].declaration.split(".");
            var indicator = ns.pop();
            codePatterns[type]._indicator = indicator;
            codePatterns[type]._ns        = ns;
        }
        
        var FUNCTION = 74; // from narcissus
        var OBJECT_LITERAL_KEY = 56;
        
        this.walk(tree, function(node, parentStack, indexStack) {
            var depth = parentStack.length;
            var tree  = parentStack.top();
            var index = indexStack.top();
            var row   = node.lineno - 1;
            
            // find function
            if(node.type == FUNCTION) {
                var name = node.name;
                if(name == null && tree && index > 0) {
                    // if we have no name. Look up the tree and check for the value
                    // this catches this case: { name: function() {} }
                    var pred = tree[index-1]
                    if(pred.type == OBJECT_LITERAL_KEY) {
                        name = pred.value;
                    }
                }
                var fn = {
                    type:  "function",
                    name:  name,
                    row:   row,
                    depth: depth
                }
                funcs.push(fn)
                info.push(fn)
            } else {
                
                // now it gets complicated
                // we look up the stack to see whether this is a declaration of the form
                // thing.declare("NAME", ...)
                
                var parent = parentStack[parentStack.length-1];
                var parentIndex = indexStack[indexStack.length-1];
                                                   
                var analyze = function (type, ns, indicator) {
                    if(parentIndex >= 0) {
                        if(node.value == indicator) { // identifiy a candidate (aka, we found "declare")
                            // console.log("Found "+indicator)
                            
                            // if the indicator is namespaced, check the ancestors
                            for(var i = 0; i < ns.length; ++i) {
                                var ele = ns[i];
                                // up one level
                                if(parent[parentIndex-1] && parent[parentIndex-1].value == ns) {
                                    parent = parentStack[parentStack.length-(1 + i + 1)];
                                    parentIndex = indexStack[indexStack.length-(1 + i + 1) ];
                                    // console.log("NS "+ns)
                                } else {
                                    return // FAIL
                                }
                            }
                            
                            // candidate is valid
                            if(parent[parentIndex+1] && parent[parentIndex+1][0]) {
                                var name = parent[parentIndex+1][0].value;
                                // console.log(type+": "+name + " - "+depth);
                                
                                info.push({
                                    type:  type,
                                    name:  name,
                                    row:   row,
                                    depth: depth
                                });
                                return true;
                            }
                        }
                    }
                }
                
                // walk through code patterns and check them against the current tree
                for(var type in codePatterns) {
                    var pattern = codePatterns[type];
                    if(analyze(type, pattern._ns, pattern._indicator)) {
                        break // if we find something, it cannot be anything else
                    }
                }
            }
        })
        
        return {
            functions: funcs,
            outline:   info
        }
    },

    parse: function(source, task, codePatterns) {
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
            return this[task](tree, codePatterns);
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
      parse: function(type, source, task, codePatterns) {
          var engine = this.resolve(type);
          if (engine) {
              return engine.parse(source, task, codePatterns);
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
    
    // ** {{{ Event: parser:start }}} **
    // 
    // Start parsing the document
    bespin.subscribe("parser:start", function () {
        bespin.get("parser").start();
    })
})

