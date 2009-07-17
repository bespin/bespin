
We are currently on mobwrite r70 with changes. The changes brought across from
mobwrite-41-with-bepsin are documented below


== Client diff.js ==

$ cp mobwrite/diff_match_patch_uncompressed.js frontend/js/bespin/mobwrite/diff.js
- Add "dojo.provide("bespin.mobwrite.diff");" to the start


== Client core.js ==

$ cp mobwrite/mobwrite_core.js frontend/js/bespin/mobwrite/core.js
- Apply the following patch

diff -u --strip-trailing-cr frontend/js/bespin/mobwrite_70/core.js frontend/js/bespin/mobwrite/mobwrite_core.js
--- frontend/js/bespin/mobwrite_fork_from_41/core.js    2009-07-08 10:05:31.000000000 +0100
+++ frontend/js/bespin/mobwrite_41/mobwrite_core.js 2009-07-08 11:47:03.000000000 +0100
@@ -1,7 +1,7 @@
 /**
  * MobWrite - Real-time Synchronization and Collaboration Service
  *
- * Copyright 2006 Neil Fraser
+ * Copyright 2006 Google Inc.
  * http://code.google.com/p/google-mobwrite/
  *
  * Licensed under the Apache License, Version 2.0 (the "License");
@@ -22,7 +22,6 @@
  * @author fraser@google.com (Neil Fraser)
  */
 
-dojo.provide("bespin.mobwrite.core");
 
 /**
  * Singleton class containing all MobWrite code.
@@ -34,7 +33,7 @@
  * URL of Ajax gateway.
  * @type {string}
  */
-mobwrite.syncGateway = '/mobwrite/';
+mobwrite.syncGateway = '/scripts/q.py';
 
 
 /**
@@ -48,7 +47,7 @@
  * Print diagnostic messages to the browser's console.
  * @type {boolean}
  */
-mobwrite.debug = false;
+mobwrite.debug = true;
 
 
 // Debug mode requires a compatible console.
@@ -114,7 +113,7 @@
  * Shortest interval (in milliseconds) between connections.
  * @type {number}
  */
-mobwrite.minSyncInterval = 500;
+mobwrite.minSyncInterval = 1000;
 
 
 /**
@@ -129,7 +128,7 @@
  * This value is modified later as traffic rates are established.
  * @type {number}
  */
-mobwrite.syncInterval = 1000;
+mobwrite.syncInterval = 2000;
 
 
 /**
@@ -380,7 +379,9 @@
   }
 
   var remote = (mobwrite.syncGateway.indexOf('://') != -1);
-  if (mobwrite.debug) {
+  if (mobwrite.debug && typeof console == 'object') {
+    // Extra check here for the existance of 'console' because
+    // the console disappears on page unload before the code does.
     console.info('TO server:\n' + data.join(''));
   }
   // Add terminating blank line.
@@ -608,9 +609,6 @@
           }
         }
       }
-    } else if (name == 'C' || name == 'c') {
-      var users = value.split(",");
-      file._editSession.reportCollaborators(users);
     }
   }
 
@@ -619,7 +617,7 @@
     mobwrite.syncInterval /= 2;
   } else {
     // Let the ping interval creep up.
-    mobwrite.syncInterval += 500;
+    mobwrite.syncInterval += 1000;
   }
   // Keep the syncs constrained between 1 and 10 seconds.
   mobwrite.syncInterval =
@@ -682,7 +680,7 @@
       try {
         req = new ActiveXObject('Microsoft.XMLHTTP');
       } catch(e) {
-        req = null;
+       req = null;
       }
     }
   }
@@ -690,10 +688,6 @@
     req.onreadystatechange = callback;
     req.open('POST', url, true);
     req.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
-
-    // CSRF protection as defined by Bespin
-    bespin.get("server").protectXhrAgainstCsrf(req);
-
     req.send(post);
   }
   return req;
@@ -772,4 +766,3 @@
     }
   }
 };
-

== Other client files ==

- integrate.js is a replacement for form.js
    form.js is not needed by bespin, integrate.js is Mozilla code


== Server mobwrite_daemon.py ==

> cp daemon/mobwrite_daemon.py backend/python/bespin/mobwrite/mobwrite_daemon.py
- Apply the following patch:

--- ../../mobwrite/trunk/daemon/mobwrite_daemon.py  2009-07-08 12:02:59.000000000 +0100
+++ backend/python/bespin/mobwrite/mobwrite_daemon.py   2009-07-09 15:10:04.000000000 +0100
@@ -47,10 +47,8 @@
 MEMORY = 0
 FILE = 1
 BDB = 2
-STORAGE_MODE = MEMORY
-
-# Relative location of the data directory.
-DATA_DIR = "./data"
+PERSISTER = 3
+STORAGE_MODE = PERSISTER
 
 # Port to listen on.
 LOCAL_PORT = 3017
@@ -78,7 +76,7 @@
 
   # Object properties:
   # .lock - Access control for writing to the text on this object.
-  # .views - Count of views currently connected to this text.
+  # .views - Views currently connected to this text.
   # .lasttime - The last time that this text was modified.
 
   # Inerhited properties:
@@ -89,7 +87,8 @@
   def __init__(self, *args, **kwargs):
     # Setup this object
     mobwrite_core.TextObj.__init__(self, *args, **kwargs)
-    self.views = 0
+    self.persister = kwargs.get("persister")
+    self.views = []
     self.lasttime = datetime.datetime.now()
     self.lock = thread.allocate_lock()
     self.load()
@@ -106,7 +105,7 @@
 
   def cleanup(self):
     # General cleanup task.
-    if self.views > 0:
+    if len(self.views) > 0:
       return
     terminate = False
     # Lock must be acquired to prevent simultaneous deletions.
@@ -164,6 +163,10 @@
         self.setText(None)
       self.changed = False
 
+    if STORAGE_MODE == PERSISTER:
+      contents = self.persister.load(self.name);
+      self.setText(contents)
+      self.changed = False
 
   def save(self):
     # Save the text object to non-volatile storage.
@@ -205,8 +208,12 @@
         lasttime_db[self.name] = str(int(time.time()))
       self.changed = False
 
+    if STORAGE_MODE == PERSISTER:
+      self.persister.save(self.name, self.text)
+      self.changed = False
+
 
-def fetch_textobj(name, view):
+def fetch_textobj(name, view, persister):
   # Retrieve the named text object.  Create it if it doesn't exist.
   # Add the given view into the text object's list of connected views.
   # Don't let two simultaneous creations happen, or a deletion during a
@@ -216,9 +223,9 @@
     textobj = texts[name]
     mobwrite_core.LOG.debug("Accepted text: '%s'" % name)
   else:
-    textobj = TextObj(name=name)
+    textobj = TextObj(name=name, persister=persister)
     mobwrite_core.LOG.debug("Creating text: '%s'" % name)
-  textobj.views += 1
+  textobj.views.append(view)
   lock_texts.release()
   return textobj
 
@@ -251,10 +258,11 @@
   def __init__(self, *args, **kwargs):
     # Setup this object
     mobwrite_core.ViewObj.__init__(self, *args, **kwargs)
+    self.handle = kwargs.get("handle")
     self.edit_stack = []
     self.lasttime = datetime.datetime.now()
     self.lock = thread.allocate_lock()
-    self.textobj = fetch_textobj(self.filename, self)
+    self.textobj = fetch_textobj(self.filename, self, kwargs.get("persister"))
 
     # lock_views must be acquired by the caller to prevent simultaneous
     # creations of the same view.
@@ -274,7 +282,7 @@
         del views[(self.username, self.filename)]
       except KeyError:
         mobwrite_core.LOG.error("View object not in view list: '%s %s'" % (self.username, self.filename))
-      self.textobj.views -= 1
+      self.textobj.views.remove(self)
     lock_views.release()
 
   def nullify(self):
@@ -282,7 +290,7 @@
     self.cleanup()
 
 
-def fetch_viewobj(username, filename):
+def fetch_viewobj(username, filename, handle, persister):
   # Retrieve the named view object.  Create it if it doesn't exist.
   # Don't let two simultaneous creations happen, or a deletion during a
   # retrieval.
@@ -297,7 +305,7 @@
       viewobj = None
       mobwrite_core.LOG.critical("Overflow: Can't create new view.")
     else:
-      viewobj = ViewObj(username=username, filename=filename)
+      viewobj = ViewObj(username=username, filename=filename, handle=handle, persister=persister)
       mobwrite_core.LOG.debug("Creating view: '%s@%s'" % key)
   lock_views.release()
   return viewobj
@@ -375,6 +383,9 @@
 
 class DaemonMobWrite(SocketServer.StreamRequestHandler, mobwrite_core.MobWrite):
 
+  def __init__(self, persister):
+      self.persister = persister
+
   def feedBuffer(self, name, size, index, datum):
     """Add one block of text to the buffer and return the whole text if the
       buffer is complete.
@@ -439,7 +450,9 @@
       data.append(line)
       if not line.rstrip("\r\n"):
         # Terminate and execute on blank line.
-        self.wfile.write(self.handleRequest("".join(data)))
+        question = "".join(data)
+        answer = self.handleRequest(question)
+        self.wfile.write(answer)
         break
 
     # Goodbye
@@ -463,7 +476,7 @@
 
       # Fetch the requested view object.
       if not viewobj:
-        viewobj = fetch_viewobj(action["username"], action["filename"])
+        viewobj = fetch_viewobj(action["username"], action["filename"], action["handle"], self.persister)
         if viewobj == None:
           # Too many views connected at once.
           # Send back nothing.  Pretend the return packet was lost.
@@ -574,7 +587,15 @@
         viewobj.lock.release()
         viewobj = None
 
-    return "".join(output)
+    if action["echo_collaborators"]:
+      collaborators = set([view.handle for view in texts[action["filename"]].views])
+      #collaborators -= actions["handle"]
+      line = "C:" + (",".join(collaborators))
+      output.append(line)
+
+    answer = "".join(output)
+
+    return answer
 
 
   def generateDiffs(self, viewobj, last_username, last_filename,
@@ -644,6 +665,11 @@
     import bsddb
 
   while True:
+    cleanup()
+    time.sleep(60)
+
+# Left at double initial indent to help diff
+def cleanup():
     mobwrite_core.LOG.info("Running cleanup task.")
     for v in views.values():
       v.cleanup()
@@ -675,7 +701,42 @@
           del lasttime_db[k]
         mobwrite_core.LOG.info("Deleted from DB: '%s'" % k)
 
-    time.sleep(60)
+last_cleanup = time.time()
+
+def maybe_cleanup():
+  global last_cleanup
+  now = time.time()
+  if now > last_cleanup + 60:
+    cleanup()
+    last_cleanup = now
+
+class Persister:
+
+  def load(self, name):
+    project, path = self.__decomposeName(name)
+    print "loading from: %s/%s" % (project.name, path)
+    return project.get_file(path)
+
+  def save(self, name, contents):
+    project, path = self.__decomposeName(name)
+    print "saving to: %s/%s" % (project.name, path)
+    project.save_file(path, contents)
+
+  def __decomposeName(self, name):
+    from bespin.database import User, get_project
+    (user_name, project_name, path) = name.split("/", 2)
+
+    user = User.find_user(user_name)
+
+    parts = project_name.partition('+')
+    if parts[1] == '':
+      owner = user
+    else:
+      owner = User.find_user(parts[0])
+      project_name = parts[2]
+
+    project = get_project(user, owner, project_name)
+    return (project, path)
 
 
 def main():


== Server mobwrite_core.py ==

> cp lib/mobwrite_core.py backend/python/bespin/mobwrite/mobwrite_core.py
- Apply the following patch:

--- ../../mobwrite/trunk/lib/mobwrite_core.py   2009-07-08 12:02:59.000000000 +0100
+++ backend/python/bespin/mobwrite/mobwrite_core.py 2009-07-09 13:38:36.000000000 +0100
@@ -33,7 +33,7 @@
 
 # Demo usage should limit the maximum size of any text.
 # Set to 0 to disable limit.
-MAX_CHARS = 20000
+MAX_CHARS = 0
 
 # Delete any view which hasn't been accessed in half an hour.
 TIMEOUT_VIEW = datetime.timedelta(minutes=30)
@@ -138,8 +138,10 @@
     actions = []
     username = None
     filename = None
+    handle = None
     server_version = None
     echo_username = False
+    echo_collaborators = False
     for line in data.splitlines():
       if not line:
         # Terminate on blank line.
@@ -188,6 +190,12 @@
         # Client may request explicit usernames in response.
         echo_username = (name == "U")
 
+      elif name == "h" or name == "H":
+        # Remember the username.
+        handle = value
+        # Client may request explicit collaborator handles in response.
+        echo_collaborators = (name == "H")
+
       elif name == "f" or name == "F":
         # Remember the filename and version.
         filename = value
@@ -219,12 +227,16 @@
         action["server_version"] = server_version
         action["client_version"] = version
         action["data"] = value
+        action["handle"] = handle
         action["echo_username"] = echo_username
+        action["echo_collaborators"] = echo_collaborators
         if username and filename and action["mode"]:
           action["username"] = username
           action["filename"] = filename
           actions.append(action)
-
+        else:
+          LOG.warning("Skipping " + str(action) + ": username=" + str(username) + ", filename=" + str(filename) + ", action[mode]=" + str(action["mode"]))
+ 
     return actions
 
 

- Also the following patch from mobwrite-r41-with-bespin to mobwrite-r41 was not copied across when
  we merged with mobwrite-r70. We might need to re-instante this later:

--- backend/python/bespin/mobwrite-41/mobwrite_daemon.py    2009-07-08 11:47:03.000000000 +0100
+++ backend/python/bespin/mobwrite_fork_from_41/mobwrite_daemon.py  2009-06-02 09:30:57.000000000 +0100
@@ -98,9 +107,9 @@
     # Keep the text within the length limit.
     if MAX_CHARS != 0 and len(text) > MAX_CHARS:
        text = text[-MAX_CHARS:]
-       logging.warning("Truncated text to %d characters." % MAX_CHARS)
-    # Normalize linebreaks to LF.
-    text = re.sub(r"(\r\n|\r|\n)", "\n", text)
+       log.warning("Truncated text to %d characters." % MAX_CHARS)
+    # Normalize linebreaks to CRLF.
+    text = re.sub(r"(\r\n|\r|\n)", "\r\n", text)
     if (self.text != text):
       self.text = text
       self.changed = True


== Server diff_match_patch.py ==

$ cp mobwrite/lib/diff_match_patch.py bespin/backend/python/bespin/mobwrite/diff_match_patch.py
- No changes except:
- We originally set self.Match_MaxBits to 0 rather than 32. When we updated to r70, we left it at 32
    I'm not sure there was much detailed logic behind the original change, but if it produces poor
    patches, then this might be a place to look.



== Other server files ==

- __init__.py is from Bespin not from mobwrite


