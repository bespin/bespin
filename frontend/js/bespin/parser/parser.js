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
        this._running  = false;

        this.currentMetaInfo;
        this.lineMarkers = [];

        // ** {{{ Event: parser:error }}} **
        //
        // Parser found an error in the source code
        bespin.subscribe("parser:syntaxcheck", function(message) {
            var syntaxcheck = bespin.get("settings") && bespin.get("settings").get("syntaxcheck");
            if ((syntaxcheck === "all" || syntaxcheck === "error") && message.type === "error") {
                bespin.publish("message", {
                    msg: 'Syntax error: ' + message.message + ' on line ' + message.row,
                    tag: 'autohide'
                });
                self.lineMarkers.push(message);
            }
            if ((syntaxcheck === "all" || syntaxcheck === "warning") && message.type === "warning") {
                bespin.publish("message", {
                    msg: 'Syntax warning: ' + message.message + ' on line ' + message.row,
                    tag: 'autohide'
                });
                self.lineMarkers.push(message);
            } 
        });

        // ** {{{ Event: parser:showoutline }}} **
        //
        // Show a window with a code structure outline of the current document
        bespin.subscribe("parser:showoutline", function() {
            var html = self.currentMetaInfo ? 
                self.currentMetaInfo.html   :
                "Outline not yet available";
            bespin.publish("message", { 
                msg: html
            });
        });

        // ** {{{ Event: parser:gotofunction }}} **
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
        
        // ** {{{ Event: parser:engine:parseDone }}} **
        //
        // Fires when the parser engine finished a parsing run
        bespin.subscribe("parser:engine:parseDone", function(event) {
            var data = event.info;
            //console.log("Worker Response "+dojo.toJson(data))
            if (data.messages) for (var i = 0; i < data.messages.length; i++) {
                bespin.publish("parser:syntaxcheck", {
                    message: data.messages[i].message,
                    row: data.messages[i].line,
                    type: data.messages[i].type
                });
            }

            if (data.metaInfo) {
                self.currentMetaInfo = data.metaInfo;
            }
            self._running = false;
        })
    },

    // ** {{{ start }}} **
    //
    // Start collecting meta info
    // will start listening for doc change events and run the parser every time
    start: function() {
        var self = this;
        var editor = bespin.get("editor");

        if (!self._started) {
            self._started = true;
            self.fetch();

            self.run_timeout;
            var delay = 400;

            // rerun parser every time the doc changes
            var rerun = function() {
                // only to a fetch at max every N millis
                // so we dont run during active typing

                if (self.run_timeout) {
                    clearTimeout(self.run_timeout);
                }
                self.run_timeout = setTimeout(function() {
                    if (self._running) {
                        self.run_timeout = setTimeout(arguments.callee, delay)
                    } else {
                        self.fetch();
                    }
                }, delay)
            }
            var onChange = bespin.subscribe("editor:document:changed", rerun);
            bespin.subscribe("settings:set:syntaxcheck", rerun);

            // ** {{{ Event: parser:stop }}} **
            //
            // Stop parsing the document
            bespin.subscribe("parser:stop", function () {
                bespin.unsubscribe(onChange);
                self._started = false;
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
            var settings = bespin.get("settings");
            if (type) {
                var source = editor.model.getDocument();
                self.lineMarkers = [];
                
                self._running = true;
                //console.log("Syntax-Check");
                bespin.publish("parser:engine:parse", {
                    type: type,
                    source: source 
                })
                
            }
        }
    },

    getLineMarkers: function() {
        return this.lineMarkers;
    },
    
    getFunctions: function () {
        if (this.currentMetaInfo) {
            return this.currentMetaInfo.functions
        }
        return []
    }

})

// ** {{{ bespin.parser.JavaScript }}} **
//
// Parses JavaScript
// This implementation uses narcissus by Brandan Eich in the background
// To be executed inside a web worker.
dojo.declare("bespin.parser.JavaScript", null, {
    constructor: function() {
    },
    name: "Narcissus",

    // walk the AST generated by narcissus
    walk: function(tree, callback) {
        var parentStack = [];
        var indexStack  = [];
        var top = function () {
            if (this.length == 0) return null
            return this[this.length-1]
        };
        parentStack.top = top;
        indexStack.top  = top;
        this._walk(callback, tree, parentStack, indexStack)
    },

    _visitNode: function(callback, node, parentStack, indexStack) {
        callback.call(this, node, parentStack, indexStack)

        // we are actually an array of nodes
        if (node.length) {
            this._walk(callback, node, parentStack, indexStack)
        }

        // all these properties can be sub trees
        if (node.expression) {
            this._walk(callback, node.expression, parentStack, indexStack)
        }
        if (node.body) {
            this._walk(callback, node.body, parentStack, indexStack)
        }
        if (node.value) {
            this._walk(callback, node.value, parentStack, indexStack)
        }
    },

    _walk: function(callback, tree, parentStack, indexStack) {
        if (typeof tree == "string") return
        if (tree.length) {
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

    getMetaInfo: function(tree) {
        var funcs = [];
        var info = [];
        var codePatterns = this.getCodePatterns();
        // preprocess for speed
        for(var type in codePatterns) {
            if (codePatterns.hasOwnProperty(type)) {
                //console.log(JSON.stringify(codePatterns[type]))
                try {
                    var ns = codePatterns[type].declaration.split(".");
                    var indicator = ns.pop();
                    codePatterns[type]._indicator = indicator;
                    codePatterns[type]._ns        = ns;
                } catch(e) {
                    console.log("Weird FF3b3 error "+e)
                }
            }
        }

        var FUNCTION = 74; // from narcissus
        var OBJECT_LITERAL_KEY = 56;

        this.walk(tree, function(node, parentStack, indexStack) {
            var depth = parentStack.length;
            var tree  = parentStack.top();
            var index = indexStack.top();
            var row   = node.lineno - 1;

            // find function
            if (node.type == FUNCTION) {
                var name = node.name;
                if (name == null && tree && index > 0) {
                    // if we have no name. Look up the tree and check for the value
                    // this catches this case: { name: function() {} }
                    var pred = tree[index-1]
                    if (pred.type == OBJECT_LITERAL_KEY) {
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
                    if (parentIndex >= 0) {
                        if (node.value == indicator) { // identifiy a candidate (aka, we found "declare")
                            // console.log("Found "+indicator)

                            // if the indicator is namespaced, check the ancestors
                            for(var i = 0; i < ns.length; ++i) {
                                var ele = ns[i];
                                // up one level
                                if (parent[parentIndex-1] && parent[parentIndex-1].value == ns) {
                                    parent = parentStack[parentStack.length-(1 + i + 1)];
                                    parentIndex = indexStack[indexStack.length-(1 + i + 1) ];
                                    // console.log("NS "+ns)
                                } else {
                                    return // FAIL
                                }
                            }

                            // candidate is valid
                            if (parent[parentIndex+1] && parent[parentIndex+1][0]) {
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
                    if (analyze(type, pattern._ns, pattern._indicator)) {
                        break // if we find something, it cannot be anything else
                    }
                }
            }
        })

        var html = '<u>Outline</u><br/><br/>';
        html +='<div id="outlineInfo">';
        for (var i = 0; i < info.length; i++) {
            var type = info[i].type;
            var kind = type;
            var name = info[i].name;
            var pattern = codePatterns[type];
            if (pattern) {
                if ("declaration" in pattern) kind = pattern.declaration;
                if ("description" in pattern) kind = pattern.description;
            }
            if (typeof name == "undefined") {
                continue
            }
            var indent = "";
            for(var j = 0; j < info[i].depth; j++) indent += "&nbsp;";
            html += indent+kind+': <a href="javascript:bespin.get(\'editor\').cursorManager.moveCursor({ row: '+info[i].row+', col: 0 });bespin.publish(\'editor:doaction\', { action: \'moveCursorRowToCenter\' })">'+name+'</a><br/>';
        }
        html += '</div>';

        return {
            functions: funcs,
            outline:   info,
            html: html
        }
    },
    
    codePatterns: {
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
    },

    getCodePatterns: function () {
        return this.codePatterns
    },
    
    initialize: function () {
        var self = this;
        //console.log("SubInit")
        bespin.subscribe("parser:js:codePatterns", function (patterns) {
            for(pattern in patterns) {
                self.codePatterns[pattern] = patterns[pattern]
            }
            bespin.publish("parser:engine:updatedCodePatterns")
        })
    },

    parse: function(source) {
        var tree;
        var messages = [];
        try {
            // parse is global function from narcissus
            tree = parse(source)
        } catch(e) {
            ;// error handling is now done by JSLint
        };

        return {
            messages: messages,
            metaInfo: tree ? this.getMetaInfo(tree) : undefined
        }

    }
});

// ** {{{ bespin.parser.JSLint }}} **
//
// Parses JavaScript
// This implementation uses JSLint by Douglas Crockford in the background
// To be executed inside a web worker.
dojo.declare("bespin.parser.JSLint", null, {
    constructor: function(source) {
    },
    name: "JSLint",
    parse: function(source, type) {
        if (type === "css") {
            //JSLint spots css files using this prefix
            source = '@charset "UTF-8";\n' + source;
        }
        var result = JSLINT(source, {});
        var messages = [];
        var fatal = JSLINT.errors.length > 0 && JSLINT.errors[JSLINT.errors.length - 1] === null;
        for (var i = 0; i < JSLINT.errors.length; i++) {
            if (JSLINT.errors[i]) {
                messages.push({
                    message: JSLINT.errors[i].reason,
                    line: JSLINT.errors[i].line + (type === "css" ? 0 : 1),
                    type: (i === JSLINT.errors.length - 2 && fatal) ? "error" : "warning"
                });
            }
        }
        return {
            result: result,
            messages: messages
        };
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
      // A high level parse function that uses the {{{type}}} to get the engines
      // it returns the combined results of parsing each one
      // parsers overwrite each other if they pass members with the same name, except for messages which are concatenated
      parse: function(type, source) {
          var result = {};
          var engineResult;
          var selectedEngines = this.resolve(type);
          for (var i = 0; i < selectedEngines.length; i++) {
              engineResult = selectedEngines[i].parse(source, type);
              engineResult.messages = engineResult.messages.concat(result.messages || []);
              for (var member in engineResult) {
                  if (engineResult.hasOwnProperty(member)) {
                      if (engineResult[member]) {
                          result[member] = engineResult[member];
                          result.isSet = true;
                      }
                  }
              }
          }
          return result.isSet ? result : {noEngine: true};
      },

      // ** {{{ register }}} **
      //
      // Engines register themselves,
      // e.g. {{{bespin.parser.EngineResolver.register(new bespin.parser.CSSParserEngine(), ['css']);}}}
      register: function(parserEngine, types) {
          for (var i = 0; i < types.length; i++) {
              if (this.engines[types[i]] == null) this.engines[types[i]] = [];
              this.engines[types[i]].push(parserEngine);
          }
      },

      // ** {{{ resolve }}} **
      //
      // Hunt down the engines for the given {{{type}}} (e.g. css, js, html)
      resolve: function(type) {
          return this.engines[type] || [];
      },
      
      initialize: function () {
          var engine = this;
          bespin.subscribe("parser:engine:parse", function (event) {
              var ret = engine.parse(event.type, event.source);
              bespin.publish("parser:engine:parseDone", {
                  type: event.type,
                  info: ret
              })
          })
          
          // forward initialize to engines
          for(var type in this.engines) {
              var list = this.engines[type];
              for(var i = 0; i < list.length; i++) {
                  var eng = list[i];
                  if (!eng._init) { // make sure we only init once (engine can occur multiple times)
                      if (eng.initialize) {
                          eng.initialize()
                      }
                      eng._init = true;
                  }
              }
          }
          
          bespin.publish("parser:engine:initialized", {})
      }
  };
}();

bespin.parser.EngineResolver.register(new bespin.parser.JSLint(), ['js', 'css']);
bespin.parser.EngineResolver.register(new bespin.parser.JavaScript(), ['js']);


// Turn us into a worker-thread
bespin.parser.AsyncEngineResolver = new bespin.worker.WorkerFacade(
    bespin.parser.EngineResolver,
    1, // just one worker please
    // we need these libs. Should probably move to a property of the JS engine
    ["/js/jsparse/jsdefs.js", "/js/jsparse/jsparse.js", "/js/jsparse/fulljslint.js"]);

//** {{{ Event: parser:start }}} **
//
// Start parsing the document
bespin.subscribe("parser:start", function () {
    bespin.get("parser").start();
})

bespin.register("parser", new bespin.parser.CodeInfo());

bespin.fireAfter(["settings:language", "settings:set:syntaxcheck", "parser:engine:initialized"], function () {
    var settings = bespin.get("settings");
    if (settings.isOn(settings.get("syntaxcheck"))) {
        var editor = bespin.get("editor");
        if (!editor.language) { // wait some more, editor needs to catch this first
            bespin.subscribe("settings:language", function () {
                bespin.publish("parser:start")
            })
        } else {
            bespin.publish("parser:start")
        }
    }
})
