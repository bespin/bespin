#  ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
# 
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
# 
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the License.
# 
# The Original Code is Bespin.
# 
# The Initial Developer of the Original Code is Mozilla.
# Portions created by the Initial Developer are Copyright (C) 2009
# the Initial Developer. All Rights Reserved.
# 
# Contributor(s):
# 
# ***** END LICENSE BLOCK *****
# 

from uvc.tests.util import mock_run_command
from __init__ import BespinTestApp
from uvc import hg
import simplejson
from path import path

from bespin import vcs, config, controllers
from bespin.database import User
from bespin.database import Base
from bespin.filesystem import get_project, NotAuthorized

macgyver = None
app = None

def setup_module(module):
    global app
    config.set_profile('test')
    app = controllers.make_app()
    app = BespinTestApp(app)
    
def _init_data():
    global macgyver
    config.activate_profile()
    
    fsroot = config.c.fsroot
    if fsroot.exists() and fsroot.basename() == "testfiles":
        fsroot.rmtree()
    fsroot.makedirs()
    
    app.reset()
    
    Base.metadata.drop_all(bind=config.c.dbengine)
    Base.metadata.create_all(bind=config.c.dbengine)
    s = config.c.session_factory()
    
    app.post("/register/new/MacGyver", 
        dict(password="richarddean", email="rich@sg1.com"))
        
    macgyver = User.find_user("MacGyver")
    s.flush()


clone_output = """requesting all changes
adding changesets
adding manifests
adding file changes
added 9 changesets with 39 changes to 10 files
updating working directory
10 files updated, 0 files merged, 0 files removed, 0 files unresolved
"""

@mock_run_command(clone_output, "bespin")
def test_run_an_hg_clone(run_command_params):
    _init_data()
    output = vcs._clone_impl(macgyver, source="http://hg.mozilla.org/labs/bespin")
    command, context = run_command_params
    
    assert isinstance(command, hg.clone)
    working_dir = context.working_dir
    assert working_dir == macgyver.get_location()
    assert output['output'] == clone_output
    assert output['project'] == "bespin"
    assert str(command) == "clone http://hg.mozilla.org/labs/bespin bespin"
    
    bespin = get_project(macgyver, macgyver, "bespin")
    metadata = bespin.metadata
    
    assert 'remote_auth' not in metadata
    assert 'push' not in metadata
    assert metadata['remote_url'] == "http://hg.mozilla.org/labs/bespin"
    metadata.close()

diff_output = """diff -r ff44251fbb1e uvc/main.py
--- a/uvc/main.py	Thu Mar 19 11:55:30 2009 -0400
+++ b/uvc/main.py	Fri Mar 20 15:01:07 2009 -0400
@@ -1,4 +1,5 @@
 "Implements the uvc command processing."
+# Copyright 2009 Mozilla Corporation
 
 import sys
 import os
"""

@mock_run_command(diff_output)
def test_run_a_diff(run_command_params):
    _init_data()
    bigmac = get_project(macgyver, macgyver, 'bigmac', create=True)
    bigmac.save_file(".hg/hgrc", "# test rc file\n")
    cmd = ["diff"]
    output = vcs._run_command_impl(macgyver, bigmac, cmd, None)
    command, context = run_command_params
    
    working_dir = context.working_dir
    
    assert isinstance(command, hg.diff)
    assert working_dir == bigmac.location
    assert output['output'] == diff_output
    
update_output = """27 files updates from 97 changesets with 3.2 changes per file,
all on line 10."""

@mock_run_command(update_output)
def test_provide_auth_info_to_update_command(run_command_params):
    _init_data()
    bigmac = get_project(macgyver, macgyver, 'bigmac', create=True)
    bigmac.save_file(".hg/hgrc", "# test rc file\n")
    metadata = bigmac.metadata
    metadata['remote_url'] = 'http://hg.mozilla.org/labs/bespin'
    metadata.close()
    keychain = vcs.KeyChain(macgyver, "foobar")
    keychain.set_ssh_for_project(bigmac, vcs.AUTH_BOTH)
    
    cmd = ["update", "_BESPIN_REMOTE_URL"]
    output = vcs.run_command(macgyver, bigmac, cmd, "foobar")
    
    command, context = run_command_params
    command_line = command.get_command_line()
    assert command_line[:3] == ["hg", "fetch", "-e"]
    assert command_line[3].startswith("ssh -i")
    assert command_line[4] == "http://hg.mozilla.org/labs/bespin"
    # make sure it's not unicode
    assert isinstance(command_line[4], str)
    assert len(command_line) == 5
    
@mock_run_command(update_output)
def test_dont_provide_auth_info_to_update_command(run_command_params):
    _init_data()
    bigmac = get_project(macgyver, macgyver, 'bigmac', create=True)
    bigmac.save_file(".hg/hgrc", "# test rc file\n")
    keychain = vcs.KeyChain(macgyver, "foobar")
    keychain.set_ssh_for_project(bigmac, vcs.AUTH_BOTH)
    
    cmd = ["update"]
    output = vcs.run_command(macgyver, bigmac, cmd)
    
    resp = app.post("/messages/")
    messages = simplejson.loads(resp.body)
    assert len(messages) == 1
    output = messages[0]
    assert 'output' in output
    assert output['output'] == 'Keychain password is required for this command.'

def test_bad_keychain_password():
    _init_data()
    keychain = vcs.KeyChain(macgyver, "foobar")
    keychain.get_ssh_key()
    
    try:
        keychain = vcs.KeyChain(macgyver, "blorg")
        keychain.get_ssh_key()
        assert False, "Expected exception for bad keychain password"
    except NotAuthorized:
        pass
        
def test_get_users_vcs_name():
    _init_data()
    bigmac = get_project(macgyver, macgyver, "bigmac", create=True)
    user = vcs._get_vcs_user(macgyver, bigmac)
    assert user == "MacGyver"
    
    settings = get_project(macgyver, macgyver, "BespinSettings")
    settings.save_file("settings", """
vcsuser Mack Gyver <gyver@mac.com>
""")
    user = vcs._get_vcs_user(macgyver, bigmac)
    assert user == "Mack Gyver <gyver@mac.com>"
    
    metadata = bigmac.metadata
    metadata['vcsuser'] = "Big MacGyver <mrbig@macgyver.com>"
    metadata.close()
    user = vcs._get_vcs_user(macgyver, bigmac)
    assert user == "Big MacGyver <mrbig@macgyver.com>"
    
# Web tests

@mock_run_command(clone_output, create_dir="bigmac")
def test_hg_clone_on_web(run_command_params):
    _init_data()
    resp = app.post("/vcs/clone/",
            dict(source="http://hg.mozilla.org/labs/bespin",
                dest="bigmac",
                push="ssh://hg.mozilla.org/labs/bespin",
                remoteauth="both",
                authtype="password",
                username="someuser",
                password="theirpass",
                kcpass="foobar"
                ))
    assert resp.content_type == "application/json"
    output = simplejson.loads(resp.body)
    assert 'jobid' in output
    
    resp = app.post("/messages/")
    messages = simplejson.loads(resp.body)
    assert len(messages) == 1
    output = messages[0]
    assert output['project'] == "bigmac"
    assert 'output' in output
    output = output['output']
    command, context = run_command_params
    
    working_dir = context.working_dir

    global macgyver
    macgyver = User.find_user("MacGyver")
    command_line = " ".join(command.get_command_line())
    assert command_line == "hg clone http://someuser:theirpass@hg.mozilla.org/labs/bespin bigmac"
    assert working_dir == macgyver.get_location()
    assert output == clone_output
    
    bigmac = get_project(macgyver, macgyver, "bigmac")
    metadata = bigmac.metadata
    assert metadata['remote_auth'] == vcs.AUTH_BOTH
    assert metadata['push'] == "ssh://hg.mozilla.org/labs/bespin"
    metadata.close()
    
@mock_run_command(clone_output, create_dir="bespin")
def test_hg_clone_on_web_with_ssh(run_command_params):
    _init_data()
    resp = app.post("/vcs/clone/",
            dict(source="http://hg.mozilla.org/labs/bespin",
                push="ssh://hg.mozilla.org/labs/bespin",
                remoteauth="both",
                authtype="ssh",
                kcpass="foobar"
                ))
    assert resp.content_type == "application/json"
    output = simplejson.loads(resp.body)
    assert 'jobid' in output
    
    resp = app.post("/messages/")
    messages = simplejson.loads(resp.body)
    assert len(messages) == 1
    output = messages[0]
    assert 'output' in output
    output = output['output']
    command, context = run_command_params
    
    working_dir = context.working_dir

    global macgyver
    macgyver = User.find_user("MacGyver")
    command_line = command.get_command_line()
    assert command_line[0:3] == ["hg", "clone", "-e"]
    assert command_line[3].startswith("ssh -i")
    assert command_line[4] == "http://hg.mozilla.org/labs/bespin"
    assert command_line[5] == "bespin"
    assert working_dir == macgyver.get_location()
    assert output == clone_output
    
    bespin = get_project(macgyver, macgyver, "bespin")
    metadata = bespin.metadata
    assert metadata['remote_auth'] == vcs.AUTH_BOTH
    assert metadata['push'] == "ssh://hg.mozilla.org/labs/bespin"
    metadata.close()

push_output = "Changes pushed."

@mock_run_command(push_output)
def test_hg_push_on_web(run_command_params):
    _init_data()
    kc = vcs.KeyChain(macgyver, "foobar")
    # generate key pair
    kc.get_ssh_key()
    bigmac = get_project(macgyver, macgyver, 'bigmac', create=True)
    kc.set_ssh_for_project(bigmac, vcs.AUTH_WRITE)
    metadata = bigmac.metadata
    metadata['remote_url'] = "http://hg.mozilla.org/labs/bespin"
    metadata['push'] = "ssh://hg.mozilla.org/labs/bespin"
    metadata.close()
    bigmac.save_file(".hg/hgrc", "# test rc file\n")
    
    request = simplejson.dumps({'command' : ['push', '_BESPIN_PUSH'], 
                                'kcpass' : 'foobar'})
    resp = app.post("/vcs/command/bigmac/", request)
    resp = app.post("/messages/")
    
    command, context = run_command_params
    
    assert context.user == "MacGyver"
    
    command_line = command.get_command_line()
    print command_line
    assert command_line[0:3] == ["hg", "push", "-e"]
    assert command_line[3].startswith("ssh -i")
    assert command_line[4] == "ssh://hg.mozilla.org/labs/bespin"
    
@mock_run_command(diff_output)
def test_hg_diff_on_web(run_command_params):
    _init_data()
    bigmac = get_project(macgyver, macgyver, 'bigmac', create=True)
    bigmac.save_file(".hg/hgrc", "# test rc file\n")
    
    request = simplejson.dumps({'command' : ['diff']})
    resp = app.post("/vcs/command/bigmac/", request)
    
    assert resp.content_type == "application/json"
    output = simplejson.loads(resp.body)
    assert 'jobid' in output
    
    resp = app.post("/messages/")
    messages = simplejson.loads(resp.body)
    assert len(messages) == 1
    output = messages[0]
    assert 'output' in output
    output = output['output']
    command, context = run_command_params
    
    working_dir = context.working_dir
    
    command_line = " ".join(command.get_command_line())
    assert command_line == "hg diff"
    assert working_dir == bigmac.location
    print "output=" + output
    print "diff_output=" + diff_output
    assert output == diff_output

def test_keychain_creation():
    _init_data()
    kc = vcs.KeyChain(macgyver, "foobar")
    public_key, private_key = kc.get_ssh_key()
    
    assert public_key.startswith("ssh-rsa")
    assert "RSA PRIVATE KEY" in private_key
    
    public_key2 = vcs.KeyChain.get_ssh_public_key(macgyver)
    assert public_key2 == public_key
    
    bigmac = get_project(macgyver, macgyver, "bigmac", create=True)
    
    kc.set_ssh_for_project(bigmac, vcs.AUTH_BOTH)
    
    kcfile = path(macgyver.get_location()) / ".bespin-keychain"
    assert kcfile.exists()
    metadata = bigmac.metadata
    assert metadata['remote_auth'] == vcs.AUTH_BOTH
    metadata.close()
    
    # make sure the file is encrypted
    text = kcfile.bytes()
    assert "RSA PRIVATE KEY" not in text
    assert "ssh-rsa" not in text
    
    kc = vcs.KeyChain(macgyver, "foobar")
    public_key2, private_key2 = kc.get_ssh_key()
    assert public_key2 == public_key
    assert private_key2 == private_key
    
    credentials = kc.get_credentials_for_project(bigmac)
    assert "RSA PRIVATE KEY" in credentials['ssh_private_key']
    assert credentials['type'] == "ssh"
    
    kc.delete_credentials_for_project(bigmac)
    credentials = kc.get_credentials_for_project(bigmac)
    assert credentials is None
    metadata = bigmac.metadata
    try:
        value = metadata['remote_auth']
        assert False, "expected remote_auth key to be removed from project"
    except KeyError:
        pass
    metadata.close()
    
    kc.set_credentials_for_project(bigmac, vcs.AUTH_WRITE, "macG", "coolpass")
    
    kc = vcs.KeyChain(macgyver, "foobar")
    credentials = kc.get_credentials_for_project(bigmac)
    assert credentials['type'] == 'password'
    assert credentials['username'] == 'macG'
    assert credentials['password'] == 'coolpass'
    
    kc.delete_credentials_for_project(bigmac)
    
    kc = vcs.KeyChain(macgyver, "foobar")
    credentials = kc.get_credentials_for_project(bigmac)
    assert credentials is None

def test_vcs_auth_set_password_on_web():
    _init_data()
    bigmac = get_project(macgyver, macgyver, 'bigmac', create=True)
    resp = app.post("/vcs/setauth/bigmac/", dict(kcpass="foobar", 
                            type="password", username="macG", 
                            password="coolpass",
                            remoteauth="write"))
    kc = vcs.KeyChain(macgyver, "foobar")
    credentials = kc.get_credentials_for_project(bigmac)
    assert credentials['type'] == 'password'
    assert credentials['username'] == 'macG'
    assert credentials['password'] == 'coolpass'
    metadata = bigmac.metadata
    assert metadata[vcs.AUTH_PROPERTY] == vcs.AUTH_WRITE
    metadata.close()
    
def test_vcs_auth_set_ssh_newkey_on_web():
    _init_data()
    bigmac = get_project(macgyver, macgyver, "bigmac", create=True)
    resp = app.post("/vcs/setauth/bigmac/", dict(kcpass="foobar",
                    type="ssh", remoteauth="both"))
    assert resp.content_type == "application/json"
    assert "ssh-rsa" in resp.body
    
    kc = vcs.KeyChain(macgyver, "foobar")
    
    credentials = kc.get_credentials_for_project(bigmac)
    assert credentials['type'] == 'ssh'
    assert "RSA PRIVATE KEY" in credentials['ssh_private_key']
    metadata = bigmac.metadata
    assert metadata[vcs.AUTH_PROPERTY] == vcs.AUTH_BOTH
    metadata.close()
    
def test_vcs_auth_set_should_have_good_remote_auth_value():
    _init_data()
    bigmac = get_project(macgyver, macgyver, "bigmac", create=True)
    resp = app.post("/vcs/setauth/bigmac/", dict(kcpass="foobar",
                    type="ssh", remoteauth="foo"), status=400)
    
def test_vcs_get_ssh_key_from_web():
    _init_data()
    resp = app.post("/vcs/getkey/", dict(kcpass="foobar"))
    assert resp.content_type == "application/x-ssh-key"
    assert resp.body.startswith("ssh-rsa")
    
def test_vcs_get_ssh_key_from_web_without_password_no_pubkey():
    _init_data()
    resp = app.post("/vcs/getkey/", status=401)
    
def test_vcs_get_ssh_key_from_web_without_password_with_pubkey():
    _init_data()
    kc = vcs.KeyChain(macgyver, "foobar")
    # generate the key pair
    kc.get_ssh_key()
    resp = app.post("/vcs/getkey/")
    assert resp.content_type == "application/x-ssh-key"
    assert resp.body.startswith("ssh-rsa")
    
def test_find_out_remote_auth_info_from_web():
    _init_data()
    bigmac = get_project(macgyver, macgyver, "bigmac", create=True)
    keychain = vcs.KeyChain(macgyver, "foobar")
    keychain.set_ssh_for_project(bigmac, vcs.AUTH_BOTH)
    resp = app.get("/vcs/remoteauth/bigmac/")
    assert resp.body == "both"
    
    keychain.delete_credentials_for_project(bigmac)
    resp = app.get("/vcs/remoteauth/bigmac/")
    assert resp.body == ""
    
    keychain.set_ssh_for_project(bigmac, vcs.AUTH_WRITE)
    resp = app.get("/vcs/remoteauth/bigmac/")
    assert resp.body == "write"
    
