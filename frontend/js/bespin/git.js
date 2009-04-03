
dojo.provide("bespin.git");

dojo.require("bespin.util.webpieces");
dojo.require("bespin.cmd.commands");

bespin.cmd.commands.add({
  name: 'git',
  // takes: ['action ...'],
  takes: ['*'],
  //  type: [Bespin.Commands.Editor, Bespin.Commands.Dashboard],
  preview: 'git stuff',
  execute: function(self, args) {
    //  args = bespin.cmd.commands.toArgArray(args);
    //  action = args.shift()
    var project;
    var filename;
    var action = args.varargs[0];


    // default to what you have
    bespin.withComponent('editSession', function(editSession) {
      project = editSession.project;
      filename = editSession.path;
    });

    if (!action) action = "help";

    if (!project && action != "clone" && action != "help") {
      bespin.publish("message",
                     {msg: "You need be in a project"});
      return;
    }
    var cmd = { command: args.varargs, filename: filename || null, project: project || null};
    bespin.publish("git:command", cmd);

    return;
  }

});

// ** {{{ Event: bespin:git:command }}} **
// Handle a git version control system command
bespin.subscribe("git:command", function(event) {

  var command = event.command;
  var filename = event.filename;
  var project = event.project;
  var action = command[0];
  var git = bespin.get('git-server');

  console.debug("git command: " + command);
  var opts = {
    evalJSON: true,
    call: function(e) { this.onSuccess(e); },
    onSuccess: function(response) {
      if (response && response["output"] && response["output"].length > 0)
        bespin.publish("vcs:response", response);
    },
    onFailure: function(xhr) {
      bespin.publish("message", {
        msg: "Failed. Maybe due to: " + xhr.responseText });
    }
  }
  var get_commands = [
    "diff", "grep", "help", "log", "shortlog", "show", "status", "settings"
  ];
  var post_commands = [
    "add", "bisect", "branch", "checkout", "clone", "commit",
    "fetch", "init", "merge", "mv", "pull",
    "push", "rebase", "remote", "reset", "rm", "stash", "submodule", "tag",
    // special
    "rebase_interactive", // for continuing an interactive rebase
    "make_private", "make_public"
  ];


  if (action == "commit" && (command.indexOf("-m") == -1) && !event.message) {
    console.debug("plain commit command");
    event.command[0] = "status"
    opts.onSuccess = function(data) {
      if (data.output.indexOf("no changes added to commit") != -1) {
        bespin.publish("vcs:response", data);
      } else {
        git.showCommitDialog(event, data);
      }
    }
    git.run_post(project, event, opts);
  } else if (action == "rebase" &&
             (command.indexOf("-i") != -1 || command.indexOf("--interactive") != -1)) {
    opts.onSuccess = function(data) {
      if (data.todo) {
        git.rebaseInteractive(event, data);
      } else {
        bespin.publish("vcs:response", data);
      }
    }
    git.run_post(project, event, opts);
  } else if (action == "log" && command.length == 1) {
    opts.onSuccess = function(data) {
      git.showLogViewer(event, data);
    };
    git.run_post(project, event, opts);

  } else if (action == "clone") {
    var notifier = opts.onSuccess;
    opts.onSuccess = function(data) {
      bespin.publish("project:create", {});
      notifier(data);
    };
    git.run_post(project, event, opts);

  } else if (get_commands.indexOf(action) != -1) {
    git.run_post(project, event, opts);      // FIXME: run_get

  } else if (post_commands.indexOf(action) != -1) {
    git.run_post(project, event, opts);

  } else {
    bespin.publish("message",
                   { msg: "Unknown action: " + action });
  };
});

dojo.declare("bespin.git.server", null, {
  request: function(a, b, c, d) {
    bespin.get('server').request(a, b, c, d || {});
  },

  run_post: function(project, command, opts) {
    var url = bespin.util.path.combine('/git/run', project);
    this.request('POST', url, dojo.toJson(command), opts);
  },
/*
  rebase_interactive: function(project, path, args, opts) {
    var url = bespin.util.path.combine('/git/rebase_i', project);
    this.request('POST', url, dojo.toJson(args), opts);
  },
*/

  /* helpers */
  showCommitDialog: function(event, data) {

    var el = dojo.byId('centerpopup');
    var me = this;

    el.innerHTML = "<div id='commit-container'>" +
      "<form method='POST' name='commit' id='commit'>" +
      "<div id='commit-header'>Commit message: " +
      "<img id='commit-dialog-close' src='images/icn_close_x.png' align='right'>" +
      "</div>" +
      "<div id='commmit-content'><div id='commit-status'></div>" +
      "<center><input id='commit-submit' type='button' value='Commit'>" +
      "<textarea name='commit-message' id='commit-message' rows='10' cols='74'>" +
      "Will someone please design a decent commit dialog?\n" +
      data.output +
      "</textarea></center></div></form></div>";

    dojo.require("dijit._base.place");
    dojo.require("bespin.util.webpieces");

    // HACK! Backspace still doesn't work!
    var editor = bespin.get('editor')
    if (editor) editor.editorKeyListener.handleKeys = false;
/*
     var lambda = function(e) {
       bespin.get('editor').editorKeyListener.skipKeypress = true;
       dojo.stopEvent(e);
     };
     var textarea = dojo.byId("commit-message");
     //textarea.addEventListener("keydown", lambda, true);
     //dojo.connect(, "onkeypress", null,
*/
    var closer = function() {
      bespin.util.webpieces.hideCenterPopup(el);
      var editor = bespin.get('editor')
      if (editor) editor.editorKeyListener.handleKeys = true;
    }
    dojo.connect(dojo.byId('commit-submit'), "click", function() {
      var msg = dojo.byId("commit-message").value;
      // TODO: allow checkbox to add --amend
      event.message = msg;
      event.command[0] = "commit";
      bespin.publish("git:command", event);
      closer();
    });
    bespin.util.webpieces.showCenterPopup(el);


    dojo.byId("overlay").onclick = dojo.byId("commit-dialog-close").onclick = function() {
      closer();
    };
  },

  showLogViewer: function(event, data) {
    var el = dojo.byId('centerpopup');
    var me = this;

    var content = dojo.byId('log-content');
    if (!content) {
      el.innerHTML = "<div id='log-container'><div id='log-header'>Commits: <img id='log-viewer-close' src='images/icn_close_x.png' align='right'></div><div id='log-content'></div><span id='log-prev'>prev </span><span id='log-next'>next</span></div>";
      content = dojo.byId('log-content')
    }

    dojo.require("dijit._base.place");
    dojo.require("bespin.util.webpieces");

    dojo.require("dojox.dtl._Templated");
    dojo.require("dojox.dtl.Context");
    var template = new dojox.dtl.Template(
      "<div>commit {{ sha }}</div>" +
      "<div>Author: {{ author }}</div>" +
      "<div>Date: {{ date }}</div><br>" +
      "<div>{{ msg }}</div><br>");
/*
    var c = dojo.declare("Commits", [dijit._Widget, dojox.dtl._Templated] {
      templateString: "<div>I like eating {{ commit }}</div>",
      addItems: function(items) {
        this.commit = "apple";
        this.render();
      },
      postCreate: function(){
        this.commit = "banana";
        this.render();
      }
    });
    dojo.require("dojo.parser");
*/
    var html = "";
    data.commits.forEach(function(c) {
      var context = new dojox.dtl.Context(c);
      html += template.render(context);
    });
    content.innerHTML = html;

    dojo.byId('log-prev').onclick = function() {
      event.skip = data.skip - 5;
      bespin.publish("git:command", event);
    };
    dojo.byId('log-next').onclick = function() {
      event.skip = data.skip + 5;
      bespin.publish("git:command", event);
    }

    bespin.util.webpieces.showCenterPopup(el);

    var closer = function() {
      bespin.util.webpieces.hideCenterPopup(el);
    }
    dojo.byId("overlay").onclick = dojo.byId("log-viewer-close").onclick = function() {
      closer();
    };
  },

  rebaseInteractive: function(event, data) {
    var el = dojo.byId('centerpopup');
    var me = this;

    el.innerHTML = "<div id='rebase-container'><form method='POST' name='rebase' id='rebase'><div id='rebase-header'>Commit messages: <img id='rebase-dialog-close' src='images/icn_close_x.png' align='right'></div><div id='rebase-content'><div id='rebase-status'></div><center><input id='rebase-submit' type='button' value='Rebase'><textarea name='rebase-message' id='rebase-message' rows='10' cols='72'>rebase message</textarea></center></div></form></div>";

    dojo.byId("rebase-message").value = data.todo;

    dojo.require("dijit._base.place");
    dojo.require("bespin.util.webpieces");

    var closer = function() {
      bespin.util.webpieces.hideCenterPopup(el);
      var editor = bespin.get('editor')
      if (editor) editor.editorKeyListener.handleKeys = true;
    }
    // FIXME: close without submit should git rebase --abort
    dojo.connect(dojo.byId('rebase-submit'), "click", function() {
      var msg = dojo.byId("rebase-message").value;
      event.todo = msg;
      event.command = ["rebase_interactive"]
      bespin.publish("git:command", event);
      closer();
    });

    var editor = bespin.get('editor')
    if (editor) editor.editorKeyListener.handleKeys = false;
    bespin.util.webpieces.showCenterPopup(el);
    dojo.byId("overlay").onclick = dojo.byId("rebase-dialog-close").onclick = function() {
      closer();
    };
  }

});

bespin.register('git-server', new bespin.git.server());
