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

import logging
import os.path
import socket
import SocketServer
import time
import thread
import urllib
import re
import sys
import diff_match_patch as dmp_module

# Demo usage should limit the maximum size of any text.
# Set to 0 to disable limit.
MAX_CHARS = 10000

# Demo usage should limit the maximum number of connected views.
# Set to 0 to disable limit.
MAX_VIEWS = 1000

# Relative location of the data directory.
DATA_DIR = "./data"

# Port to listen on.
LOCAL_PORT = 3017

# If the connection stalls for more than 2 seconds, give up.
TIMEOUT = 2.0

# Global Diff/Match/Patch object.
DMP = dmp_module.diff_match_patch()

# Choose from: CRITICAL, ERROR, WARNING, INFO, DEBUG
logging.getLogger().setLevel(logging.DEBUG)

# Dictionary of all text objects.
texts = {}

# Lock to prevent simultaneous changes to the texts dictionary.
lock_texts = thread.allocate_lock()


class TextObj:
  # A persistent object which stores a text.

  # Object properties:
  # .name - The unique name for this text, e.g 'proposal'
  # .views - List of views currently connected to this text.
  # .text - The text itself.
  # .changed - Has the text changed since the last time it was written to disk.
  # .lock - Access control for writing to the text on this object.

  def __init__(self, newname):
    # Setup this object
    self.name = newname
    self.views = []
    self.text = None
    self.changed = False
    self.lock = thread.allocate_lock()
    self.lock.acquire()
    self.load()
    self.lock.release()

    # lock_texts must be acquired by the caller to prevent simultaneous
    # creations of the same text.
    assert lock_texts.locked(), "Can't create TextObj unless locked."
    global texts
    texts[newname] = self

  def setText(self, text):
    # Scrub the text before setting it.
    # Keep the text within the length limit.
    if MAX_CHARS != 0 and len(text) > MAX_CHARS:
       text = text[-MAX_CHARS:]
       logging.warning("Truncated text to %d characters." % MAX_CHARS)
    # Normalize linebreaks to LF.
    text = re.sub(r"(\r\n|\r|\n)", "\n", text)
    if (self.text != text):
      self.text = text
      self.changed = True

  def cleanup(self):
    # General cleanup task.
    # * Save to disk.
    # * Delete myself if I've been orphaned.
    # Lock must be acquired to prevent simultaneous deletions.
    self.lock.acquire()
    # Don't delete during a retrieval.
    lock_texts.acquire()
    self.save()
    # Delete the text object if it has got no views.
    if len(self.views) == 0:
      logging.info("Unloading text: '%s'" % self.name)
      global texts
      del texts[self.name]
    else:
      self.lock.release()
    lock_texts.release()

  def load(self):
    # Load the text (if present) from disk.
    # Lock must be acquired by the caller to prevent load in the middle of a
    # save or diff.
    assert self.lock.locked(), "Can't load unless locked."
    filename = "%s/%s.txt" % (DATA_DIR, urllib.quote(self.name))
    if os.path.exists(filename):
      try:
        infile = open(filename, "r")
        self.setText(infile.read().decode("utf-8"))
        infile.close()
        self.changed = False
        logging.info("Loaded: '%s'" % filename)
      except:
        logging.critical("Can't read file: %s" % filename)

  def save(self):
    # Save the text to disk.
    if not self.changed:
      return
    # Lock must be acquired by the caller to prevent simultaneous saves.
    assert self.lock.locked(), "Can't save unless locked."
    filename = "%s/%s.txt" % (DATA_DIR, urllib.quote(self.name))
    try:
      outfile = open(filename, "w")
      outfile.write(self.text.encode("utf-8"))
      outfile.close()
      self.changed = False
      logging.info("Saved: '%s'" % filename)
    except:
      logging.critical("Can't save file: %s" % filename)


def fetch_textobj(name, view):
  # Retrieve the named text object.  Create it if it doesn't exist.
  # Add the given view into the text object's list of connected views.
  # Don't let two simultaneous creations happen, or a deletion during a
  # retrieval.
  lock_texts.acquire()
  if texts.has_key(name):
    textobj = texts[name]
    logging.debug("Accepted text: '%s'" % name)
  else:
    textobj = TextObj(name)
    logging.debug("Creating text: '%s'" % name)
  textobj.views.append(view)
  lock_texts.release()
  return textobj


# Dictionary of all view objects.
views = {}

# Lock to prevent simultaneous changes to the views dictionary.
lock_views = thread.allocate_lock()

class ViewObj:
  # A persistent object which contains one user's view of one text.

  # Object properties:
  # .username - The name for the user, e.g. 'fraser'
  # .filename - The name for the file, e.g 'proposal'
  # .lasttime - The last time (in seconds since 1970) that a web connection
  #     serviced this object.
  # .shadow - The last version of the text sent to client.
  # .backup_shadow - The previous version of the text sent to client.
  # .shadow_client_version - The client's version for the shadow (n).
  # .shadow_server_version - The server's version for the shadow (m).
  # .backup_shadow_server_version - the server's version for the backup
  #     shadow (m).
  # .edit_stack - List of unacknowledged edits sent to the client.
  # .lock - Access control for writing to the text on this object.
  # .textobj - The shared text object being worked on.

  def __init__(self, username, filename):
    # Setup this object
    self.username = username
    self.filename = filename
    self.lasttime = time.time()
    self.shadow = u""
    self.backup_shadow = u""
    self.shadow_client_version = 0
    self.shadow_server_version = 0
    self.backup_shadow_server_version = 0
    self.edit_stack = []
    self.lock = thread.allocate_lock()
    self.textobj = fetch_textobj(filename, self)

    # lock_views must be acquired by the caller to prevent simultaneous
    # creations of the same view.
    assert lock_views.locked(), "Can't create ViewObj unless locked."
    global views
    views[(username, filename)] = self


  def cleanup(self):
    # General cleanup task.
    # Delete myself if I've been idle too long.
    # Don't delete during a retrieval.
    lock_views.acquire()
    if self.lasttime < time.time() - (15 * 60):
      logging.info("Idle out: '%s %s'" % (self.username, self.filename))
      self.textobj.views.remove(self)
      global views
      del views[(self.username, self.filename)]
    lock_views.release()


def fetch_viewobj(username, filename):
  # Retrieve the named view object.  Create it if it doesn't exist.
  # Don't let two simultaneous creations happen, or a deletion during a
  # retrieval.
  lock_views.acquire()
  key = (username, filename)
  if views.has_key(key):
    viewobj = views[key]
    viewobj.lasttime = time.time()
    logging.debug("Accepting view: '%s %s'" % key)
  else:
    if MAX_VIEWS != 0 and len(views) > MAX_VIEWS:
      # Overflow, stop hammering my server.
      return None
    viewobj = ViewObj(username, filename)
    logging.debug("Creating view: '%s %s'" % key)
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
  # .lasttime - The last time (in seconds since 1970) that a web connection
  #     wrote to this object.
  # .data - The contents of the buffer.
  # .lock - Access control for writing to the text on this object.

  def __init__(self, name):
    # Setup this object
    self.name = name
    self.lasttime = time.time()
    self.data = None
    self.lock = thread.allocate_lock()

    # lock_views must be acquired by the caller to prevent simultaneous
    # creations of the same view.
    assert lock_buffers.locked(), "Can't create BufferObj unless locked."
    global buffers
    buffers[name] = self

  def init(self, size):
    # Initialize the buffer with a set number of slots.
    # Null characters form dividers between each slot.
    array = []
    for x in xrange(size - 1):
      array.append("\0")
    self.data = "".join(array)
    logging.debug("Buffer initialized to %d slots: %s" % (size, self.name))

  def set(self, n, text):
    # Set the nth slot of this buffer with text.
    if self.data == None:
      logging.warning("Unable to insert into undefined buffer")
      return
    # n is 1-based.
    n -= 1
    array = self.data.split("\0")
    if n >= 0 and n < len(array):
      array[n] = text
      self.data = "\0".join(array)
      logging.debug("Inserted into slot %d of a %d slot buffer: %s" %
                    (n + 1, len(array), self.name))
    else:
      logging.warning("Unable to insert \"%s\" into slot %d of a %d slot buffer: %s" %
                      (text, n + 1, len(array), self.name))

  def completeText(self):
    # Fetch the completed text from the buffer.
    if self.data == None:
      return None
    if ("\0" + self.data + "\0").find("\0\0") == -1:
      text = self.data.replace("\0", "")
      text = urllib.unquote(text)
      # Delete this buffer.
      self.lasttime = 0
      self.cleanup()
      return text
    # Not complete yet.
    return None

  def cleanup(self):
    # General cleanup task.
    # * Delete myself if I've been idle too long.
    # Don't delete during a retrieval.
    lock_buffers.acquire()
    if self.lasttime < time.time() - (5 * 60):
      logging.info("Expired buffer: '%s'" % self.name)
      global buffers
      del buffers[self.name]
    lock_buffers.release()


def fetch_bufferobj(name, size):
  # Retrieve the named buffer object.  Create it if it doesn't exist.
  name += "_%d" % size
  # Don't let two simultaneous creations happen, or a deletion during a
  # retrieval.
  lock_buffers.acquire()
  if buffers.has_key(name):
    bufferobj = buffers[name]
    bufferobj.lasttime = time.time()
    logging.debug("Found buffer: '%s'" % name)
  else:
    bufferobj = BufferObj(name)
    bufferobj.init(size)
    logging.debug("Creating buffer: '%s'" % name)
  lock_buffers.release()
  return bufferobj


def cleanup_thread():
  # Every minute cleanup
  while True:
    time.sleep(60)
    logging.info("Running cleanup task.")
    for v in views.values():
      v.cleanup()
    for v in texts.values():
      v.cleanup()
    for v in buffers.values():
      v.cleanup()


class EchoRequestHandler(SocketServer.StreamRequestHandler):

  def handle(self):
    self.connection.settimeout(TIMEOUT)
    assert self.client_address[0] == "127.0.0.1", ("Connection refused from " +
                                                   self.client_address[0])
    logging.info("Connection accepted from " + self.client_address[0])

    data = []
    # Read in all the lines.
    while 1:
      try:
        line = self.rfile.readline()
      except:
        # Timeout.
        logging.warning("Timeout on connection")
        break
      data.append(line)
      if not line.rstrip("\r\n"):
        # Terminate and execute on blank line.
        self.wfile.write(self.parseRequest("".join(data)))
        break


    # Goodbye
    logging.debug("Disconnecting.")


  def parseRequest(self, data):
    # Passing a Unicode string is an easy way to cause numerous subtle bugs.
    if type(data) != str:
      logging.critical("parseRequest data type is %s" % type(data))
      return ""
    if not (data.endswith("\n\n") or data.endswith("\r\r") or
            data.endswith("\n\r\n\r") or data.endswith("\r\n\r\n")):
      # There must be a linefeed followed by a blank line.
      # Truncated data.  Abort.
      logging.warning("Truncated data: '%s'" % data)
      return ""

    # Parse the lines
    output = []
    actions = []
    username = None
    filename = None
    server_version = None
    echo_username = False
    for line in data.splitlines():
      if not line:
        # Terminate on blank line.
        break
      if line.find(":") != 1:
        # Invalid line.
        continue
      (name, value) = (line[:1], line[2:])

      # Parse out a version number for file, delta or raw.
      version = None
      if ("FfDdRr".find(name) != -1):
        div = value.find(":")
        if div > 0:
          try:
            version = int(value[:div])
          except ValueError:
            logging.warning("Invalid version number: %s" % line)
            continue
          value = value[div + 1:]
        else:
          logging.warning("Missing version number: %s" % line)
          continue

      if name == "b" or name == "B":
        # Decode and store this entry into a buffer.
        try:
          (name, size, index, text) = value.split(" ", 3)
          size = int(size)
          index = int(index)
        except ValueError:
          logging.warning("Invalid buffer format: %s" % value)
          continue
        # Retrieve or make a buffer.
        bufferobj = fetch_bufferobj(name, size)
        # Store this buffer fragment.
        bufferobj.set(index, text)
        # Check to see if the buffer is complete.  If so, execute it.
        text = bufferobj.completeText()
        if text:
          logging.info("Executing buffer: %s" % bufferobj.name)
          # Duplicate last character.  Should be a line break.
          output.append(self.parseRequest(text + text[-1]))
          bufferobj.init(0)

      elif name == "u" or name == "U":
        # Remember the username.
        username = value
        if name == "U":
          # Client requests explicit usernames in response.
          echo_username = True

      elif name == "f" or name == "F":
        # Remember the filename and version.
        filename = value
        server_version = version

      else:
        # A delta or raw action.
        action = {}
        if name == "d" or name == "D":
          action["mode"] = "delta"
        elif name == "r" or name == "R":
          action["mode"] = "raw"
        else:
          action["mode"] = None
        if name.isupper():
          action["force"] = True
        else:
          action["force"] = False
        action["server_version"] = server_version
        action["client_version"] = version
        action["data"] = value
        if username and filename and action["mode"]:
          action["username"] = username
          action["filename"] = filename
          actions.append(action)

    output.append(self.doActions(actions, echo_username))

    return "".join(output)


  def doActions(self, actions, echo_username):
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
        viewobj.lock.acquire()
        delta_ok = True
        if viewobj == None:
          logging.warning("Too many views connected at once.")
          # Send back nothing.  Pretend the return packet was lost.
          return ""
        textobj = viewobj.textobj

      if (action["server_version"] != viewobj.shadow_server_version and
          action["server_version"] == viewobj.backup_shadow_server_version):
        # Client did not receive the last response.  Roll back the shadow.
        logging.warning("Rollback from shadow %d to backup shadow %d" %
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
        logging.info("Got %db raw text: '%s %s'" % 
            (len(data), viewobj.username, viewobj.filename))
        delta_ok = True
        # First, update the client's shadow.
        viewobj.shadow = data
        viewobj.shadow_client_version = action["client_version"]
        viewobj.shadow_server_version = action["server_version"]
        viewobj.backup_shadow = viewobj.shadow
        viewobj.backup_shadow_server_version = viewobj.shadow_server_version
        viewobj.edit_stack = []
        if action["force"]:
          # Clobber the server's text.
          textobj.lock.acquire()
          if textobj.text != data:
            textobj.setText(data)
            logging.debug("Overwrote content: '%s %s'" %
                (viewobj.username, viewobj.filename))
          textobj.lock.release()
      elif action["mode"] == "delta":
        # It's a delta.
        logging.info("Got '%s' delta: '%s %s'" %
            (action["data"], viewobj.username, viewobj.filename))
        if action["server_version"] != viewobj.shadow_server_version:
          # Can't apply a delta on a mismatched shadow version.
          delta_ok = False
          logging.warning("Shadow version mismatch: %d != %d" %
              (action["server_version"], viewobj.shadow_server_version))
        elif action["client_version"] > viewobj.shadow_client_version:
          # Client has a version in the future?
          delta_ok = False
          logging.warning("Future delta: %d > %d" %
              (action["client_version"], viewobj.shadow_client_version))
        elif action["client_version"] < viewobj.shadow_client_version:
          # We've already seen this diff.
          pass
          logging.warning("Repeated delta: %d < %d" %
              (action["client_version"], viewobj.shadow_client_version))
        else:
          # Expand the delta into a diff using the client shadow.
          try:
            diffs = DMP.diff_fromDelta(viewobj.shadow, action["data"])
          except ValueError:
            diffs = None
            delta_ok = False
            logging.warning("Delta failure, expected %d length: '%s %s'" %
                (len(viewobj.shadow), viewobj.username, viewobj.filename))
          viewobj.shadow_client_version += 1
          if diffs != None:
            # Expand the fragile diffs into a full set of patches.
            patches = DMP.patch_make(viewobj.shadow, diffs)
            # First, update the client's shadow.
            viewobj.shadow = DMP.diff_text2(diffs)
            viewobj.backup_shadow = viewobj.shadow
            viewobj.backup_shadow_server_version = viewobj.shadow_server_version
            # Second, deal with the server's text.
            textobj.lock.acquire()
            if textobj.text == None:
              # A view is sending a valid delta on a file we've never heard of.
              textobj.setText("")
            if action["force"]:
              # Clobber the server's text if a change was received.
              if len(diffs) > 1 or diffs[0][0] != DMP.DIFF_EQUAL:
                mastertext = viewobj.shadow
                logging.debug("Overwrote content: '%s %s'" %
                    (viewobj.username, viewobj.filename))
              else:
                mastertext = textobj.text
            else:
              (mastertext, results) = DMP.patch_apply(patches, textobj.text)
              logging.debug("Patched (%s): '%s %s'" %
                  (",".join(["%s" % (x) for x in results]),
                   viewobj.username, viewobj.filename))
            if textobj.text != mastertext:
              textobj.setText(mastertext)
            textobj.lock.release()

      # Generate output if this is the last action or the username/filename
      # will change in the next iteration.
      if ((action_index + 1 == len(actions)) or
          actions[action_index + 1]["username"] != viewobj.username or
          actions[action_index + 1]["filename"] != viewobj.filename):
        output.append(self.generateDiffs(viewobj,
                                         last_username, last_filename,
                                         echo_username, action["force"],
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
    textobj = viewobj.textobj
    if (echo_username and last_username != viewobj.username):
      output.append("u:%s\n" %  viewobj.username)
    if (last_filename != viewobj.filename or last_username != viewobj.username):
      output.append("F:%d:%s\n" %
          (viewobj.shadow_client_version, viewobj.filename))

    # Accept this view's version of the text if we've never heard of this
    # text before.
    if textobj.text == None:
      textobj.lock.acquire()
      # Check that mastertext is still None after the lock.
      if textobj.text == None:
        if delta_ok:
          textobj.setText(viewobj.shadow)
        else:
          textobj.setText("")
      textobj.lock.release()

    mastertext = textobj.text
    if delta_ok:
      # Create the diff between the view's text and the master text.
      diffs = DMP.diff_main(viewobj.shadow, mastertext)
      DMP.diff_cleanupEfficiency(diffs)
      text = DMP.diff_toDelta(diffs)
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
      logging.info("Sent '%s' delta: '%s %s'" %
          (text, viewobj.username, viewobj.filename))
    else:
      # Error; server could not parse client's delta.
      # Send a raw dump of the text.  Force overwrite of client.
      viewobj.shadow_client_version += 1
      text = mastertext
      text = text.encode("utf-8")
      text = urllib.quote(text, "!~*'();/?:@&=+$,# ")
      viewobj.edit_stack.append((viewobj.shadow_server_version,
          "R:%d:%s\n" % (viewobj.shadow_server_version, text)))
      logging.info("Sent %db raw text: '%s %s'" %
          (len(text), viewobj.username, viewobj.filename))

    viewobj.shadow = mastertext

    for edit in viewobj.edit_stack:
      output.append(edit[1])

    return "".join(output)


def main():
  # Start up a thread that does timeouts and cleanup
  thread.start_new_thread(cleanup_thread, ())

  logging.info("Listening on port %d..." % LOCAL_PORT)
  s = SocketServer.ThreadingTCPServer(("", LOCAL_PORT), EchoRequestHandler)
  try:
    s.serve_forever()
  except KeyboardInterrupt:
    logging.info("Shutting down.")
    logging.shutdown()
    s.socket.close()


if __name__ == "__main__":
  main()
