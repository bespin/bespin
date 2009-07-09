#!/usr/bin/python
"""MobWrite - Real-time Synchronization and Collaboration Service

Copyright 2009 Google Inc.
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

"""Core functions for a MobWrite client/server in Python.
"""

__author__ = "fraser@google.com (Neil Fraser)"

import re
import diff_match_patch as dmp_module
import logging
import datetime

# Global Diff/Match/Patch object.
DMP = dmp_module.diff_match_patch()
DMP.Diff_Timeout = 0.1

# Demo usage should limit the maximum size of any text.
# Set to 0 to disable limit.
MAX_CHARS = 20000

# Delete any view which hasn't been accessed in half an hour.
TIMEOUT_VIEW = datetime.timedelta(minutes=30)

# Delete any text which hasn't been accessed in a day.
# TIMEOUT_TEXT should be longer than the length of TIMEOUT_VIEW
TIMEOUT_TEXT = datetime.timedelta(days=1)

# Delete any buffer which hasn't been written to in a quarter of an hour.
TIMEOUT_BUFFER = datetime.timedelta(minutes=15)

LOG = logging.getLogger("mobwrite")
# Choose from: CRITICAL, ERROR, WARNING, INFO, DEBUG
LOG.setLevel(logging.DEBUG)


class TextObj:
  # An object which stores a text.

  # Object properties:
  # .name - The unique name for this text, e.g 'proposal'
  # .text - The text itself.
  # .changed - Has the text changed since the last time it was saved.

  def __init__(self, *args, **kwargs):
    # Setup this object
    self.name = kwargs.get("name")
    self.text = None
    self.changed = False

  def setText(self, newtext):
    # Scrub the text before setting it.
    if newtext != None:
      # Keep the text within the length limit.
      if MAX_CHARS != 0 and len(newtext) > MAX_CHARS:
        newtext = newtext[-MAX_CHARS:]
        LOG.warning("Truncated text to %d characters." % MAX_CHARS)
      # Normalize linebreaks to LF.
      newtext = re.sub(r"(\r\n|\r|\n)", "\n", newtext)
    if self.text != newtext:
      self.text = newtext
      self.changed = True


class ViewObj:
  # An object which contains one user's view of one text.

  # Object properties:
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
    self.username = kwargs["username"]
    self.filename = kwargs["filename"]
    self.shadow_client_version = kwargs.get("shadow_client_version", 0)
    self.shadow_server_version = kwargs.get("shadow_server_version", 0)
    self.backup_shadow_server_version = kwargs.get("backup_shadow_server_version", 0)
    self.shadow = kwargs.get("shadow", u"")
    self.backup_shadow = kwargs.get("backup_shadow", u"")


class MobWrite:

  def parseRequest(self, data):
    """Parse the raw MobWrite commands into a list of specific actions.
    See: http://code.google.com/p/google-mobwrite/wiki/Protocol

    Args:
      data: A multi-line string of MobWrite commands.

    Returns:
      A list of actions, each action is a dictionary.  Typical action:
      {"username":"fred",
       "filename":"report",
       "mode":"delta",
       "data":"=10+Hello-7=2",
       "force":False,
       "server_version":3,
       "client_version":3,
       "echo_username":False
      }
    """
    # Passing a Unicode string is an easy way to cause numerous subtle bugs.
    if type(data) != str:
      LOG.critical("parseRequest data type is %s" % type(data))
      return []
    if not (data.endswith("\n\n") or data.endswith("\r\r") or
            data.endswith("\n\r\n\r") or data.endswith("\r\n\r\n")):
      # There must be a linefeed followed by a blank line.
      # Truncated data.  Abort.
      LOG.warning("Truncated data: '%s'" % data)
      return []

    # Parse the lines
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
            LOG.warning("Invalid version number: %s" % line)
            continue
          value = value[div + 1:]
        else:
          LOG.warning("Missing version number: %s" % line)
          continue

      if name == "b" or name == "B":
        # Decode and store this entry into a buffer.
        try:
          (name, size, index, text) = value.split(" ", 3)
          size = int(size)
          index = int(index)
        except ValueError:
          LOG.warning("Invalid buffer format: %s" % value)
          continue
        # Store this buffer fragment.
        text = self.feedBuffer(name, size, index, text)
        # Check to see if the buffer is complete.  If so, execute it.
        if text:
          LOG.info("Executing buffer: %s_%d" % (name, size))
          # Duplicate last character.  Should be a line break.
          # Note that buffers are not intended to be mixed with other commands.
          return self.parseRequest(text + text[-1])

      elif name == "u" or name == "U":
        # Remember the username.
        username = value
        # Client may request explicit usernames in response.
        echo_username = (name == "U")

      elif name == "f" or name == "F":
        # Remember the filename and version.
        filename = value
        server_version = version

      elif name == "n" or name == "N":
        # Nullify this file.
        filename = value
        if username and filename:
          action = {}
          action["username"] = username
          action["filename"] = filename
          action["mode"] = "null"
          actions.append(action)

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
        action["echo_username"] = echo_username
        if username and filename and action["mode"]:
          action["username"] = username
          action["filename"] = filename
          actions.append(action)

    return actions


  def applyPatches(self, viewobj, diffs, action):
    """Apply a set of patches onto the view and text objects.  This function must
      be enclosed in a lock or transaction since the text object is shared.

    Args:
      textobj: The shared server text to be updated.
      viewobj: The user's view to be updated.
      diffs: List of diffs to apply to both the view and the server.
      action: Parameters for how forcefully to make the patch; may be modified.
    """
    # Expand the fragile diffs into a full set of patches.
    patches = DMP.patch_make(viewobj.shadow, diffs)

    # First, update the client's shadow.
    viewobj.shadow = DMP.diff_text2(diffs)
    viewobj.backup_shadow = viewobj.shadow
    viewobj.backup_shadow_server_version = viewobj.shadow_server_version

    # Second, deal with the server's text.
    textobj = viewobj.textobj
    if textobj.text == None:
      # A view is sending a valid delta on a file we've never heard of.
      textobj.setText(viewobj.shadow)
      action["force"] = False
      LOG.debug("Set content: '%s@%s'" %
          (viewobj.username, viewobj.filename))
    else:
      if action["force"]:
        # Clobber the server's text if a change was received.
        if patches:
          mastertext = viewobj.shadow
          LOG.debug("Overwrote content: '%s@%s'" %
              (viewobj.username, viewobj.filename))
        else:
          mastertext = textobj.text
      else:
        (mastertext, results) = DMP.patch_apply(patches, textobj.text)
        LOG.debug("Patched (%s): '%s@%s'" %
            (",".join(["%s" % (x) for x in results]),
             viewobj.username, viewobj.filename))
      textobj.setText(mastertext)
