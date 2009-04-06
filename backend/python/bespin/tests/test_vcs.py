from uvc.tests.util import mock_run_command
from webtest import TestApp
from uvc import hg
import simplejson
from path import path

from bespin import vcs, config, controllers, model

macgyver = None
app = None

def setup_module(module):
    global app
    config.set_profile('test')
    app = controllers.make_app()
    app = TestApp(app)
    
def _init_data():
    global macgyver
    config.activate_profile()
    
    fsroot = config.c.fsroot
    if fsroot.exists() and fsroot.basename() == "testfiles":
        fsroot.rmtree()
    fsroot.makedirs()
    
    app.reset()
    
    model.Base.metadata.drop_all(bind=config.c.dbengine)
    model.Base.metadata.create_all(bind=config.c.dbengine)
    s = config.c.sessionmaker(bind=config.c.dbengine)
    user_manager = model.UserManager(s)
    
    app.post("/register/new/MacGyver", 
        dict(password="richarddean", email="rich@sg1.com"))
        
    macgyver = user_manager.get_user("MacGyver")


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
    output = vcs.clone(macgyver, source="http://hg.mozilla.org/labs/bespin")
    command, context = run_command_params
    
    assert isinstance(command, hg.clone)
    working_dir = context.working_dir
    assert working_dir == macgyver.get_location()
    assert output == clone_output
    assert str(command) == "clone http://hg.mozilla.org/labs/bespin bespin"
    
    bespin = model.get_project(macgyver, macgyver, "bespin")
    metadata = bespin.metadata
    
    assert 'remote_auth' not in metadata
    assert 'push' not in metadata
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
    bigmac = model.get_project(macgyver, macgyver, 'bigmac', create=True)
    bigmac.save_file(".hg/hgrc", "# test rc file\n")
    cmd = ["diff"]
    output = vcs.run_command(macgyver, bigmac, cmd)
    command, context = run_command_params
    
    working_dir = context.working_dir
    
    assert isinstance(command, hg.diff)
    assert working_dir == bigmac.location
    assert output == diff_output
    
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
    assert 'output' in output
    output = output['output']
    command, context = run_command_params
    
    working_dir = context.working_dir
    
    command_line = " ".join(command.get_command_line())
    assert command_line == "hg clone http://someuser:theirpass@hg.mozilla.org/labs/bespin bigmac"
    assert working_dir == macgyver.get_location()
    assert output == clone_output
    
    bigmac = model.get_project(macgyver, macgyver, "bigmac")
    metadata = bigmac.metadata
    assert metadata['remote_auth'] == vcs.AUTH_BOTH
    assert metadata['push'] == "ssh://hg.mozilla.org/labs/bespin"
    metadata.close()

@mock_run_command(diff_output)
def test_hg_diff_on_web(run_command_params):
    _init_data()
    bigmac = model.get_project(macgyver, macgyver, 'bigmac', create=True)
    bigmac.save_file(".hg/hgrc", "# test rc file\n")
    
    request = simplejson.dumps({'command' : ['diff']})
    resp = app.post("/vcs/command/bigmac/", request)
    
    assert resp.content_type == "application/json"
    output = simplejson.loads(resp.body)
    assert 'output' in output
    output = output['output']
    command, context = run_command_params
    
    working_dir = context.working_dir
    
    command_line = " ".join(command.get_command_line())
    assert command_line == "hg diff"
    assert working_dir == bigmac.location
    assert output == diff_output

def test_keychain_creation():
    _init_data()
    kc = vcs.KeyChain(macgyver, "foobar")
    key = kc.get_ssh_key()
    
    assert key.startswith("ssh-rsa")
    
    bigmac = model.get_project(macgyver, macgyver, "bigmac", create=True)
    
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
    key2 = kc.get_ssh_key()
    assert key2 == key
    
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
    bigmac = model.get_project(macgyver, macgyver, 'bigmac', create=True)
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
    bigmac = model.get_project(macgyver, macgyver, "bigmac", create=True)
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
    bigmac = model.get_project(macgyver, macgyver, "bigmac", create=True)
    resp = app.post("/vcs/setauth/bigmac/", dict(kcpass="foobar",
                    type="ssh", remoteauth="foo"), status=400)
    