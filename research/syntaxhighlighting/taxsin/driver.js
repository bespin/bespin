/*
 * Drive the syntax highlighting
 */

load("class.js");
load("configloader.js");

// -- Load in Syntax files
loadSyntaxFiles(['css', 'html', 'javascript']);

// -- Syntax highlight a file
highlight('class.js');

var Foo = Class.create({
	init: function() {
		this.bar = 'baz';
	}
})

var f = new Foo();
print(f.bar);

