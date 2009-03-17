var __GLOBAL__ = this;
onmessage = function (event) {
    var source = event.data;
    if(source.indexOf("// YOUcannotGuessMe") == 0) {
        __GLOBAL__.eval(source)
    } else {
        postMessage("Ignoring message: "+source)
    }
}


//Downloaded unchanged from http://www.json.org/json2.js

/*
    json2.js
    2008-02-14

    Public Domain

    No warranty expressed or implied. Use at your own risk.

    See http://www.JSON.org/js.html

    This file creates a global JSON object containing two methods:

        JSON.stringify(value, whitelist)
            value       any JavaScript value, usually an object or array.

            whitelist   an optional array parameter that determines how object
                        values are stringified.

            This method produces a JSON text from a JavaScript value.
            There are three possible ways to stringify an object, depending
            on the optional whitelist parameter.

            If an object has a toJSON method, then the toJSON() method will be
            called. The value returned from the toJSON method will be
            stringified.

            Otherwise, if the optional whitelist parameter is an array, then
            the elements of the array will be used to select members of the
            object for stringification.

            Otherwise, if there is no whitelist parameter, then all of the
            members of the object will be stringified.

            Values that do not have JSON representaions, such as undefined or
            functions, will not be serialized. Such values in objects will be
            dropped; in arrays will be replaced with null.
            JSON.stringify(undefined) returns undefined. Dates will be
            stringified as quoted ISO dates.

            Example:

            var text = JSON.stringify(['e', {pluribus: 'unum'}]);
            // text is '["e",{"pluribus":"unum"}]'

        JSON.parse(text, filter)
            This method parses a JSON text to produce an object or
            array. It can throw a SyntaxError exception.

            The optional filter parameter is a function that can filter and
            transform the results. It receives each of the keys and values, and
            its return value is used instead of the original value. If it
            returns what it received, then structure is not modified. If it
            returns undefined then the member is deleted.

            Example:

            // Parse the text. If a key contains the string 'date' then
            // convert the value to a date.

            myData = JSON.parse(text, function (key, value) {
                return key.indexOf('date') >= 0 ? new Date(value) : value;
            });

    This is a reference implementation. You are free to copy, modify, or
    redistribute.

    Use your own copy. It is extremely unwise to load third party
    code into your pages.
*/

/*jslint evil: true */

/*global JSON */

/*members "\b", "\t", "\n", "\f", "\r", "\"", JSON, "\\", apply,
    charCodeAt, floor, getUTCDate, getUTCFullYear, getUTCHours,
    getUTCMinutes, getUTCMonth, getUTCSeconds, hasOwnProperty, join, length,
    parse, propertyIsEnumerable, prototype, push, replace, stringify, test,
    toJSON, toString
*/

if (!this.JSON) {

    JSON = function () {

        function f(n) {    // Format integers to have at least two digits.
            return n < 10 ? '0' + n : n;
        }

        Date.prototype.toJSON = function () {

// Eventually, this method will be based on the date.toISOString method.

            return this.getUTCFullYear()   + '-' +
                 f(this.getUTCMonth() + 1) + '-' +
                 f(this.getUTCDate())      + 'T' +
                 f(this.getUTCHours())     + ':' +
                 f(this.getUTCMinutes())   + ':' +
                 f(this.getUTCSeconds())   + 'Z';
        };


        var m = {    // table of character substitutions
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
        };

        function stringify(value, whitelist) {
            var a,          // The array holding the partial texts.
                i,          // The loop counter.
                k,          // The member key.
                l,          // Length.
                r = /["\\\x00-\x1f\x7f-\x9f]/g,
                v;          // The member value.

            switch (typeof value) {
            case 'string':

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe sequences.

                return r.test(value) ?
                    '"' + value.replace(r, function (a) {
                        var c = m[a];
                        if (c) {
                            return c;
                        }
                        c = a.charCodeAt();
                        return '\\u00' + Math.floor(c / 16).toString(16) +
                                                   (c % 16).toString(16);
                    }) + '"' :
                    '"' + value + '"';

            case 'number':

// JSON numbers must be finite. Encode non-finite numbers as null.

                return isFinite(value) ? String(value) : 'null';

            case 'boolean':
            case 'null':
                return String(value);

            case 'object':

// Due to a specification blunder in ECMAScript,
// typeof null is 'object', so watch out for that case.

                if (!value) {
                    return 'null';
                }

// If the object has a toJSON method, call it, and stringify the result.

                if (typeof value.toJSON === 'function') {
                    return stringify(value.toJSON());
                }
                a = [];
                if (typeof value.length === 'number' &&
                        !(value.propertyIsEnumerable('length'))) {

// The object is an array. Stringify every element. Use null as a placeholder
// for non-JSON values.

                    l = value.length;
                    for (i = 0; i < l; i += 1) {
                        a.push(stringify(value[i], whitelist) || 'null');
                    }

// Join all of the elements together and wrap them in brackets.

                    return '[' + a.join(',') + ']';
                }
                if (whitelist) {

// If a whitelist (array of keys) is provided, use it to select the components
// of the object.

                    l = whitelist.length;
                    for (i = 0; i < l; i += 1) {
                        k = whitelist[i];
                        if (typeof k === 'string') {
                            v = stringify(value[k], whitelist);
                            if (v) {
                                a.push(stringify(k) + ':' + v);
                            }
                        }
                    }
                } else {

// Otherwise, iterate through all of the keys in the object.

                    for (k in value) {
                        if (typeof k === 'string') {
                            v = stringify(value[k], whitelist);
                            if (v) {
                                a.push(stringify(k) + ':' + v);
                            }
                        }
                    }
                }

// Join all of the member texts together and wrap them in braces.

                return '{' + a.join(',') + '}';
            }
        }

        return {
            stringify: stringify,
            parse: function (text, filter) {
                var j;

                function walk(k, v) {
                    var i, n;
                    if (v && typeof v === 'object') {
                        for (i in v) {
                            if (Object.prototype.hasOwnProperty.apply(v, [i])) {
                                n = walk(i, v[i]);
                                if (n !== undefined) {
                                    v[i] = n;
                                } else {
                                    delete v[i];
                                }
                            }
                        }
                    }
                    return filter(k, v);
                }


// Parsing happens in three stages. In the first stage, we run the text against
// regular expressions that look for non-JSON patterns. We are especially
// concerned with '()' and 'new' because they can cause invocation, and '='
// because it can cause mutation. But just to be safe, we want to reject all
// unexpected forms.

// We split the first stage into 4 regexp operations in order to work around
// crippling inefficiencies in IE's and Safari's regexp engines. First we
// replace all backslash pairs with '@' (a non-JSON character). Second, we
// replace all simple value tokens with ']' characters. Third, we delete all
// open brackets that follow a colon or comma or that begin the text. Finally,
// we look to see that the remaining characters are only whitespace or ']' or
// ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.

                if (/^[\],:{}\s]*$/.test(text.replace(/\\./g, '@').
replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

// In the second stage we use the eval function to compile the text into a
// JavaScript structure. The '{' operator is subject to a syntactic ambiguity
// in JavaScript: it can begin a block or an object literal. We wrap the text
// in parens to eliminate the ambiguity.

                    j = eval('(' + text + ')');

// In the optional third stage, we recursively walk the new structure, passing
// each name/value pair to a filter function for possible transformation.

                    return typeof filter === 'function' ? walk('', j) : j;
                }

// If the text is not JSON parseable, then a SyntaxError is thrown.

                throw new SyntaxError('parseJSON');
            }
        };
    }();
}


/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Narcissus JavaScript engine.
 *
 * The Initial Developer of the Original Code is
 * Brendan Eich <brendan@mozilla.org>.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * Narcissus - JS implemented in JS.
 *
 * Well-known constants and lookup tables.  Many consts are generated from the
 * tokens table via eval to minimize redundancy, so consumers must be compiled
 * separately to take advantage of the simple switch-case constant propagation
 * done by SpiderMonkey.
 */
const GLOBAL = this;

var tokens = [
    // End of source.
    "END",

    // Operators and punctuators.  Some pair-wise order matters, e.g. (+, -)
    // and (UNARY_PLUS, UNARY_MINUS).
    "\n", ";",
    ",",
    "=",
    "?", ":", "CONDITIONAL",
    "||",
    "&&",
    "|",
    "^",
    "&",
    "==", "!=", "===", "!==",
    "<", "<=", ">=", ">",
    "<<", ">>", ">>>",
    "+", "-",
    "*", "/", "%",
    "!", "~", "UNARY_PLUS", "UNARY_MINUS",
    "++", "--",
    ".",
    "[", "]",
    "{", "}",
    "(", ")",

    // Nonterminal tree node type codes.
    "SCRIPT", "BLOCK", "LABEL", "FOR_IN", "CALL", "NEW_WITH_ARGS", "INDEX",
    "ARRAY_INIT", "OBJECT_INIT", "PROPERTY_INIT", "GETTER", "SETTER",
    "GROUP", "LIST",

    // Terminals.
    "IDENTIFIER", "NUMBER", "STRING", "REGEXP",

    // Keywords.
    "break",
    "case", "catch", "const", "continue",
    "debugger", "default", "delete", "do",
    "else", "enum",
    "false", "finally", "for", "function",
    "if", "in", "instanceof",
    "new", "null",
    "return",
    "switch",
    "this", "throw", "true", "try", "typeof",
    "var", "void",
    "while", "with",
];

// Operator and punctuator mapping from token to tree node type name.
// NB: superstring tokens (e.g., ++) must come before their substring token
// counterparts (+ in the example), so that the opRegExp regular expression
// synthesized from this list makes the longest possible match.
var opTypeNames = {
    '\n':   "NEWLINE",
    ';':    "SEMICOLON",
    ',':    "COMMA",
    '?':    "HOOK",
    ':':    "COLON",
    '||':   "OR",
    '&&':   "AND",
    '|':    "BITWISE_OR",
    '^':    "BITWISE_XOR",
    '&':    "BITWISE_AND",
    '===':  "STRICT_EQ",
    '==':   "EQ",
    '=':    "ASSIGN",
    '!==':  "STRICT_NE",
    '!=':   "NE",
    '<<':   "LSH",
    '<=':   "LE",
    '<':    "LT",
    '>>>':  "URSH",
    '>>':   "RSH",
    '>=':   "GE",
    '>':    "GT",
    '++':   "INCREMENT",
    '--':   "DECREMENT",
    '+':    "PLUS",
    '-':    "MINUS",
    '*':    "MUL",
    '/':    "DIV",
    '%':    "MOD",
    '!':    "NOT",
    '~':    "BITWISE_NOT",
    '.':    "DOT",
    '[':    "LEFT_BRACKET",
    ']':    "RIGHT_BRACKET",
    '{':    "LEFT_CURLY",
    '}':    "RIGHT_CURLY",
    '(':    "LEFT_PAREN",
    ')':    "RIGHT_PAREN"
};

// Hash of keyword identifier to tokens index.  NB: we must null __proto__ to
// avoid toString, etc. namespace pollution.
var keywords = {__proto__: null};

// Define const END, etc., based on the token names.  Also map name to index.
var consts = "const ";
for (var i = 0, j = tokens.length; i < j; i++) {
    if (i > 0)
        consts += ", ";
    var t = tokens[i];
    if (/^[a-z]/.test(t)) {
        consts += t.toUpperCase();
        keywords[t] = i;
    } else {
        consts += (/^\W/.test(t) ? opTypeNames[t] : t);
    }
    consts += " = " + i;
    tokens[t] = i;
}
eval(consts + ";");

// Map assignment operators to their indexes in the tokens array.
var assignOps = ['|', '^', '&', '<<', '>>', '>>>', '+', '-', '*', '/', '%'];

for (i = 0, j = assignOps.length; i < j; i++) {
    t = assignOps[i];
    assignOps[t] = tokens[t];
}

/* vim: set sw=4 ts=8 et tw=78: */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Narcissus JavaScript engine.
 *
 * The Initial Developer of the Original Code is
 * Brendan Eich <brendan@mozilla.org>.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * Narcissus - JS implemented in JS.
 *
 * Lexical scanner and parser.
 */

// Build a regexp that recognizes operators and punctuators (except newline).
var opRegExpSrc = "^";
for (i in opTypeNames) {
    if (i == '\n')
        continue;
    if (opRegExpSrc != "^")
        opRegExpSrc += "|^";
    opRegExpSrc += i.replace(/[?|^&(){}\[\]+\-*\/\.]/g, "\\$&");
}
var opRegExp = new RegExp(opRegExpSrc);

// A regexp to match floating point literals (but not integer literals).
var fpRegExp = /^\d+\.\d*(?:[eE][-+]?\d+)?|^\d+(?:\.\d*)?[eE][-+]?\d+|^\.\d+(?:[eE][-+]?\d+)?/;

// A regexp to match regexp literals.
var reRegExp = /^\/((?:\\.|\[(?:\\.|[^\]])*\]|[^\/])+)\/([gimy]*)/;

function Tokenizer(s, f, l) {
    this.cursor = 0;
    this.source = String(s);
    this.tokens = [];
    this.tokenIndex = 0;
    this.lookahead = 0;
    this.scanNewlines = false;
    this.scanOperand = true;
    this.filename = f || "";
    this.lineno = l || 1;
}

Tokenizer.prototype = {
    get input() {
        return this.source.substring(this.cursor);
    },

    get done() {
        return this.peek() == END;
    },

    get token() {
        return this.tokens[this.tokenIndex];
    },

    match: function (tt) {
        return this.get() == tt || this.unget();
    },

    mustMatch: function (tt) {
        if (!this.match(tt))
            throw this.newSyntaxError("Missing " + tokens[tt].toLowerCase());
        return this.token;
    },

    peek: function () {
        var tt, next;
        if (this.lookahead) {
            next = this.tokens[(this.tokenIndex + this.lookahead) & 3];
            if (this.scanNewlines && next.lineno != this.lineno)
                tt = NEWLINE;
            else
                tt = next.type;
        } else {
            tt = this.get();
            this.unget();
        }
        return tt;
    },

    peekOnSameLine: function () {
        this.scanNewlines = true;
        var tt = this.peek();
        this.scanNewlines = false;
        return tt;
    },

    get: function () {
        var token;
        while (this.lookahead) {
            --this.lookahead;
            this.tokenIndex = (this.tokenIndex + 1) & 3;
            token = this.tokens[this.tokenIndex];
            if (token.type != NEWLINE || this.scanNewlines)
                return token.type;
        }

        for (;;) {
            var input = this.input;
            var match = (this.scanNewlines ? /^[ \t]+/ : /^\s+/)(input);
            if (match) {
                var spaces = match[0];
                this.cursor += spaces.length;
                var newlines = spaces.match(/\n/g);
                if (newlines)
                    this.lineno += newlines.length;
                input = this.input;
            }

            if (!(match = /^\/(?:\*(?:.|\n)*?\*\/|\/.*)/(input)))
                break;
            var comment = match[0];
            this.cursor += comment.length;
            newlines = comment.match(/\n/g);
            if (newlines)
                this.lineno += newlines.length
        }

        this.tokenIndex = (this.tokenIndex + 1) & 3;
        token = this.tokens[this.tokenIndex];
        if (!token)
            this.tokens[this.tokenIndex] = token = {};

        if (!input)
            return token.type = END;

        if ((match = fpRegExp(input))) {
            token.type = NUMBER;
            token.value = parseFloat(match[0]);
        } else if ((match = /^0[xX][\da-fA-F]+|^0[0-7]*|^\d+/(input))) {
            token.type = NUMBER;
            token.value = parseInt(match[0]);
        } else if ((match = /^[$_\w]+/(input))) {       // FIXME no ES3 unicode
            var id = match[0];
            token.type = keywords[id] || IDENTIFIER;
            token.value = id;
        } else if ((match = /^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/(input))) { //"){
            token.type = STRING;
            token.value = eval(match[0]);
        } else if (this.scanOperand && (match = reRegExp(input))) {
            token.type = REGEXP;
            token.value = new RegExp(match[1], match[2]);
        } else if ((match = opRegExp(input))) {
            var op = match[0];
            if (assignOps[op] && input[op.length] == '=') {
                token.type = ASSIGN;
                token.assignOp = GLOBAL[opTypeNames[op]];
                match[0] += '=';
            } else {
                token.type = GLOBAL[opTypeNames[op]];
                if (this.scanOperand &&
                    (token.type == PLUS || token.type == MINUS)) {
                    token.type += UNARY_PLUS - PLUS;
                }
                token.assignOp = null;
            }
            token.value = op;
        } else if (this.scanNewlines && (match = /^\n/(input))) {
            token.type = NEWLINE;
        } else {
            throw this.newSyntaxError("Illegal token");
        }

        token.start = this.cursor;
        this.cursor += match[0].length;
        token.end = this.cursor;
        token.lineno = this.lineno;
        return token.type;
    },

    unget: function () {
        if (++this.lookahead == 4) throw "PANIC: too much lookahead!";
        this.tokenIndex = (this.tokenIndex - 1) & 3;
    },

    newSyntaxError: function (m) {
        var e = new SyntaxError(m, this.filename, this.lineno);
        e.line   = this.lineno;
        e.source = this.source;
        e.cursor = this.cursor;
        return e;
    }
};

function CompilerContext(inFunction) {
    this.inFunction = inFunction;
    this.stmtStack = [];
    this.funDecls = [];
    this.varDecls = [];
}

var CCp = CompilerContext.prototype;
CCp.bracketLevel = CCp.curlyLevel = CCp.parenLevel = CCp.hookLevel = 0;
CCp.ecmaStrictMode = CCp.inForLoopInit = false;

function Script(t, x) {
    var n = Statements(t, x);
    n.type = SCRIPT;
    n.funDecls = x.funDecls;
    n.varDecls = x.varDecls;
    return n;
}

// Node extends Array, which we extend slightly with a top-of-stack method.
Array.prototype.top = function () {
        return this.length && this[this.length-1];
    }

function Node(t, type) {
    var token = t.token;
    if (token) {
        this.type = type || token.type;
        this.value = token.value;
        this.lineno = token.lineno;
        this.start = token.start;
        this.end = token.end;
    } else {
        this.type = type;
        this.lineno = t.lineno;
    }
    this.tokenizer = t;

    for (var i = 2; i < arguments.length; i++)
        this.push(arguments[i]);
}

var Np = Node.prototype = new Array;
Np.constructor = Node;
Np.toSource = Object.prototype.toSource;

// Always use push to add operands to an expression, to update start and end.
Np.push = function (kid) {
    if (kid.start < this.start)
        this.start = kid.start;
    if (this.end < kid.end)
        this.end = kid.end;
    return Array.prototype.push.call(this, kid);
}

Node.indentLevel = 0;

function tokenstr(tt) {
    var t = tokens[tt];
    return /^\W/.test(t) ? opTypeNames[t] : t.toUpperCase();
}

Np.toString = function () {
    var a = [];
    for (var i in this) {
        if (this.hasOwnProperty(i) && i != 'type' && i != 'target')
            a.push({id: i, value: this[i]});
    }
    a.sort(function (a,b) { return (a.id < b.id) ? -1 : 1; });
    const INDENTATION = "    ";
    var n = ++Node.indentLevel;
    var s = "{\n" + INDENTATION.repeat(n) + "type: " + tokenstr(this.type);
    for (i = 0; i < a.length; i++)
        s += ",\n" + INDENTATION.repeat(n) + a[i].id + ": " + a[i].value;
    n = --Node.indentLevel;
    s += "\n" + INDENTATION.repeat(n) + "}";
    return s;
}

Np.getSource = function () {
    return this.tokenizer.source.slice(this.start, this.end);
};

Np.__defineGetter__('filename',
                    function () { return this.tokenizer.filename; });

String.prototype.repeat =
    function (n) {
        var s = "", t = this + s;
        while (--n >= 0)
            s += t;
        return s;
    };

// Statement stack and nested statement handler.
function nest(t, x, node, func, end) {
    x.stmtStack.push(node);
    var n = func(t, x);
    x.stmtStack.pop();
    end && t.mustMatch(end);
    return n;
}

function Statements(t, x) {
    var n = new Node(t, BLOCK);
    x.stmtStack.push(n);
    while (!t.done && t.peek() != RIGHT_CURLY)
        n.push(Statement(t, x));
    x.stmtStack.pop();
    return n;
}

function Block2(t, x) {
    t.mustMatch(LEFT_CURLY);
    var n = Statements(t, x);
    t.mustMatch(RIGHT_CURLY);
    return n;
}

const DECLARED_FORM = 0, EXPRESSED_FORM = 1, STATEMENT_FORM = 2;

function Statement(t, x) {
    var i, label, n, n2, ss, tt = t.get();

    // Cases for statements ending in a right curly return early, avoiding the
    // common semicolon insertion magic after this switch.
    switch (tt) {
      case FUNCTION:
        return FunctionDefinition(t, x, true,
                                  (x.stmtStack.length > 1)
                                  ? STATEMENT_FORM
                                  : DECLARED_FORM);

      case LEFT_CURLY:
        n = Statements(t, x);
        t.mustMatch(RIGHT_CURLY);
        return n;

      case IF:
        n = new Node(t);
        n.condition = ParenExpression(t, x);
        x.stmtStack.push(n);
        n.thenPart = Statement(t, x);
        n.elsePart = t.match(ELSE) ? Statement(t, x) : null;
        x.stmtStack.pop();
        return n;

      case SWITCH:
        n = new Node(t);
        t.mustMatch(LEFT_PAREN);
        n.discriminant = Expression(t, x);
        t.mustMatch(RIGHT_PAREN);
        n.cases = [];
        n.defaultIndex = -1;
        x.stmtStack.push(n);
        t.mustMatch(LEFT_CURLY);
        while ((tt = t.get()) != RIGHT_CURLY) {
            switch (tt) {
              case DEFAULT:
                if (n.defaultIndex >= 0)
                    throw t.newSyntaxError("More than one switch default");
                // FALL THROUGH
              case CASE:
                n2 = new Node(t);
                if (tt == DEFAULT)
                    n.defaultIndex = n.cases.length;
                else
                    n2.caseLabel = Expression(t, x, COLON);
                break;
              default:
                throw t.newSyntaxError("Invalid switch case");
            }
            t.mustMatch(COLON);
            n2.statements = new Node(t, BLOCK);
            while ((tt=t.peek()) != CASE && tt != DEFAULT && tt != RIGHT_CURLY)
                n2.statements.push(Statement(t, x));
            n.cases.push(n2);
        }
        x.stmtStack.pop();
        return n;

      case FOR:
        n = new Node(t);
        n.isLoop = true;
        t.mustMatch(LEFT_PAREN);
        if ((tt = t.peek()) != SEMICOLON) {
            x.inForLoopInit = true;
            if (tt == VAR || tt == CONST) {
                t.get();
                n2 = Variables(t, x);
            } else {
                n2 = Expression(t, x);
            }
            x.inForLoopInit = false;
        }
        if (n2 && t.match(IN)) {
            n.type = FOR_IN;
            if (n2.type == VAR) {
                if (n2.length != 1) {
                    throw new SyntaxError("Invalid for..in left-hand side",
                                          t.filename, n2.lineno);
                }

                // NB: n2[0].type == IDENTIFIER and n2[0].value == n2[0].name.
                n.iterator = n2[0];
                n.varDecl = n2;
            } else {
                n.iterator = n2;
                n.varDecl = null;
            }
            n.object = Expression(t, x);
        } else {
            n.setup = n2 || null;
            t.mustMatch(SEMICOLON);
            n.condition = (t.peek() == SEMICOLON) ? null : Expression(t, x);
            t.mustMatch(SEMICOLON);
            n.update = (t.peek() == RIGHT_PAREN) ? null : Expression(t, x);
        }
        t.mustMatch(RIGHT_PAREN);
        n.body = nest(t, x, n, Statement);
        return n;

      case WHILE:
        n = new Node(t);
        n.isLoop = true;
        n.condition = ParenExpression(t, x);
        n.body = nest(t, x, n, Statement);
        return n;

      case DO:
        n = new Node(t);
        n.isLoop = true;
        n.body = nest(t, x, n, Statement, WHILE);
        n.condition = ParenExpression(t, x);
        if (!x.ecmaStrictMode) {
            // <script language="JavaScript"> (without version hints) may need
            // automatic semicolon insertion without a newline after do-while.
            // See http://bugzilla.mozilla.org/show_bug.cgi?id=238945.
            t.match(SEMICOLON);
            return n;
        }
        break;

      case BREAK:
      case CONTINUE:
        n = new Node(t);
        if (t.peekOnSameLine() == IDENTIFIER) {
            t.get();
            n.label = t.token.value;
        }
        ss = x.stmtStack;
        i = ss.length;
        label = n.label;
        if (label) {
            do {
                if (--i < 0)
                    throw t.newSyntaxError("Label not found");
            } while (ss[i].label != label);
        } else {
            do {
                if (--i < 0) {
                    throw t.newSyntaxError("Invalid " + ((tt == BREAK)
                                                         ? "break"
                                                         : "continue"));
                }
            } while (!ss[i].isLoop && (tt != BREAK || ss[i].type != SWITCH));
        }
        n.target = ss[i];
        break;

      case TRY:
        n = new Node(t);
        n.tryBlock2 = Block2(t, x);
        n.catchClauses = [];
        while (t.match(CATCH)) {
            n2 = new Node(t);
            t.mustMatch(LEFT_PAREN);
            n2.varName = t.mustMatch(IDENTIFIER).value;
            if (t.match(IF)) {
                if (x.ecmaStrictMode)
                    throw t.newSyntaxError("Illegal catch guard");
                if (n.catchClauses.length && !n.catchClauses.top().guard)
                    throw t.newSyntaxError("Guarded catch after unguarded");
                n2.guard = Expression(t, x);
            } else {
                n2.guard = null;
            }
            t.mustMatch(RIGHT_PAREN);
            n2.block = Block2(t, x);
            n.catchClauses.push(n2);
        }
        if (t.match(FINALLY))
            n.finallyBlock2 = Block2(t, x);
        if (!n.catchClauses.length && !n.finallyBlock2)
            throw t.newSyntaxError("Invalid try statement");
        return n;

      case CATCH:
      case FINALLY:
        throw t.newSyntaxError(tokens[tt] + " without preceding try");

      case THROW:
        n = new Node(t);
        n.exception = Expression(t, x);
        break;

      case RETURN:
        if (!x.inFunction)
            throw t.newSyntaxError("Invalid return");
        n = new Node(t);
        tt = t.peekOnSameLine();
        if (tt != END && tt != NEWLINE && tt != SEMICOLON && tt != RIGHT_CURLY)
            n.value = Expression(t, x);
        break;

      case WITH:
        n = new Node(t);
        n.object = ParenExpression(t, x);
        n.body = nest(t, x, n, Statement);
        return n;

      case VAR:
      case CONST:
        n = Variables(t, x);
        break;

      case DEBUGGER:
        n = new Node(t);
        break;

      case NEWLINE:
      case SEMICOLON:
        n = new Node(t, SEMICOLON);
        n.expression = null;
        return n;

      default:
        if (tt == IDENTIFIER) {
            t.scanOperand = false;
            tt = t.peek();
            t.scanOperand = true;
            if (tt == COLON) {
                label = t.token.value;
                ss = x.stmtStack;
                for (i = ss.length-1; i >= 0; --i) {
                    if (ss[i].label == label)
                        throw t.newSyntaxError("Duplicate label");
                }
                t.get();
                n = new Node(t, LABEL);
                n.label = label;
                n.statement = nest(t, x, n, Statement);
                return n;
            }
        }

        n = new Node(t, SEMICOLON);
        t.unget();
        n.expression = Expression(t, x);
        n.end = n.expression.end;
        break;
    }

    if (t.lineno == t.token.lineno) {
        tt = t.peekOnSameLine();
        if (tt != END && tt != NEWLINE && tt != SEMICOLON && tt != RIGHT_CURLY)
            throw t.newSyntaxError("Missing ; before statement");
    }
    t.match(SEMICOLON);
    return n;
}

function FunctionDefinition(t, x, requireName, functionForm) {
    var f = new Node(t);
    if (f.type != FUNCTION)
        f.type = (f.value == "get") ? GETTER : SETTER;
    if (t.match(IDENTIFIER))
        f.name = t.token.value;
    else if (requireName)
        throw t.newSyntaxError("Missing function identifier");

    t.mustMatch(LEFT_PAREN);
    f.params = [];
    var tt;
    while ((tt = t.get()) != RIGHT_PAREN) {
        if (tt != IDENTIFIER)
            throw t.newSyntaxError("Missing formal parameter");
        f.params.push(t.token.value);
        if (t.peek() != RIGHT_PAREN)
            t.mustMatch(COMMA);
    }

    t.mustMatch(LEFT_CURLY);
    var x2 = new CompilerContext(true);
    f.body = Script(t, x2);
    t.mustMatch(RIGHT_CURLY);
    f.end = t.token.end;

    f.functionForm = functionForm;
    if (functionForm == DECLARED_FORM)
        x.funDecls.push(f);
    return f;
}

function Variables(t, x) {
    var n = new Node(t);
    do {
        t.mustMatch(IDENTIFIER);
        var n2 = new Node(t);
        n2.name = n2.value;
        if (t.match(ASSIGN)) {
            if (t.token.assignOp)
                throw t.newSyntaxError("Invalid variable initialization");
            n2.initializer = Expression(t, x, COMMA);
        }
        n2.readOnly = (n.type == CONST);
        n.push(n2);
        x.varDecls.push(n2);
    } while (t.match(COMMA));
    return n;
}

function ParenExpression(t, x) {
    t.mustMatch(LEFT_PAREN);
    var n = Expression(t, x);
    t.mustMatch(RIGHT_PAREN);
    return n;
}

var opPrecedence = {
    SEMICOLON: 0,
    COMMA: 1,
    ASSIGN: 2, HOOK: 2, COLON: 2,
    // The above all have to have the same precedence, see bug 330975.
    OR: 4,
    AND: 5,
    BITWISE_OR: 6,
    BITWISE_XOR: 7,
    BITWISE_AND: 8,
    EQ: 9, NE: 9, STRICT_EQ: 9, STRICT_NE: 9,
    LT: 10, LE: 10, GE: 10, GT: 10, IN: 10, INSTANCEOF: 10,
    LSH: 11, RSH: 11, URSH: 11,
    PLUS: 12, MINUS: 12,
    MUL: 13, DIV: 13, MOD: 13,
    DELETE: 14, VOID: 14, TYPEOF: 14, // PRE_INCREMENT: 14, PRE_DECREMENT: 14,
    NOT: 14, BITWISE_NOT: 14, UNARY_PLUS: 14, UNARY_MINUS: 14,
    INCREMENT: 15, DECREMENT: 15,     // postfix
    NEW: 16,
    DOT: 17
};

// Map operator type code to precedence.
for (i in opPrecedence)
    opPrecedence[GLOBAL[i]] = opPrecedence[i];

var opArity = {
    COMMA: -2,
    ASSIGN: 2,
    HOOK: 3,
    OR: 2,
    AND: 2,
    BITWISE_OR: 2,
    BITWISE_XOR: 2,
    BITWISE_AND: 2,
    EQ: 2, NE: 2, STRICT_EQ: 2, STRICT_NE: 2,
    LT: 2, LE: 2, GE: 2, GT: 2, IN: 2, INSTANCEOF: 2,
    LSH: 2, RSH: 2, URSH: 2,
    PLUS: 2, MINUS: 2,
    MUL: 2, DIV: 2, MOD: 2,
    DELETE: 1, VOID: 1, TYPEOF: 1,  // PRE_INCREMENT: 1, PRE_DECREMENT: 1,
    NOT: 1, BITWISE_NOT: 1, UNARY_PLUS: 1, UNARY_MINUS: 1,
    INCREMENT: 1, DECREMENT: 1,     // postfix
    NEW: 1, NEW_WITH_ARGS: 2, DOT: 2, INDEX: 2, CALL: 2,
    ARRAY_INIT: 1, OBJECT_INIT: 1, GROUP: 1
};

// Map operator type code to arity.
for (i in opArity)
    opArity[GLOBAL[i]] = opArity[i];

function Expression(t, x, stop) {
    var n, id, tt, operators = [], operands = [];
    var bl = x.bracketLevel, cl = x.curlyLevel, pl = x.parenLevel,
        hl = x.hookLevel;

    function reduce() {
        var n = operators.pop();
        var op = n.type;
        var arity = opArity[op];
        if (arity == -2) {
            // Flatten left-associative trees.
            var left = operands.length >= 2 && operands[operands.length-2];
            if (left.type == op) {
                var right = operands.pop();
                left.push(right);
                return left;
            }
            arity = 2;
        }

        // Always use push to add operands to n, to update start and end.
        var a = operands.splice(operands.length - arity);
        for (var i = 0; i < arity; i++)
            n.push(a[i]);

        // Include closing bracket or postfix operator in [start,end).
        if (n.end < t.token.end)
            n.end = t.token.end;

        operands.push(n);
        return n;
    }

loop:
    while ((tt = t.get()) != END) {
        if (tt == stop &&
            x.bracketLevel == bl && x.curlyLevel == cl && x.parenLevel == pl &&
            x.hookLevel == hl) {
            // Stop only if tt matches the optional stop parameter, and that
            // token is not quoted by some kind of bracket.
            break;
        }
        switch (tt) {
          case SEMICOLON:
            // NB: cannot be empty, Statement handled that.
            break loop;

          case ASSIGN:
          case HOOK:
          case COLON:
            if (t.scanOperand)
                break loop;
            // Use >, not >=, for right-associative ASSIGN and HOOK/COLON.
            while (opPrecedence[operators.top().type] > opPrecedence[tt] ||
                   (tt == COLON && operators.top().type == ASSIGN)) {
                reduce();
            }
            if (tt == COLON) {
                n = operators.top();
                if (n.type != HOOK)
                    throw t.newSyntaxError("Invalid label");
                --x.hookLevel;
            } else {
                operators.push(new Node(t));
                if (tt == ASSIGN)
                    operands.top().assignOp = t.token.assignOp;
                else
                    ++x.hookLevel;      // tt == HOOK
            }
            t.scanOperand = true;
            break;

          case IN:
            // An in operator should not be parsed if we're parsing the head of
            // a for (...) loop, unless it is in the then part of a conditional
            // expression, or parenthesized somehow.
            if (x.inForLoopInit && !x.hookLevel &&
                !x.bracketLevel && !x.curlyLevel && !x.parenLevel) {
                break loop;
            }
            // FALL THROUGH
          case COMMA:
            // Treat comma as left-associative so reduce can fold left-heavy
            // COMMA trees into a single array.
            // FALL THROUGH
          case OR:
          case AND:
          case BITWISE_OR:
          case BITWISE_XOR:
          case BITWISE_AND:
          case EQ: case NE: case STRICT_EQ: case STRICT_NE:
          case LT: case LE: case GE: case GT:
          case INSTANCEOF:
          case LSH: case RSH: case URSH:
          case PLUS: case MINUS:
          case MUL: case DIV: case MOD:
          case DOT:
            if (t.scanOperand)
                break loop;
            while (opPrecedence[operators.top().type] >= opPrecedence[tt])
                reduce();
            if (tt == DOT) {
                t.mustMatch(IDENTIFIER);
                operands.push(new Node(t, DOT, operands.pop(), new Node(t)));
            } else {
                operators.push(new Node(t));
                t.scanOperand = true;
            }
            break;

          case DELETE: case VOID: case TYPEOF:
          case NOT: case BITWISE_NOT: case UNARY_PLUS: case UNARY_MINUS:
          case NEW:
            if (!t.scanOperand)
                break loop;
            operators.push(new Node(t));
            break;

          case INCREMENT: case DECREMENT:
            if (t.scanOperand) {
                operators.push(new Node(t));  // prefix increment or decrement
            } else {
                // Don't cross a line boundary for postfix {in,de}crement.
                if (t.tokens[(t.tokenIndex + t.lookahead - 1) & 3].lineno !=
                    t.lineno) {
                    break loop;
                }

                // Use >, not >=, so postfix has higher precedence than prefix.
                while (opPrecedence[operators.top().type] > opPrecedence[tt])
                    reduce();
                n = new Node(t, tt, operands.pop());
                n.postfix = true;
                operands.push(n);
            }
            break;

          case FUNCTION:
            if (!t.scanOperand)
                break loop;
            operands.push(FunctionDefinition(t, x, false, EXPRESSED_FORM));
            t.scanOperand = false;
            break;

          case NULL: case THIS: case TRUE: case FALSE:
          case IDENTIFIER: case NUMBER: case STRING: case REGEXP:
            if (!t.scanOperand)
                break loop;
            operands.push(new Node(t));
            t.scanOperand = false;
            break;

          case LEFT_BRACKET:
            if (t.scanOperand) {
                // Array initialiser.  Parse using recursive descent, as the
                // sub-grammar here is not an operator grammar.
                n = new Node(t, ARRAY_INIT);
                while ((tt = t.peek()) != RIGHT_BRACKET) {
                    if (tt == COMMA) {
                        t.get();
                        n.push(null);
                        continue;
                    }
                    n.push(Expression(t, x, COMMA));
                    if (!t.match(COMMA))
                        break;
                }
                t.mustMatch(RIGHT_BRACKET);
                operands.push(n);
                t.scanOperand = false;
            } else {
                // Property indexing operator.
                operators.push(new Node(t, INDEX));
                t.scanOperand = true;
                ++x.bracketLevel;
            }
            break;

          case RIGHT_BRACKET:
            if (t.scanOperand || x.bracketLevel == bl)
                break loop;
            while (reduce().type != INDEX)
                continue;
            --x.bracketLevel;
            break;

          case LEFT_CURLY:
            if (!t.scanOperand)
                break loop;
            // Object initialiser.  As for array initialisers (see above),
            // parse using recursive descent.
            ++x.curlyLevel;
            n = new Node(t, OBJECT_INIT);
          object_init:
            if (!t.match(RIGHT_CURLY)) {
                do {
                    tt = t.get();
                    if ((t.token.value == "get" || t.token.value == "set") &&
                        t.peek() == IDENTIFIER) {
                        if (x.ecmaStrictMode)
                            throw t.newSyntaxError("Illegal property accessor");
                        n.push(FunctionDefinition(t, x, true, EXPRESSED_FORM));
                    } else {
                        switch (tt) {
                          case IDENTIFIER:
                          case NUMBER:
                          case STRING:
                            id = new Node(t);
                            break;
                          case RIGHT_CURLY:
                            if (x.ecmaStrictMode)
                                throw t.newSyntaxError("Illegal trailing ,");
                            break object_init;
                          default:
                            throw t.newSyntaxError("Invalid property name");
                        }
                        t.mustMatch(COLON);
                        n.push(new Node(t, PROPERTY_INIT, id,
                                        Expression(t, x, COMMA)));
                    }
                } while (t.match(COMMA));
                t.mustMatch(RIGHT_CURLY);
            }
            operands.push(n);
            t.scanOperand = false;
            --x.curlyLevel;
            break;

          case RIGHT_CURLY:
            if (!t.scanOperand && x.curlyLevel != cl)
                throw "PANIC: right curly botch";
            break loop;

          case LEFT_PAREN:
            if (t.scanOperand) {
                operators.push(new Node(t, GROUP));
            } else {
                while (opPrecedence[operators.top().type] > opPrecedence[NEW])
                    reduce();

                // Handle () now, to regularize the n-ary case for n > 0.
                // We must set scanOperand in case there are arguments and
                // the first one is a regexp or unary+/-.
                n = operators.top();
                t.scanOperand = true;
                if (t.match(RIGHT_PAREN)) {
                    if (n.type == NEW) {
                        --operators.length;
                        n.push(operands.pop());
                    } else {
                        n = new Node(t, CALL, operands.pop(),
                                     new Node(t, LIST));
                    }
                    operands.push(n);
                    t.scanOperand = false;
                    break;
                }
                if (n.type == NEW)
                    n.type = NEW_WITH_ARGS;
                else
                    operators.push(new Node(t, CALL));
            }
            ++x.parenLevel;
            break;

          case RIGHT_PAREN:
            if (t.scanOperand || x.parenLevel == pl)
                break loop;
            while ((tt = reduce().type) != GROUP && tt != CALL &&
                   tt != NEW_WITH_ARGS) {
                continue;
            }
            if (tt != GROUP) {
                n = operands.top();
                if (n[1].type != COMMA)
                    n[1] = new Node(t, LIST, n[1]);
                else
                    n[1].type = LIST;
            }
            --x.parenLevel;
            break;

          // Automatic semicolon insertion means we may scan across a newline
          // and into the beginning of another statement.  If so, break out of
          // the while loop and let the t.scanOperand logic handle errors.
          default:
            break loop;
        }
    }

    if (x.hookLevel != hl)
        throw t.newSyntaxError("Missing : after ?");
    if (x.parenLevel != pl)
        throw t.newSyntaxError("Missing ) in parenthetical");
    if (x.bracketLevel != bl)
        throw t.newSyntaxError("Missing ] in index expression");
    if (t.scanOperand)
        throw t.newSyntaxError("Missing operand");

    // Resume default mode, scanning for operands, not operators.
    t.scanOperand = true;
    t.unget();
    while (operators.length)
        reduce();
    return operands.pop();
}

function parse(s, f, l) {
    var t = new Tokenizer(s, f, l);
    var x = new CompilerContext(false);
    var n = Script(t, x);
    if (!t.done)
        throw t.newSyntaxError("Syntax error");
    return n;
}

