//  ***** BEGIN LICENSE BLOCK *****
// Version: MPL 1.1
// 
// The contents of this file are subject to the Mozilla Public License  
// Version
// 1.1 (the "License"); you may not use this file except in compliance  
// with
// the License. You may obtain a copy of the License at
// http://www.mozilla.org/MPL/
// 
// Software distributed under the License is distributed on an "AS IS"  
// basis,
// WITHOUT WARRANTY OF ANY KIND, either express or implied. See the  
// License
// for the specific language governing rights and limitations under the
// License.
// 
// The Original Code is Bespin.
// 
// The Initial Developer of the Original Code is Mozilla.
// Portions created by the Initial Developer are Copyright (C) 2009
// the Initial Developer. All Rights Reserved.
// 
// Contributor(s):
// 
// ***** END LICENSE BLOCK *****
// 

// -- Firefox only right now

var Clipboard = {
  copy: function(copytext) {
    try {
      if (netscape.security.PrivilegeManager.enablePrivilege) {
        netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
      } else {
        return;
      }
    } catch (ex) {
        console.log(ex);
        return;
    }

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
    } catch (ex) {
        console.log(ex);
        return;
    }

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

