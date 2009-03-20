from uvc.tests.util import mock_run_command
from webtest import TestApp
from uvc import hg
import simplejson

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

@mock_run_command(clone_output)
def test_run_an_hg_clone(run_command_params):
    _init_data()
    cmd = "clone http://hg.mozilla.org/labs/bespin bespin".split()
    output = vcs.clone(macgyver, cmd)
    command, working_dir = run_command_params
    
    assert isinstance(command, hg.clone)
    assert working_dir == macgyver.get_location()
    assert output == clone_output

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
    command, working_dir = run_command_params
    
    assert isinstance(command, hg.diff)
    assert working_dir == bigmac.location
    assert output == diff_output
    
# Web tests

@mock_run_command(clone_output)
def test_hg_clone_on_web(run_command_params):
    _init_data()
    request = simplejson.dumps({'command' : ['clone', 'http://hg.mozilla.org/labs/bespin']})
    resp = app.post("/vcs/bigmac/", request)
    assert resp.content_type == "application/json"
    output = simplejson.loads(resp.body)
    assert 'output' in output
    output = output['output']
    command, working_dir = run_command_params
    command_line = " ".join(command.get_command_line())
    assert command_line == "hg clone http://hg.mozilla.org/labs/bespin bigmac"
    assert working_dir == macgyver.get_location()
    assert output == clone_output

@mock_run_command(diff_output)
def test_hg_diff_on_web(run_command_params):
    _init_data()
    bigmac = model.get_project(macgyver, macgyver, 'bigmac', create=True)
    bigmac.save_file(".hg/hgrc", "# test rc file\n")
    
    request = simplejson.dumps({'command' : ['diff']})
    resp = app.post("/vcs/bigmac/", request)
    
    assert resp.content_type == "application/json"
    output = simplejson.loads(resp.body)
    assert 'output' in output
    output = output['output']
    command, working_dir = run_command_params
    command_line = " ".join(command.get_command_line())
    assert command_line == "hg diff"
    assert working_dir == bigmac.location
    assert output == diff_output
