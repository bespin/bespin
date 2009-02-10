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

// = Syntax Highlighting =
//
// Module for dealing with the syntax highlighting.

if (typeof Bespin == "undefined") Bespin = {};
if (!Bespin.Syntax) Bespin.Syntax = {};


// ** {{{ Bespin.Syntax.Model }}} **
//
// Tracks syntax highlighting data on a per-line basis.

Bespin.Syntax.Model = Class.create({
    initialize: function(editor) {
        this.editor = editor;
        this.lineCache = [];
        this.multiLineComment = [];
        this.syntaxType = "";
    },
    
    // -- Multiline comment
    flagMultiLineComment: function(lineNumber, bool) {
        this.multiLineComment[lineNumber] = bool;
    },
    
    inMultiLineComment: function(lineNumber) {
        return this.multiLineComment[lineNumber];
    },
    
    // -- Caching
    invalidateCache: function(lineNumber) {
        delete this.lineCache[lineNumber];
    },

    invalidateEntireCache: function() {
        this.lineCache = [];
    },
    
    addToCache: function(lineNumber, line) {
        this.lineCache[lineNumber] = line;
    },
    
    getFromCache: function(lineNumber) {
        return this.lineCache[lineNumber];
    },
    
    mergeSyntaxResults: function(regions) {
        var base = 0;
        for (var i = 0; i < regions.length; i++) {
            var region = region[i];
            //base += region.
        }
    },

    // -- Main API
    getSyntaxStyles: function(lineNumber, syntaxType) {
        if (this.syntaxType != syntaxType) {
            this.invalidateEntireCache();
            this.engine = Bespin.Syntax.EngineResolver.resolve(syntaxType);
            this.syntaxType = syntaxType;
        } else { // Possible for caching to be real here
            // var cached = this.getFromCache(lineNumber);
            // if (cached) return cached;            
        }

        var line = this.editor.model.getRowArray(lineNumber).join("");

        var syntaxResult = { // setup the result
            text: line,
            regions: []
        };
        
        // we have the ability to have subtypes within the main parser
        // E.g. HTML can have JavaScript or CSS within
        if (typeof this.engine['innertypes'] == "function") {
            var syntaxTypes = this.engine.innertypes(line);

            for (var i = 0; i < syntaxTypes.length; i++) {
                var type = syntaxTypes[i];
                var meta = { inMultiLineComment: this.inMultiLineComment(), offset: type.start }; // pass in an offset
                var pieceRegions = [];
                var fromResolver = Bespin.Syntax.EngineResolver.highlight(type.type, line.substring(type.start, type.stop), meta);
                if (fromResolver['inMultiLineComment'] && (i == syntaxTypes.length - 1) ){
                    this.inMultiLineComment[lineNumber] = true;
                }
                pieceRegions.push(fromResolver);
            }
            syntaxResult.regions.push(this.mergeSyntaxResults(pieceRegions));
        } else {
            syntaxResult.regions.push(this.engine.highlight(line, { inMultiLineComment: this.inMultiLineComment() }));
        }
        
        this.addToCache(lineNumber, syntaxResult);
        return syntaxResult;
    }
});

Bespin.Syntax.EngineResolver = new function() {
  var engines = {};
  var NoopSyntaxEngine = {
      highlight: function(line, meta) {
          return [ 
                    {
                        white: [ {
                            start: 0,
                            stop: line.length
                        } ]
                    }
                 ]
      }
//      innersyntax: function() {},
  }
  
  return {
      highlight: function(type, line, meta) {
          this.resolve(type).highlight(line, meta);
      },
      
      register: function(syntaxEngine, types) {
          for (var i = 0; i < types.length; i++) {
              engines[types[i]] = syntaxEngine;
          }
      },

      resolve: function(type) {
          return engines[type] || NoopSyntaxEngine;
      }      
  }  
}();

Bespin.Syntax.EngineResolver.register(new Bespin.Syntax.JavaScriptSyntaxEngine(), ['js', 'javascript', 'ecmascript']);
// Bespin.Syntax.EngineResolver.register(new Bespin.Syntax.CSSSyntaxEngine(), ['css']);
// Bespin.Syntax.EngineResolver.register(new Bespin.Syntax.HTMLSyntaxEngine(), ['html', 'xml']);
