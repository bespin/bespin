      // - Global Constants
      var COMMAND_LINE_HEIGHT = 95;

      // -- Globals
      var _editor;
      var _editSession;
      var _commandLine;
      var _files;
      var _settings;
      var _server;

      var _showCollab = false;
      var _showFiles = false;
      var _showTarget = false;

      var _showCollabHotCounter = 0;

      Element.observe(window, 'load', function() {	
          _editor      = new Editor($('editor'));
          _editSession = new EditSession(_editor);
          _server      = new Server();
          _settings    = new Settings();
          _files       = new FileSystem();
          _commandLine = new CommandLine($('command'), _files, _settings, _editor);

          _editor.setFocus(true);

		  document.observe("bespin:settings:loaded", function(event) {
			_settings.loadSession();  // load the last file or what is passed in
          	doResize();
		  });
		
          var collab = $("collaboration");
          Element.observe(collab, 'click', function() {
              _showCollab = !_showCollab;
              collab.src = "images/" + ( (_showCollab) ? "icn_collab_on.png" : (_showCollabHotCounter == 0) ? "icn_collab_off.png" : "icn_collab_watching.png" );
              recalcLayout();
          });

          var files = $("btn_files");
          Element.observe(files, 'click', function() {
              _showFiles = !_showFiles;
              files.src = "images/" + ( (_showFiles) ? "icn_files_on.png" : "icn_files_off.png" );
              recalcLayout();
          });

          var target = $("btn_browser");
          Element.observe(target, 'click', function() {
              _showTarget = !_showTarget;
              target.src = "images/" + ( (_showTarget) ? "icn_target_on.png" : "icn_target_off.png" );
              recalcLayout();
          });

          // -- Track the under and redo button clicks
          Element.observe($("undo"), 'mousedown', function() {
              $("undo").src = "images/icn_undo_on.png";
          });

          Element.observe($("undo"), 'mouseup', function() {
              $("undo").src = "images/icn_undo.png";
          });

          Element.observe($("undo"), 'click', function() {
              _editor.ui.actions.undo();
          });

          Element.observe($("redo"), 'mousedown', function() {
              $("redo").src = "images/icn_redo_on.png";
          });

          Element.observe($("redo"), 'mouseup', function() {
              $("redo").src = "images/icn_redo.png";
          });

          Element.observe($("redo"), 'click', function() {
              _editor.ui.actions.redo();
          });

	      Element.observe(window, 'resize', doResize);
      });

      function recalcLayout() {
          var subheader = $("subheader");
          var footer = $("footer");
          var editor = $("editor");
          var files = $("files");
          var collab = $("collab");
          var target = $("target_browsers");

          var move = [ subheader, footer, editor ];

          if (_showFiles) {
              files.style.display = "block";
              move.each(function(item) { item.style.left = "201px" });
          } else {
              files.style.display = "none";
              move.each(function(item) { item.style.left = "0" });
          }

          move.pop();   // ed shouldn't have its right-hand side set

          if (_showCollab) {
              collab.style.display = "block";
              move.each(function(item) { item.style.right = "201px" });
          } else {
              collab.style.display = "none";
              move.each(function(item) { item.style.right = "0" });
          }

          if (_showTarget) {
              target.style.display = "block";
          } else {
              target.style.display = "none";
          }

          doResize();
      }

      function doResize() {
          var left = $("subheader").style.left;
          left = (left != "") ? parseInt(left) : 0;
          var right = $("subheader").style.right;
          right = (right != "") ? parseInt(right) : 0;

          Element.writeAttribute($('editor'), {
            width: window.innerWidth - left - right,
            height: window.innerHeight - COMMAND_LINE_HEIGHT
          });

          _editor.paint();
      }