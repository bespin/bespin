#!/usr/bin/python
"""MobWrite - Real-time Synchronization and Collaboration Service

Copyright 2006 Google Inc.
http://code.google.com/p/google-mobwrite/

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

"""This file is the server-side daemon.

Runs in the background listening to a port, accepting synchronization sessions
from clients.
"""

__author__ = "fraser@google.com (Neil Fraser)"

import datetime
import glob
import os
import socket
import SocketServer
import sys
import time
import thread
import urllib

sys.path.insert(0, "lib")
import mobwrite_core
del sys.path[0]

# Demo usage should limit the maximum number of connected views.
# Set to 0 to disable limit.
MAX_VIEWS = 10000

# How should data be stored.
MEMORY = 0
FILE = 1
BDB = 2
STORAGE_MODE = MEMORY

# Relative location of the data directory.
DATA_DIR = "./data"

# Port to listen on.
LOCAL_PORT = 3017

# If the Telnet connection stalls for more than 2 seconds, give up.
TIMEOUT_TELNET = 2.0

# Restrict all Telnet connections to come from this location.
# Set to "" to allow connections from anywhere.
CONNECTION_ORIGIN = "127.0.0.1"

# Dictionary of all text objects.
texts = {}

# Berkeley Databases
texts_db = None
lasttime_db = None

# Lock to prevent simultaneous changes to the texts dictionary.
lock_texts = thread.allocate_lock()


class TextObj(mobwrite_core.TextObj):
  # A persistent object which stores a text.

  # Object properties:
  # .lock - Access control for writing to the text on this object.
  # .views - Count of views currently connected to this text.
  # .lasttime - The last time that this text was modified.

  # Inerhited properties:
  # .name - The unique name for this text, e.g 'proposal'.
  # .text - The text itself.
  # .changed - Has the text changed since the last time it was saved.

  def __init__(self, *args, **kwargs):
    # Setup this object
    mobwrite_core.TextObj.__init__(self, *args, **kwargs)
    self.views = 0
    self.lasttime = datetime.datetime.now()
    self.lock = thread.allocate_lock()
    self.load()

    # lock_texts must be acquired by the caller to prevent simultaneous
    # creations of the same text.
    assert lock_texts.locked(), "Can't create TextObj unless locked."
    global texts
    texts[self.name] = self

  def setText(self, newText):
    mobwrite_core.TextObj.setText(self, newText)
    self.lasttime = datetime.datetime.now()

  def cleanup(self):
    # General cleanup task.
    if self.views > 0:
      return
    terminate = False
    # Lock must be acquired to prevent simultaneous deletions.
    self.lock.acquire()
    if STORAGE_MODE == MEMORY:
      if self.lasttime < datetime.datetime.now() - mobwrite_core.TIMEOUT_TEXT:
        mobwrite_core.LOG.info("Expired text: '%s'" % self.name)
        terminate = True
    else:
      # Delete myself from memory if there are no attached views.
      mobwrite_core.LOG.info("Unloading text: '%s'" % self.name)
      terminate = True

    if terminate:
      # Save to disk/database.
      self.save()
      # Terminate in-memory copy.
      global texts
      lock_texts.acquire()
      try:
        del texts[self.name]
      except KeyError:
        mobwrite_core.LOG.error("Text object not in text list: '%s'" % self.name)
      lock_texts.release()
    else:
      if self.changed:
        self.save()
      self.lock.release()


  def load(self):
    # Load the text object from non-volatile storage.
    if STORAGE_MODE == FILE:
      # Load the text (if present) from disk.
      filename = "%s/%s.txt" % (DATA_DIR, urllib.quote(self.name, ""))
      if os.path.exists(filename):
        try:
          infile = open(filename, "r")
          self.setText(infile.read().decode("utf-8"))
          infile.close()
          self.changed = False
          mobwrite_core.LOG.info("Loaded file: '%s'" % filename)
        except:
          mobwrite_core.LOG.critical("Can't read file: %s" % filename)
      else:
        self.setText(None)
        self.changed = False

    if STORAGE_MODE == BDB:
      # Load the text (if present) from database.
      if texts_db.has_key(self.name):
        self.setText(texts_db[self.name].decode("utf-8"))
        mobwrite_core.LOG.info("Loaded from DB: '%s'" % self.name)
      else:
        self.setText(None)
      self.changed = False


  def save(self):
    # Save the text object to non-volatile storage.
    # Lock must be acquired by the caller to prevent simultaneous saves.
    assert self.lock.locked(), "Can't save unless locked."

    if STORAGE_MODE == FILE:
      # Save the text to disk.
      filename = "%s/%s.txt" % (DATA_DIR, urllib.quote(self.name, ''))
      if self.text == None:
        # Nullified text equates to no file.
        if os.path.exists(filename):
          try:
            os.remove(filename)
            mobwrite_core.LOG.info("Nullified file: '%s'" % filename)
          except:
            mobwrite_core.LOG.critical("Can't nullify file: %s" % filename)
      else:
        try:
          outfile = open(filename, "w")
          outfile.write(self.text.encode("utf-8"))
          outfile.close()
          self.changed = False
          mobwrite_core.LOG.info("Saved file: '%s'" % filename)
        except:
          mobwrite_core.LOG.critical("Can't save file: %s" % filename)

    if STORAGE_MODE == BDB:
      # Save the text to database.
      if self.text == None:
        if lasttime_db.has_key(self.name):
          del lasttime_db[self.name]
        if texts_db.has_key(self.name):
          del texts_db[self.name]
          mobwrite_core.LOG.info("Nullified from DB: '%s'" % self.name)
      else:
        mobwrite_core.LOG.info("Saved to DB: '%s'" % self.name)
        texts_db[self.name] = self.text.encode("utf-8")
        lasttime_db[self.name] = str(int(time.time()))
      self.changed = False


def fetch_textobj(name, view):
  # Retrieve the named text object.  Create it if it doesn't exist.
  # Add the given view into the text object's list of connected views.
  # Don't let two simultaneous creations happen, or a deletion during a
  # retrieval.
  lock_texts.acquire()
  if texts.has_key(name):
    textobj = texts[name]
    mobwrite_core.LOG.debug("Accepted text: '%s'" % name)
  else:
    textobj = TextObj(name=name)
    mobwrite_core.LOG.debug("Creating text: '%s'" % name)
  textobj.views += 1
  lock_texts.release()
  return textobj


# Dictionary of all view objects.
views = {}

# Lock to prevent simultaneous changes to the views dictionary.
lock_views = thread.allocate_lock()

class ViewObj(mobwrite_core.ViewObj):
  # A persistent object which contains one user's view of one text.

  # Object properties:
  # .edit_stack - List of unacknowledged edits sent to the client.
  # .lasttime - The last time that a web connection serviced this object.
  # .lock - Access control for writing to the text on this object.
  # .textobj - The shared text object being worked on.

  # Inerhited properties:
  # .username - The name for the user, e.g 'fraser'
  # .filename - The name for the file, e.g 'proposal'
  # .shadow - The last version of the text sent to client.
  # .backup_shadow - The previous version of the text sent to client.
  # .shadow_client_version - The client's version for the shadow (n).
  # .shadow_server_version - The server's version for the shadow (m).
  # .backup_shadow_server_version - the server's version for the backup
  #     shadow (m).

  def __init__(self, *args, **kwargs):
    # Setup this object
    mobwrite_core.ViewObj.__init__(self, *args, **kwargs)
    self.edit_stack = []
    self.lasttime = datetime.datetime.now()
    self.lock = thread.allocate_lock()
    self.textobj = fetch_textobj(self.filename, self)

    # lock_views must be acquired by the caller to prevent simultaneous
    # creations of the same view.
    assert lock_views.locked(), "Can't create ViewObj unless locked."
    global views
    views[(self.username, self.filename)] = self

  def cleanup(self):
    # General cleanup task.
    # Delete myself if I've been idle too long.
    # Don't delete during a retrieval.
    lock_views.acquire()
    if self.lasttime < datetime.datetime.now() - mobwrite_core.TIMEOUT_VIEW:
      mobwrite_core.LOG.info("Idle out: '%s@%s'" % (self.username, self.filename))
      global views
      try:
        del views[(self.username, self.filename)]
      except KeyError:
        mobwrite_core.LOG.error("View object not in view list: '%s %s'" % (self.username, self.filename))
      self.textobj.views -= 1
    lock_views.release()

  def nullify(self):
    self.lasttime = datetime.datetime.min
    self.cleanup()


def fetch_viewobj(username, filename):
  # Retrieve the named view object.  Create it if it doesn't exist.
  # Don't let two simultaneous creations happen, or a deletion during a
  # retrieval.
  lock_views.acquire()
  key = (username, filename)
  if views.has_key(key):
    viewobj = views[key]
    viewobj.lasttime = datetime.datetime.now()
    mobwrite_core.LOG.debug("Accepting view: '%s@%s'" % key)
  else:
    if MAX_VIEWS != 0 and len(views) > MAX_VIEWS:
      viewobj = None
      mobwrite_core.LOG.critical("Overflow: Can't create new view.")
    else:
      viewobj = ViewObj(username=username, filename=filename)
      mobwrite_core.LOG.debug("Creating view: '%s@%s'" % key)
  lock_views.release()
  return viewobj


# Dictionary of all buffer objects.
buffers = {}

# Lock to prevent simultaneous changes to the buffers dictionary.
lock_buffers = thread.allocate_lock()

class BufferObj:
  # A persistent object which assembles large commands from fragments.

  # Object properties:
  # .name - The name (and size) of the buffer, e.g. 'alpha:12'
  # .lasttime - The last time that a web connection wrote to this object.
  # .data - The contents of the buffer.
  # .lock - Access control for writing to the text on this object.

  def __init__(self, name, size):
    # Setup this object
    self.name = name
    self.lasttime = datetime.datetime.now()
    self.lock = thread.allocate_lock()

    # Initialize the buffer with a set number of slots.
    # Null characters form dividers between each slot.
    array = []
    for x in xrange(size - 1):
      array.append("\0")
    self.data = "".join(array)

    # lock_views must be acquired by the caller to prevent simultaneous
    # creations of the same view.
    assert lock_buffers.locked(), "Can't create BufferObj unless locked."
    global buffers
    buffers[name] = self
    mobwrite_core.LOG.debug("Buffer initialized to %d slots: %s" % (size, name))

  def set(self, n, text):
    # Set the nth slot of this buffer with text.
    assert self.lock.locked(), "Can't edit BufferObj unless locked."
    # n is 1-based.
    n -= 1
    array = self.data.split("\0")
    assert 0 <= n < len(array), "Invalid buffer insertion"
    array[n] = text
    self.data = "\0".join(array)
    mobwrite_core.LOG.debug("Inserted into slot %d of a %d slot buffer: %s" %
        (n + 1, len(array), self.name))

  def get(self):
    # Fetch the completed text from the buffer.
    if ("\0" + self.data + "\0").find("\0\0") == -1:
      text = self.data.replace("\0", "")
      # Delete this buffer.
      self.lasttime = datetime.datetime.min
      self.cleanup()
      return text
    # Not complete yet.
    return None

  def cleanup(self):
    # General cleanup task.
    # Delete myself if I've been idle too long.
    # Don't delete during a retrieval.
    lock_buffers.acquire()
    if self.lasttime < datetime.datetime.now() - mobwrite_core.TIMEOUT_BUFFER:
      mobwrite_core.LOG.info("Expired buffer: '%s'" % self.name)
      global buffers
      del buffers[self.name]
    lock_buffers.release()


class DaemonMobWrite(SocketServer.StreamRequestHandler, mobwrite_core.MobWrite):

  def feedBuffer(self, name, size, index, datum):
    """Add one block of text to the buffer and return the whole text if the
      buffer is complete.

    Args:
      name: Unique name of buffer object.
      size: Total number of slots in the buffer.
      index: Which slot to insert this text (note that index is 1-based)
      datum: The text to insert.

    Returns:
      String with all the text blocks merged in the correct order.  Or if the
      buffer is not yet complete returns the empty string.
    """
    # Note that 'index' is 1-based.
    if not 0 < index <= size:
      mobwrite_core.LOG.error("Invalid buffer: '%s %d %d'" % (name, size, index))
      text = ""
    elif size == 1 and index == 1:
      # A buffer with one slot?  Pointless.
      text = datum
      mobwrite_core.LOG.debug("Buffer with only one slot: '%s'" % name)
    else:
      # Retrieve the named buffer object.  Create it if it doesn't exist.
      name += "_%d" % size
      # Don't let two simultaneous creations happen, or a deletion during a
      # retrieval.
      lock_buffers.acquire()
      if buffers.has_key(name):
        bufferobj = buffers[name]
        bufferobj.lasttime = datetime.datetime.now()
        mobwrite_core.LOG.debug("Found buffer: '%s'" % name)
      else:
        bufferobj = BufferObj(name, size)
        mobwrite_core.LOG.debug("Creating buffer: '%s'" % name)
      bufferobj.lock.acquire()
      lock_buffers.release()
      bufferobj.set(index, datum)
      # Check if Buffer is complete.
      text = bufferobj.get()
      bufferobj.lock.release()
      if text == None:
        text = ""
    return urllib.unquote(text)


  def handle(self):
    self.connection.settimeout(TIMEOUT_TELNET)
    if CONNECTION_ORIGIN and self.client_address[0] != CONNECTION_ORIGIN:
      raise("Connection refused from " + self.client_address[0])
    mobwrite_core.LOG.info("Connection accepted from " + self.client_address[0])

    data = []
    # Read in all the lines.
    while 1:
      try:
        line = self.rfile.readline()
      except:
        # Timeout.
        mobwrite_core.LOG.warning("Timeout on connection")
        break
      data.append(line)
      if not line.rstrip("\r\n"):
        # Terminate and execute on blank line.
        self.wfile.write(self.handleRequest("".join(data)))
        break

    # Goodbye
    mobwrite_core.LOG.debug("Disconnecting.")


  def handleRequest(self, text):
    actions = self.parseRequest(text)
    return self.doActions(actions)

  def doActions(self, actions):
    output = []
    last_username = None
    last_filename = None
    viewobj = None

    for action_index in xrange(len(actions)):
      # Use an indexed loop in order to peek ahead one step to detect
      # username/filename boundaries.
      action = actions[action_index]

      # Fetch the requested view object.
      if not viewobj:
        viewobj = fetch_viewobj(action["username"], action["filename"])
        if viewobj == None:
          # Too many views connected at once.
          # Send back nothing.  Pretend the return packet was lost.
          return ""
        delta_ok = True
        viewobj.lock.acquire()
        textobj = viewobj.textobj

      if action["mode"] == "null":
        # Nullify the text.
        mobwrite_core.LOG.debug("Nullifying: '%s@%s'" %
            (viewobj.username, viewobj.filename))
        textobj.lock.acquire()
        textobj.setText(None)
        textobj.lock.release()
        viewobj.nullify();
        viewobj.lock.release()
        viewobj = None
        continue

      if (action["server_version"] != viewobj.shadow_server_version and
          action["server_version"] == viewobj.backup_shadow_server_version):
        # Client did not receive the last response.  Roll back the shadow.
        mobwrite_core.LOG.warning("Rollback from shadow %d to backup shadow %d" %
            (viewobj.shadow_server_version, viewobj.backup_shadow_server_version))
        viewobj.shadow = viewobj.backup_shadow
        viewobj.shadow_server_version = viewobj.backup_shadow_server_version
        viewobj.edit_stack = []

      # Remove any elements from the edit stack with low version numbers which
      # have been acked by the client.
      x = 0
      while x < len(viewobj.edit_stack):
        if viewobj.edit_stack[x][0] <= action["server_version"]:
          del viewobj.edit_stack[x]
        else:
          x += 1

      if action["mode"] == "raw":
        # It's a raw text dump.
        data = urllib.unquote(action["data"]).decode("utf-8")
        mobwrite_core.LOG.info("Got %db raw text: '%s@%s'" %
            (len(data), viewobj.username, viewobj.filename))
        delta_ok = True
        # First, update the client's shadow.
        viewobj.shadow = data
        viewobj.shadow_client_version = action["client_version"]
        viewobj.shadow_server_version = action["server_version"]
        viewobj.backup_shadow = viewobj.shadow
        viewobj.backup_shadow_server_version = viewobj.shadow_server_version
        viewobj.edit_stack = []
        if action["force"] or textobj.text == None:
          # Clobber the server's text.
          textobj.lock.acquire()
          if textobj.text != data:
            textobj.setText(data)
            mobwrite_core.LOG.debug("Overwrote content: '%s@%s'" %
                (viewobj.username, viewobj.filename))
          textobj.lock.release()

      elif action["mode"] == "delta":
        # It's a delta.
        mobwrite_core.LOG.info("Got '%s' delta: '%s@%s'" %
            (action["data"], viewobj.username, viewobj.filename))
        if action["server_version"] != viewobj.shadow_server_version:
          # Can't apply a delta on a mismatched shadow version.
          delta_ok = False
          mobwrite_core.LOG.warning("Shadow version mismatch: %d != %d" %
              (action["server_version"], viewobj.shadow_server_version))
        elif action["client_version"] > viewobj.shadow_client_version:
          # Client has a version in the future?
          delta_ok = False
          mobwrite_core.LOG.warning("Future delta: %d > %d" %
              (action["client_version"], viewobj.shadow_client_version))
        elif action["client_version"] < viewobj.shadow_client_version:
          # We've already seen this diff.
          pass
          mobwrite_core.LOG.warning("Repeated delta: %d < %d" %
              (action["client_version"], viewobj.shadow_client_version))
        else:
          # Expand the delta into a diff using the client shadow.
          try:
            diffs = mobwrite_core.DMP.diff_fromDelta(viewobj.shadow, action["data"])
          except ValueError:
            diffs = None
            delta_ok = False
            mobwrite_core.LOG.warning("Delta failure, expected %d length: '%s@%s'" %
                (len(viewobj.shadow), viewobj.username, viewobj.filename))
          viewobj.shadow_client_version += 1
          if diffs != None:
            # Textobj lock required for read/patch/write cycle.
            textobj.lock.acquire()
            self.applyPatches(viewobj, diffs, action)
            textobj.lock.release()

      # Generate output if this is the last action or the username/filename
      # will change in the next iteration.
      if ((action_index + 1 == len(actions)) or
          actions[action_index + 1]["username"] != viewobj.username or
          actions[action_index + 1]["filename"] != viewobj.filename):
        output.append(self.generateDiffs(viewobj,
                                         last_username, last_filename,
                                         action["echo_username"], action["force"],
                                         delta_ok))
        last_username = viewobj.username
        last_filename = viewobj.filename
        # Dereference the view object so that a new one can be created.
        viewobj.lock.release()
        viewobj = None

    return "".join(output)


  def generateDiffs(self, viewobj, last_username, last_filename,
                    echo_username, force, delta_ok):
    output = []
    if (echo_username and last_username != viewobj.username):
      output.append("u:%s\n" %  viewobj.username)
    if (last_filename != viewobj.filename or last_username != viewobj.username):
      output.append("F:%d:%s\n" %
          (viewobj.shadow_client_version, viewobj.filename))

    textobj = viewobj.textobj
    mastertext = textobj.text

    if delta_ok:
      if mastertext == None:
        mastertext = ""
      # Create the diff between the view's text and the master text.
      diffs = mobwrite_core.DMP.diff_main(viewobj.shadow, mastertext)
      mobwrite_core.DMP.diff_cleanupEfficiency(diffs)
      text = mobwrite_core.DMP.diff_toDelta(diffs)
      if force:
        # Client sending 'D' means number, no error.
        # Client sending 'R' means number, client error.
        # Both cases involve numbers, so send back an overwrite delta.
        viewobj.edit_stack.append((viewobj.shadow_server_version,
            "D:%d:%s\n" % (viewobj.shadow_server_version, text)))
      else:
        # Client sending 'd' means text, no error.
        # Client sending 'r' means text, client error.
        # Both cases involve text, so send back a merge delta.
        viewobj.edit_stack.append((viewobj.shadow_server_version,
            "d:%d:%s\n" % (viewobj.shadow_server_version, text)))
      viewobj.shadow_server_version += 1
      mobwrite_core.LOG.info("Sent '%s' delta: '%s@%s'" %
          (text, viewobj.username, viewobj.filename))
    else:
      # Error; server could not parse client's delta.
      # Send a raw dump of the text.
      viewobj.shadow_client_version += 1
      if mastertext == None:
        mastertext = ""
        viewobj.edit_stack.append((viewobj.shadow_server_version,
            "r:%d:\n" % viewobj.shadow_server_version))
        mobwrite_core.LOG.info("Sent empty raw text: '%s@%s'" %
            (viewobj.username, viewobj.filename))
      else:
        # Force overwrite of client.
        text = mastertext
        text = text.encode("utf-8")
        text = urllib.quote(text, "!~*'();/?:@&=+$,# ")
        viewobj.edit_stack.append((viewobj.shadow_server_version,
            "R:%d:%s\n" % (viewobj.shadow_server_version, text)))
        mobwrite_core.LOG.info("Sent %db raw text: '%s@%s'" %
            (len(text), viewobj.username, viewobj.filename))

    viewobj.shadow = mastertext

    for edit in viewobj.edit_stack:
      output.append(edit[1])

    return "".join(output)

def cleanup_thread():
  # Every minute cleanup
  if STORAGE_MODE == BDB:
    import bsddb

  while True:
    mobwrite_core.LOG.info("Running cleanup task.")
    for v in views.values():
      v.cleanup()
    for v in texts.values():
      v.cleanup()
    for v in buffers.values():
      v.cleanup()

    timeout = datetime.datetime.now() - mobwrite_core.TIMEOUT_TEXT
    if STORAGE_MODE == FILE:
      # Delete old files.
      files = glob.glob("%s/*.txt" % DATA_DIR)
      for filename in files:
        if datetime.datetime.fromtimestamp(os.path.getmtime(filename)) < timeout:
          os.unlink(filename)
          mobwrite_core.LOG.info("Deleted file: '%s'" % filename)

    if STORAGE_MODE == BDB:
      # Delete old DB records.
      # Can't delete an entry in a hash while iterating or else order is lost.
      expired = []
      for k, v in lasttime_db.iteritems():
        if datetime.datetime.fromtimestamp(int(v)) < timeout:
          expired.append(k)
      for k in expired:
        if texts_db.has_key(k):
          del texts_db[k]
        if lasttime_db.has_key(k):
          del lasttime_db[k]
        mobwrite_core.LOG.info("Deleted from DB: '%s'" % k)

    time.sleep(60)


def main():
  if STORAGE_MODE == BDB:
    import bsddb
    global texts_db, lasttime_db
    texts_db = bsddb.hashopen(DATA_DIR + "/texts.db")
    lasttime_db = bsddb.hashopen(DATA_DIR + "/lasttime.db")

  # Start up a thread that does timeouts and cleanup
  thread.start_new_thread(cleanup_thread, ())

  mobwrite_core.LOG.info("Listening on port %d..." % LOCAL_PORT)
  s = SocketServer.ThreadingTCPServer(("", LOCAL_PORT), DaemonMobWrite)
  try:
    s.serve_forever()
  except KeyboardInterrupt:
    mobwrite_core.LOG.info("Shutting down.")
    s.socket.close()
    if STORAGE_MODE == BDB:
      texts_db.close()
      lasttime_db.close()


if __name__ == "__main__":
  mobwrite_core.logging.basicConfig()
  main()
  mobwrite_core.logging.shutdown()
