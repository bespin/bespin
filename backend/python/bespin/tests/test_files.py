from webtest import TestApp
import simplejson

from bespin import config, controllers, model

app = None

def setup_module(module):
    global app
    config.set_profile('test')
    app = controllers.make_app()
    app = TestApp(app)

def _get_fm():
    config.activate_profile()
    app.reset()
    fm = config.c.file_manager
    config.c.user_manager.create_user("SomeoneElse", "")
    fm.save_file('SomeoneElse', 'otherproject', 'foo', 
                 'Just a file to reserve a project')
    app.get("/register/login/MacGyver")
    config.c.saved_keys = set()
    return fm

def test_basic_file_creation():
    fm = _get_fm()
    fm.save_file("MacGyver", "bigmac", "reqs", "Chewing gum wrapper")
    assert fm.file_store['bigmac/reqs'] == 'Chewing gum wrapper'
    files = fm.list_files("MacGyver", "bigmac", "")
    assert files == ['reqs']
    user = config.c.user_manager.get_user("MacGyver")
    assert user.projects == set(['bigmac', "MacGyver_New_Project"])
    
def test_can_only_access_own_projects():
    fm = _get_fm()
    fm.save_file("MacGyver", "bigmac", "foo", "Bar!")
    tests = [
        (fm.get_file, ("Murdoc", "bigmac", "foo"), 
        "Murdoc should *not* be viewing Mac's stuff!"),
        (fm.list_files, ("Murdoc", "bigmac", ""),
        "Murdoc should not be listing Mac's files!"),
        (fm.delete, ("Murdoc", "bigmac", "foo"),
        "Murdoc should not be deleting Mac's files!"),
        (fm.save_edit, ("Murdoc", "bigmac", "foo", "bar"),
        "Murdoc can't even edit Mac's files"),
        (fm.reset_edits, ("Murdoc", "bigmac", "foo"),
        "Murdoc can't reset them"),
        (fm.list_edits, ("Murdoc", "bigmac", "foo"),
        "Murdoc can't view the sekret edits"),
        (fm.close, ("Murdoc", "bigmac", "foo"),
        "Murdoc can't close files either")
    ]
    def run_one(t):
        try:
            t[0](*t[1])
            assert False, t[2]
        except model.NotAuthorized:
            pass
        
    for test in tests:
        yield run_one, test
        
def test_error_if_you_try_to_replace_dir_with_file():
    fm = _get_fm()
    fm.save_file("MacGyver", "bigmac", "foo/bar/baz", "biz")
    try:
        fm.save_file("MacGyver", "bigmac", "foo/bar", "NOT GONNA DO IT!")
        assert False, "Expected a FileConflict exception"
    except model.FileConflict:
        pass
    
def test_get_file_opens_the_file():
    fm = _get_fm()
    fm.save_file("MacGyver", "bigmac", "foo/bar/baz", "biz")
    contents = fm.get_file("MacGyver", "bigmac", "foo/bar/baz")
    assert contents == "biz"
    status = fm.status_store['fbigmac/foo/bar/baz']
    assert status.users == set(['MacGyver'])
    open_files = fm.list_open("MacGyver")
    assert open_files == {'bigmac' : {"foo/bar/baz" : "rw"}}
    
    fm.close("MacGyver", "bigmac", "foo")
    # does nothing, because we don't have that one open
    open_files = fm.list_open("MacGyver")
    assert open_files == {'bigmac' : {"foo/bar/baz" : "rw"}}
    
    fm.close("MacGyver", "bigmac", "foo/bar/baz")
    open_files = fm.list_open("MacGyver")
    assert open_files == {}
    # should remove the status entirely
    assert 'uMacGyver' not in fm.status_store
    assert 'fbigmac/foo/bar/baz' not in fm.status_store

def test_get_file_raises_exception_if_its_a_directory():
    fm = _get_fm()
    fm.save_file("MacGyver", "bigmac", "foo/bar/baz", "biz")
    try:
        contents = fm.get_file("MacGyver", "bigmac", "foo/bar/")
        assert False, "Expected exception for directory"
    except model.FSException:
        pass
    
def test_get_file_raises_not_found_exception():
    fm = _get_fm()
    fm.save_file("MacGyver", "bigmac", "foo/bar/baz", "biz")
    try:
        contents = fm.get_file("MacGyver", "bigmac", "NOTFOUND")
        assert False, "Expected exception for not found"
    except model.FileNotFound:
        pass
    
def test_delete_raises_file_not_found():
    fm = _get_fm()
    try:
        fm.delete("MacGyver", "bigmac", "DOESNT MATTER")
        assert False, "Expected not found for missing project"
    except model.FileNotFound:
        pass
    fm.save_file("MacGyver", "bigmac", "foo/bar/baz", "biz")
    try:
        fm.delete("MacGyver", "bigmac", "STILL DOESNT MATTER")
        assert False, "Expected not found for missing file"
    except model.FileNotFound:
        pass
    try:
        fm.delete("MacGyver", "bigmac", "foo/bar/")
        assert False, "Expected exception for deleting directory"
    except model.FSException:
        pass
    
def test_cannot_delete_open_file():
    fm = _get_fm()
    fm.save_file("MacGyver", "bigmac", "foo/bar/baz", "biz")
    fm.get_file("MacGyver", "bigmac", "foo/bar/baz")
    try:
        fm.delete("MacGyver", "bigmac", "foo/bar/baz")
        assert False, "Expected FileConflict exception for deleting open file"
    except model.FileConflict:
        pass
    
def test_successful_deletion():
    fm = _get_fm()
    fm.save_file("MacGyver", "bigmac", "foo/bar/baz", "biz")
    fm.delete("MacGyver", "bigmac", "foo/bar/baz")
    try:
        fm.get_file("MacGyver", "bigmac", "foo/bar/baz")
        assert False, "Expected FileNotFound because the file is gone"
    except model.FileNotFound:
        pass
    files = fm.list_files("MacGyver", "bigmac", "foo/bar/")
    assert not files
    

def test_basic_edit_functions():
    fm = _get_fm()
    fm.save_edit("MacGyver", "bigmac", "foo/bar/baz", "['edit', 'thinger']")
    assert len(fm.edit_store['bigmac/foo/bar/baz']) == 1
    assert 'bigmac/foo/bar/baz' not in fm.file_store, \
        "Files are not created until a save"
    files = fm.list_open("MacGyver")
    assert files == {'bigmac' : {'foo/bar/baz' : 'rw'}}
    
    edits = fm.list_edits("MacGyver", "bigmac", "foo/bar/baz")
    assert edits == ["['edit', 'thinger']"]
    
    fm.save_edit("MacGyver", "bigmac", "foo/bar/baz", "['second', 'edit']")
    edits = fm.list_edits("MacGyver", "bigmac", "foo/bar/baz")
    assert edits == ["['edit', 'thinger']", "['second', 'edit']"]
    edits = fm.list_edits("MacGyver", "bigmac", "foo/bar/baz", 1)
    assert edits == ["['second', 'edit']"]
    
    try:
        edits = fm.list_edits("MacGyver", "bigmac", "foo/bar/baz", 2)
        assert False, "Expected FSException for out-of-bounds start point"
    except model.FSException:
        pass
    
def test_reset_edits():
    fm = _get_fm()
    fm.save_edit("MacGyver", "bigmac", "foo/bar/baz", "['edit', 'thinger']")
    fm.reset_edits("MacGyver", "bigmac", "foo/bar/baz")
    edits = fm.list_edits("MacGyver", "bigmac", "foo/bar/baz")
    assert edits == []
    files = fm.list_open("MacGyver")
    assert files == {}
    
    fm.save_edit("MacGyver", "bigmac", "foo/bar/baz", "['edit', 'thinger']")
    fm.save_edit("MacGyver", "bigmac", "foo/bar/blork", "['edit', 'thinger']")
    files = fm.list_open("MacGyver")
    assert files == {'bigmac': {'foo/bar/baz': 'rw', 'foo/bar/blork': 'rw'}}
    fm.reset_edits("MacGyver")
    files = fm.list_open("MacGyver")
    assert files == {}
    edits = fm.list_edits("MacGyver", "bigmac", "foo/bar/baz")
    assert edits == []
    
def test_edits_cleared_after_save():
    fm = _get_fm()
    fm.save_edit("MacGyver", "bigmac", "foo/bar/baz", "['edit', 'thinger']")
    fm.save_file("MacGyver", "bigmac", "foo/bar/baz", "macaroni")
    edits = fm.list_edits("MacGyver", "bigmac", "foo/bar/baz")
    assert edits == []

def test_edits_cleared_after_close():
    fm = _get_fm()
    fm.save_file("MacGyver", "bigmac", "foo/bar/baz", "macaroni")
    fm.get_file("MacGyver", "bigmac", "foo/bar/baz")
    fm.save_edit("MacGyver", "bigmac", "foo/bar/baz", "['edit', 'thinger']")
    fm.close("MacGyver", "bigmac", "foo/bar/baz")
    edits = fm.list_edits("MacGyver", "bigmac", "foo/bar/baz")
    assert edits == []
    
def test_template_installation():
    fm = _get_fm()
    fm.install_template("MacGyver", "bigmac")
    data = fm.get_file("MacGyver", "bigmac", "readme.txt")
    fm.close("MacGyver", "bigmac", "readme.txt")
    assert "Welcome to Bespin" in data
    result = fm.list_files("MacGyver", "bigmac")
    assert 'readme.txt' in result
    
def test_list_top_level():
    fm = _get_fm()
    fm.save_file("MacGyver", "bigmac", "readme.txt", "Hi there!")
    result = fm.list_files("MacGyver", "bigmac")
    assert result == ["readme.txt"]
    result = fm.list_files("MacGyver")
    assert result == ["MacGyver_New_Project/", "bigmac/"]
    
    
# -------
# Web tests
# -------
    
def test_good_file_operations_from_web():
    fm = _get_fm()
    app.put("/file/at/bigmac/reqs", "Chewing gum wrapper")
    assert 'bigmac/reqs' in config.c.saved_keys
    resp = app.get("/file/at/bigmac/reqs")
    assert resp.body == "Chewing gum wrapper"
    resp = app.get("/file/listopen/")
    assert resp.content_type == "application/json"
    data = simplejson.loads(resp.body)
    assert data == {'bigmac' : {'reqs' : 'rw'}}
    app.post("/file/close/bigmac/reqs")
    
    resp = app.get("/file/at/bigmac/reqs?mode=r")
    assert resp.body == "Chewing gum wrapper"
    resp = app.get("/file/listopen/")
    data = simplejson.loads(resp.body)
    assert data == {'bigmac' : {'reqs' : 'r'}}
    app.post("/file/close/bigmac/reqs")
    resp = app.get("/file/listopen/")
    data = simplejson.loads(resp.body)
    assert data == {}
    
    resp = app.get("/file/list/")
    data = simplejson.loads(resp.body)
    assert data == ['MacGyver_New_Project/', 'bigmac/']
    
    resp = app.get("/file/list/MacGyver_New_Project/")
    data = simplejson.loads(resp.body)
    assert 'readme.txt' in data
    
    resp = app.get("/file/list/bigmac/")
    assert resp.content_type == "application/json"
    data = simplejson.loads(resp.body)
    assert data == ['reqs']
    
    app.delete("/file/at/bigmac/reqs")
    resp = app.get("/file/list/bigmac/")
    data = simplejson.loads(resp.body)
    assert data == []
    
    
def test_error_conditions_from_web():
    fm = _get_fm()
    app.put("/file/at/otherproject/something", "Another file",
            status=401)
    app.get("/file/at/bigmac/UNKNOWN", status=404)
    app.put("/file/at/bigmac/bar/baz", "A file in bar")
    app.put("/file/at/bigmac/bar", "A file to replace bar", status=409)
    app.get("/file/at/bigmac/bar/baz")
    app.delete("/file/at/bigmac/bar/baz", status=409)
    app.get("/file/at/bigmac", status=400)
    app.get("/file/at/bigmac/", status=400)
    app.get("/file/at/", status=400)

def test_edit_interface():
    fm = _get_fm()
    app.put("/edit/at/otherproject/something", "Data here", status=401)
    app.put("/edit/at/bigmac/bar/baz", "Starting a file")
    app.put("/edit/at/bigmac/bar/baz", "Second edit")
    resp = app.get("/edit/list/bigmac/bar/baz")
    assert resp.content_type == "application/json"
    data = simplejson.loads(resp.body)
    assert data == ["Starting a file", "Second edit"]
    
    resp = app.get("/edit/recent/1/bigmac/bar/baz")
    assert resp.content_type == "application/json"
    data = simplejson.loads(resp.body)
    assert data == ["Second edit"]
    
    resp = app.get("/file/listopen/")
    data = simplejson.loads(resp.body)
    assert data == {'bigmac' : {'bar/baz' : 'rw'}}
    
    app.post("/edit/reset/")
    resp = app.get("/edit/list/bigmac/bar/baz")
    data = simplejson.loads(resp.body)
    assert data == []
    
    app.put("/edit/at/bigmac/bar/baz", "Starting a file")
    app.post("/edit/reset/bigmac/bar/baz")
    resp = app.get("/edit/list/bigmac/bar/baz")
    data = simplejson.loads(resp.body)
    assert data == []
    
def test_private_project_does_not_appear_in_list():
    resp = app.get("/register/login/MacGyver")
    data = simplejson.loads(resp.body)
    project_name = data['project']
    app.put("/file/at/%s/foo" % project_name, "BAR!")
    app.post("/file/close/%s/foo" % project_name)
    resp = app.get("/file/list/")
    data = simplejson.loads(resp.body)
    assert data == ["MacGyver_New_Project/", "bigmac/"]
    