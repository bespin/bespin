var URLBar = {
	last: document.location.hash,
	check: function() {
		var hash = document.location.hash;
		if (this.last != hash) {
			var urlchange = new URLSettings(hash);
			document.fire("bespin:editor:openfile", { filename: urlchange.get('path') });
			this.last = hash;
		}
	}
};

setInterval(function() {
	URLBar.check.apply(URLBar);
}, 200);
