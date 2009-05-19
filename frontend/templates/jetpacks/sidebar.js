meta: {{}}

// Setup the status bar component
jetpack.statusBar.append({
  html: <>
    <img src="http://mail.google.com/mail/images/favicon.ico"/>
      <span id="count" style="position:absolute;left:4px;top:8px;font-size:10px;cursor: pointer;background-color:rgba(255,255,255, .8);"></span>
  </>,
  onReady: function(doc) {
    var gmail = new GmailNotifier(doc);
  },
  width: 20
});


// Gmail Notifier
function GmailNotifier(doc){
  $(doc).click(this.goToInbox);
  this.update(doc);
  setInterval(function() {
    this.update(doc);
  }, 60 * 1000);
}
GmailNotifier.prototype = {
  goToInbox: function() {
    jetpack.tabs.open("http://mail.google.com");
    jetpack.tabs[ jetpack.tabs.length-1 ].focus();
  },
  
  update: function(doc) {
    var url = "http://mail.google.com/mail/feed/atom";
    doc = $(doc);
    $.get( url, function(xml){
      var el = $(xml).find("fullcount"); // Unread message count

      if (el) {
        var count = el.get(0).textContent;
        doc.find("#count").text( count );
      } else {
        doc.find("#count").text( "Login" );
      }
    });
  }
}
