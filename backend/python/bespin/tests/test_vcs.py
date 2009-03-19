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
