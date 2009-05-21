meta: {{}}

// Setup the status bar component
jetpack.statusBar.append({
  url: "unad.html",
  onReady: function(widget) {
    widgets.push(widget);
    widget.defaultView.wrappedJSObject.setState(state);
    $(widget).click(toggleState);
  },
  onUnload: function(widget) {
    widgets.splice(widgets.indexOf(widget), 1);
  },
  width: 42
});


// Blocklist implementation
Blocklist = function(url) {
  this._getRules(url);
};

Blocklist.prototype = {
  _rules: [],

  _ruleToRegExp: function(text){
    if (text[0] == "!" || text[0] == "[" || text[0] == "@") return null;
    if (text.match(/\$/) ) return null;

  	var regexp;
  	if (text[0] == "/" && text[text.length - 1] == "/")   // filter is a regexp already
  	{
  		regexp = text.substr(1, text.length - 2);
  	}
  	else
  	{
  		regexp = text.replace(/\*+/g, "*")        // remove multiple wildcards
            .replace(/(\W)/g, "\\$1")    // escape special symbols
  			.replace(/\\\*/g, ".*")      // replace wildcards by .*
  			.replace(/^\\\|/, "^")       // process anchor at expression start
  			.replace(/\\\|$/, "$")       // process anchor at expression end
  			.replace(/^(\.\*)/,"")       // remove leading wildcards
  			.replace(/(\.\*)$/,"");      // remove trailing wildcards
  	}

  	if (regexp == "") return null;

  	return new RegExp(regexp);
  },

  _addRule: function( text) {
    var rule = this._ruleToRegExp(text);
    if (rule ) this._rules.push(rule);
  },

  _getRules: function( url) {
    var self = this;
    $.get( url, function(data){
      data = data.split("\n");
      for each( line in data ) self._addRule( line );
      self._addRule( "doubleclick" );
    });
  },

  match: function( url) {
    for each( rule in this._rules){
      if (rule.exec(url)) {
        return true;

      }
    }
    return false;
  }
};

var blocklist = new Blocklist("http://easylist.adblockplus.org/easylist.txt");

function removeAds(doc) {
  if (doc.location.protocol == "http:" ||
      doc.location.protocol == "https:")
    $(doc).find("[src]").filter(function(){
      var el = $(this);
      if (el && blocklist.match(el.attr("src")) )
        el.remove();
      });
}

var widgets = [];
var state = "off";

function toggleState() {
  if (state == "off") {
    jetpack.tabs.onReady(removeAds);
    state = "on";
  } else {
    jetpack.tabs.onReady.unbind(removeAds);
    state = "off";
  }
  widgets.forEach(function(widget) {
    widget.defaultView.wrappedJSObject.setState(state);
  });
}
