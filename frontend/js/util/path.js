var Path = {
	combine: function() {
		var args = Array.prototype.slice.call(arguments); // clone to a true array

		var path = args.join('/');
		path = path.replace(/\/\/+/g, '/');
		path = path.replace(/^\s+|\s+$/g, '');
		return path;		
	},
	
	directory: function(path) {
		var dirs = path.split('/');
		if (dirs.length == 1) { // no directory so return blank
			return "";
		} else if ((dirs.length == 2) && dirs.last() == "") { // a complete directory so return it
			return path;
		} else {
			return dirs.slice(0, dirs.length - 1).join('/');
		}
	},
	
	escape: function() {
		return escape(Path.combine.apply(this, arguments));
	}
}
