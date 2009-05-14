#  ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
# 
# The contents of this file are subject to the Mozilla Public License  
# Version
# 1.1 (the "License"); you may not use this file except in compliance  
# with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
# 
# Software distributed under the License is distributed on an "AS IS"  
# basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the  
# License
# for the specific language governing rights and limitations under the
# License.
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

import os
from cStringIO import StringIO
import tarfile
import zipfile

from __init__ import BespinTestApp
import simplejson
from path import path

from bespin import config, controllers

from bespin.filesystem import get_project, FileNotFound, _find_common_base
from bespin.database import User, Base

tarfilename = os.path.join(os.path.dirname(__file__), "ut.tgz")
zipfilename = os.path.join(os.path.dirname(__file__), "ut.zip")
otherfilename = os.path.join(os.path.dirname(__file__), "other_import.tgz")
with_tabs = os.path.join(os.path.dirname(__file__), "ProjectWithTabs.tgz")

app = None
macgyver = None
someone_else = None
murdoc = None

def setup_module(module):
    global app
    config.set_profile('test')
    app = controllers.make_app()
    app = BespinTestApp(app)
    
def _init_data():
    global macgyver, someone_else, murdoc
    config.activate_profile()

    fsroot = config.c.fsroot
    if fsroot.exists() and fsroot.basename() == "testfiles":
        fsroot.rmtree()
    fsroot.makedirs()

    app.reset()

    Base.metadata.drop_all(bind=config.c.dbengine)
    Base.metadata.create_all(bind=config.c.dbengine)
    s = config.c.session_factory()

    someone_else = User.create_user("SomeoneElse", "", "someone@else.com")
    murdoc = User.create_user("Murdoc", "", "murdoc@badpeople.bad")
    
    otherproject = get_project(someone_else, someone_else,
                                            "otherproject", create=True)
    otherproject.save_file('foo', 'Just a file to reserve a project')
    
    app.post("/register/new/MacGyver", 
        dict(password="richarddean", email="rich@sg1.com"))
        
    macgyver = User.find_user("MacGyver")

def test_project_deletion():
    _init_data()
    bigmac = get_project(macgyver, macgyver, "bigmac", create=True)
    bigmac.save_file("foo/bar/baz", "biz")
    bigmac.delete()
    flist = macgyver.projects
    assert "bigmac" not in flist

def test_template_installation():
    _init_data()
    bigmac = get_project(macgyver, macgyver, "bigmac", create=True)
    bigmac.install_template()
    data = bigmac.get_file("readme.txt")
    bigmac.close("readme.txt")
    assert "Welcome to Bespin" in data
    result = bigmac.list_files()
    result_names = [file.name for file in result]
    assert 'readme.txt' in result_names
    
def test_customized_template_installation():
    _init_data()
    bigmac = get_project(macgyver, macgyver, "bigmac", create=True)
    here = path(__file__).dirname().abspath()
    config.c.template_path.append(here)
    bigmac.install_template("ttemplate", other_vars={'answer': 42})
    flist = bigmac.list_files()
    fnlist = [f.name for f in bigmac.list_files()]
    assert fnlist == ["newfile-bigmac.js"]
    contents = flist[0].data
    print contents
    assert contents == """// newfile-bigmac.js
// Created by MacGyver (who likes the number 42)

alert("Welcome to bigmac");
"""
    
def test_common_base_selection():
    tests = [
        (["foo.js", "bar.js"], ""),
        (["usertemplate/", "usertemplate/foo.js", "usertemplate/bar.js"], "usertemplate/")
    ]
    def run_one(input, output):
        print "Testing %s" % (input)
        actual = _find_common_base(input)
        assert actual == output
    for input, output in tests:
        yield run_one, input, output
    
def test_import():
    tests = [
        ("import_tarball", tarfilename),
        ("import_zipfile", zipfilename)
    ]
    
    def run_one(func, f):
        print "Testing %s on %s" % (func, f)
        handle = open(f)
        _init_data()
        bigmac = get_project(macgyver, macgyver, "bigmac", create=True)
        getattr(bigmac, func)(os.path.basename(f), handle)
        handle.close()
        print bigmac.location
        proj_names = [proj.name for proj in macgyver.projects]
        assert 'bigmac' in proj_names
        filenames = [f.basename() for f in bigmac.location.files()]
        assert "config.js" in filenames
        dirnames = [f.basename() for f in bigmac.location.dirs()]
        assert 'commands' in dirnames
        filenames = [f.basename() for f in (bigmac.location / "commands").files()]
        assert 'yourcommands.js' in filenames
    
    for test in tests:
        yield run_one, test[0], test[1]
    
def test_reimport_wipes_out_the_project():
    tests = [
        ("import_tarball", tarfilename),
        ("import_zipfile", zipfilename)
    ]
    
    def run_one(func, f):
        global macgyver
        print "Testing %s" % (func)
        handle = open(f)
        _init_data()
        bigmac = get_project(macgyver, macgyver, "bigmac", create=True)
        getattr(bigmac, func)(os.path.basename(f), handle)
        handle.close()
        flist = bigmac.list_files()
        flist = [item.name for item in flist]
        assert flist == ["commands/", "config.js", "scratchpad/"]
        
        handle = open(otherfilename)
        bigmac = get_project(macgyver, macgyver, "bigmac", clean=True)
        bigmac.import_tarball(os.path.basename(f), handle)
        flist = bigmac.list_files()
        flist = [item.name for item in flist]
        assert flist == ["README"]
        
    for test in tests:
        yield run_one, test[0], test[1]
        
def test_export_tarfile():
    _init_data()
    handle = open(tarfilename)
    bigmac = get_project(macgyver, macgyver, "bigmac", create=True)
    bigmac.import_tarball(os.path.basename(tarfilename), handle)
    handle.close()
    tempfilename = bigmac.export_tarball()
    tfile = tarfile.open(tempfilename.name)
    members = tfile.getmembers()
    assert len(members) == 6
    names = set(member.name for member in members)
    # the extra slash shows up in this context, but does not seem to be a problem
    assert 'bigmac//' in names

def test_export_zipfile():
    _init_data()
    handle = open(tarfilename)
    bigmac = get_project(macgyver, macgyver, "bigmac", create=True)
    bigmac.import_tarball(os.path.basename(tarfilename), handle)
    handle.close()
    tempfilename = bigmac.export_zipfile()
    zfile = zipfile.ZipFile(tempfilename.name)
    members = zfile.infolist()
    assert len(members) == 3
    names = set(member.filename for member in members)
    # the extra slash shows up in this context, but does not seem to be a problem
    assert 'bigmac/commands/yourcommands.js' in names


# -------
# Web tests
# -------
    
def test_create_a_project_from_the_web():
    _init_data()
    app.put("/file/at/bigmac/")
    project_names = [project.name for project in macgyver.projects]
    assert 'bigmac' in project_names
    bigmac = get_project(macgyver, macgyver, 'bigmac')
    assert not bigmac.list_files()
    
def test_import_from_the_web():
    tests = [tarfilename, zipfilename]
    
    def run_one(f):
        _init_data()
        filename = os.path.basename(f)
        print "Trying %s" % filename
        app.post("/project/import/newproj", upload_files=[
            ("filedata", filename, open(f).read())
        ])
        resp = app.get("/file/at/newproj/config.js")
        assert resp.body == ""
        app.post("/file/close/newproj/config.js")
    
    for test in tests:
        yield run_one, test
    
def test_import_unknown_file_type():
    _init_data()
    app.post("/project/import/newproj", upload_files=[
        ("filedata", "foo.bar", "Some dummy text")
    ], status=400)
    
def test_export_unknown_file_type():
    _init_data()
    bigmac = get_project(macgyver, macgyver, "bigmac", create=True)
    bigmac.save_file("foo/bar", "INFO!")
    app.get("/project/export/bigmac.foo", status=404)
    
def test_export_tarball_from_the_web():
    _init_data()
    bigmac = get_project(macgyver, macgyver, "bigmac", create=True)
    bigmac.save_file("foo/bar", "INFO!")
    resp = app.get("/project/export/bigmac.tgz")
    assert resp.content_type == "application/x-tar-gz"
    tfile = tarfile.open("bigmac.tgz", "r:gz", StringIO(resp.body))
    members = tfile.getmembers()
    assert len(members) == 3
    membersnames = [member.name for member in members]
    assert "bigmac/foo/bar" in membersnames

def test_export_zipfile_from_the_web():
    _init_data()
    bigmac = get_project(macgyver, macgyver, "bigmac", create=True)
    bigmac.save_file("foo/bar", "INFO!")
    resp = app.get("/project/export/bigmac.zip")
    assert resp.content_type == "application/zip"
    zfile = zipfile.ZipFile(StringIO(resp.body))
    members = zfile.infolist()
    assert len(members) == 1
    assert "bigmac/foo/bar" == members[0].filename
    
def test_delete_project_from_the_web():
    global macgyver
    _init_data()
    bigmac = get_project(macgyver, macgyver, "bigmac", create=True)
    bigmac.save_file("README.txt", "This is the readme file.")
    resp = app.delete("/file/at/bigmac/")
    assert len(macgyver.projects) == 2
    
def test_rename_project():
    _init_data()
    app.post("/project/rename/bigmac/", "foobar", status=404)
    app.put("/file/at/bigmac/")
    
    bigmac = get_project(macgyver, macgyver, "bigmac")
    bigmac.metadata['hello'] = "world"
    
    app.post("/project/rename/bigmac/", "foobar")
    try:
        bigmac = get_project(macgyver, macgyver, "bigmac")
        assert False, "The bigmac project should have been renamed"
    except FileNotFound:
        pass
    foobar = get_project(macgyver, macgyver, "foobar")
    assert foobar.metadata['hello'] == 'world'
    
    app.put("/file/at/bigmac/")
    # should get a conflict error if you try to rename to a project
    # that exists
    app.post("/project/rename/foobar/", "bigmac", status=409)
    
def test_install_template_from_the_web():
    _init_data()
    app.post("/project/template/bigmac/", '{"templateName" : "/etc/passwd"}', status=400)
    app.post("/project/template/bigmac/", '{"templateName" : "../foo"}', status=400)
    app.post("/project/template/bigmac/", '{"templateName" : "ttemplate"}')
    resp = app.get("/file/list/bigmac/")
    files = simplejson.loads(resp.body)
    assert files[0]['name'] == "newfile-bigmac.js"
    
def test_basic_project_metadata_use():
    _init_data()
    bigmac = get_project(macgyver, macgyver, "bigmac", create=True)
    metadata = bigmac.metadata
    try:
        value = metadata['remote_auth']
        assert False, "should have gotten key error for unset value"
    except KeyError:
        pass
    
    metadata['remote_auth'] = "both"
    metadata.close()
    
    bigmac = get_project(macgyver, macgyver, "bigmac")
    metadata = bigmac.metadata
    # this should re-open the database and retrieve the value
    value = metadata['remote_auth']
    assert value == "both"
    
    metadata['remote_auth'] = "write"
    metadata.close()
    
    bigmac = get_project(macgyver, macgyver, "bigmac")
    metadata = bigmac.metadata
    # this should re-open the database and retrieve the value
    value = metadata['remote_auth']
    assert value == "write"
    
    del metadata['remote_auth']
    
    try:
        value = metadata['remote_auth']
        assert False, "expected key to be gone from DB"
    except KeyError:
        pass
    