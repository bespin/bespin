// -- Firefox only right now

var Clipboard = {
  copy: function(copytext) {
    try {
      if (netscape.security.PrivilegeManager.enablePrivilege) {
        netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
      } else {
        return;
      }
    } catch (ex) {}

    var str = Components.classes["@mozilla.org/supports-string;1"].
                              createInstance(Components.interfaces.nsISupportsString);
    str.data = copytext;

    var trans = Components.classes["@mozilla.org/widget/transferable;1"].
                           createInstance(Components.interfaces.nsITransferable);
    if (!trans) return false;

    trans.addDataFlavor("text/unicode");
    trans.setTransferData("text/unicode", str, copytext.length * 2);

    var clipid = Components.interfaces.nsIClipboard;
    var clip   = Components.classes["@mozilla.org/widget/clipboard;1"].getService(clipid);
    if (!clip) return false;

    clip.setData(trans, null, clipid.kGlobalClipboard);

  /*
    if (inElement.createTextRange) {
      var range = inElement.createTextRange();
      if (range && BodyLoaded==1)
       range.execCommand('Copy');
    } else {
      var flashcopier = 'flashcopier';
      if(!document.getElementById(flashcopier)) {
        var divholder = document.createElement('div');
        divholder.id = flashcopier;
        document.body.appendChild(divholder);
      }
      document.getElementById(flashcopier).innerHTML = '';

      var divinfo = '<embed src="_clipboard.swf" FlashVars="clipboard='+escape(inElement.value)+'" width="0" height="0" type="application/x-shockwave-flash"></embed>';
      document.getElementById(flashcopier).innerHTML = divinfo;
    }
  */
  },

  data: function() {
    try {
      if (netscape.security.PrivilegeManager.enablePrivilege) {
        netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
      } else {
        return;
      }
    } catch (ex) {}

    var clip = Components.classes["@mozilla.org/widget/clipboard;1"].getService(Components.interfaces.nsIClipboard);
    if (!clip) return false;

    var trans = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);
    if (!trans) return false;
    trans.addDataFlavor("text/unicode");

    clip.getData(trans, clip.kGlobalClipboard);

    var str       = new Object();
    var strLength = new Object();
    var pastetext = "";

    trans.getTransferData("text/unicode", str, strLength);
    if (str) str = str.value.QueryInterface(Components.interfaces.nsISupportsString);
    if (str) pastetext = str.data.substring(0, strLength.value / 2);
    return pastetext;
  }

};

