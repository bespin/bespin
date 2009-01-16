/*
 * TokenObject: Given a string, make a token object that holds positions and has name access
 */

var TokenObject = function(input, options) {
	this._input = input;
	this._options = options;
	this._splitterRegex = new RegExp(this._options.splitBy || '\\s+');
	this._pieces = input.split(this._splitterRegex);
	
	if (this._options.params) { // -- create a hash for name based access
		this._nametoindex = {};
		var namedparams = this._options.params.split(' ');
		for (var x = 0; x < namedparams.length; x++) {
			this._nametoindex[namedparams[x]] = x;
			
			if (!this._options['noshortcutvalues']) { // side step if you really don't want this
				this[namedparams[x]] = this._pieces[x];
			}
		}
		
	}
}

TokenObject.prototype.param = function(index) {
	return (typeof index == "number") ? this._pieces[index] : this._pieces[this._nametoindex[index]];
}

TokenObject.prototype.length = function() {
	return this._pieces.length;
}
