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
from datetime import datetime, timedelta

from webtest import TestApp
import simplejson

from bespin import config, controllers, model

from bespin.model import File, Project, User, FileStatus, Directory

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
    app = TestApp(app)
    
def _get_fm():
    global macgyver, someone_else, murdoc
    config.activate_profile()
    app.reset()
    model.Base.metadata.drop_all(bind=config.c.dbengine)
    model.Base.metadata.create_all(bind=config.c.dbengine)
    s = config.c.sessionmaker(bind=config.c.dbengine)
    user_manager = model.UserManager(s)
    file_manager = model.FileManager(s)
    db = model.DB(user_manager, file_manager)
    someone_else = user_manager.create_user("SomeoneElse", "", "someone@else.com")
    murdoc = user_manager.create_user("Murdoc", "", "murdoc@badpeople.bad")
    otherproject = file_manager.get_project(someone_else, someone_else,
                                            "otherproject", create=True)
    file_manager.save_file(someone_else, otherproject, 'foo', 
                 'Just a file to reserve a project')
    app.post("/register/new/MacGyver", 
        dict(password="richarddean", email="rich@sg1.com"))
    macgyver = user_manager.get_user("MacGyver")
    return file_manager

def test_project_deletion():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo/bar/baz", "biz")
    fm.delete(macgyver, bigmac)
    flist = fm.list_files(macgyver)
    assert "bigmac" not in flist
    assert 'bigmac' not in macgyver.projects

def test_template_installation():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.install_template(macgyver, bigmac)
    data = fm.get_file(macgyver, bigmac, "readme.txt")
    fm.close(macgyver, bigmac, "readme.txt")
    assert "Welcome to Bespin" in data
    result = fm.list_files(macgyver, bigmac)
    result_names = [file.name for file in result]
    assert 'readme.txt' in result_names
    
def test_common_base_selection():
    tests = [
        (["foo.js", "bar.js"], ""),
        (["usertemplate/", "usertemplate/foo.js", "usertemplate/bar.js"], "usertemplate/")
    ]
    def run_one(input, output):
        print "Testing %s" % (input)
        actual = model._find_common_base(input)
        assert actual == output
    for input, output in tests:
        yield run_one, input, output
    
def test_import():
    tests = [
        ("import_tarball", tarfilename),
        ("import_zipfile", zipfilename)
    ]
    
    def run_one(func, f):
        print "Testing %s" % (func)
        handle = open(f)
        fm = _get_fm()
        bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
        getattr(fm, func)(macgyver, bigmac, 
            os.path.basename(f), handle)
        handle.close()
        proj_names = [proj.name for proj in macgyver.projects]
        assert 'bigmac' in proj_names
        s = fm.session
        dir = s.query(Directory).filter_by(name="") \
                .filter_by(project=bigmac).one()
        filenames = [file.name for file in dir.files]
        assert "config.js" in filenames
        dirnames = [d.name for d in dir.subdirs]
        assert 'commands/' in dirnames
        dir = s.query(Directory).filter_by(name="commands/") \
                .filter_by(project=bigmac).one()
        filenames = [file.name for file in dir.files]
        assert 'commands/yourcommands.js' in filenames
    
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
        fm = _get_fm()
        bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
        getattr(fm, func)(macgyver, bigmac, 
            os.path.basename(f), handle)
        handle.close()
        bigmac.members.append(someone_else)
        flist = fm.list_files(macgyver, bigmac)
        flist = [item.name for item in flist]
        assert flist == ["commands/", "config.js", "scratchpad/"]
        
        fm.session.clear()
        
        macgyver = fm.db.user_manager.get_user("MacGyver")
        bigmac = fm.get_project(macgyver, macgyver, "bigmac", clean=True)
        
        handle = open(otherfilename)
        fm.import_tarball(macgyver, bigmac, 
            os.path.basename(f), handle)
        flist = fm.list_files(macgyver, bigmac)
        flist = [item.name for item in flist]
        assert flist == ["README"]
        usernames = [user.username for user in bigmac.members]
        assert 'SomeoneElse' in usernames
        
    for test in tests:
        yield run_one, test[0], test[1]
        
def test_import_converts_tabs_to_spaces():
    # at the moment, the Bespin editor has a hard time with spaces. This
    # behavior will be fixed in the near future.
    fm = _get_fm()
    handle = open(with_tabs)
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.import_tarball(macgyver, bigmac,
        os.path.basename(with_tabs), handle)
    handle.close()
    file_obj = fm.get_file_object(macgyver, bigmac, "FileWithTabs.txt")
    data = str(file_obj.data)
    assert '\t' not in data
    
def test_export_tarfile():
    fm = _get_fm()
    handle = open(tarfilename)
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.import_tarball(macgyver, bigmac,
        os.path.basename(tarfilename), handle)
    handle.close()
    tempfilename = fm.export_tarball(macgyver, bigmac)
    tfile = tarfile.open(tempfilename.name)
    members = tfile.getmembers()
    assert len(members) == 6
    names = set(member.name for member in members)
    # the extra slash shows up in this context, but does not seem to be a problem
    assert 'bigmac//' in names

def test_export_zipfile():
    fm = _get_fm()
    handle = open(tarfilename)
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.import_tarball(macgyver, bigmac,
        os.path.basename(tarfilename), handle)
    handle.close()
    tempfilename = fm.export_zipfile(macgyver, bigmac)
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
    fm = _get_fm()
    app.put("/file/at/bigmac/")
    project_names = [project.name for project in macgyver.projects]
    assert 'bigmac' in project_names
    bigmac = fm.get_project(macgyver, macgyver, 'bigmac')
    s = fm.session
    filelist = s.query(File).filter_by(project=bigmac).all()
    assert not filelist
    
def test_import_from_the_web():
    tests = [tarfilename, zipfilename]
    
    def run_one(f):
        fm = _get_fm()
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
    fm = _get_fm()
    app.post("/project/import/newproj", upload_files=[
        ("filedata", "foo.bar", "Some dummy text")
    ], status=400)
    
def test_export_unknown_file_type():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo/bar", "INFO!")
    app.get("/project/export/bigmac.foo", status=404)
    
def test_export_tarball_from_the_web():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo/bar", "INFO!")
    resp = app.get("/project/export/bigmac.tgz")
    assert resp.content_type == "application/x-tar-gz"
    tfile = tarfile.open("bigmac.tgz", "r:gz", StringIO(resp.body))
    members = tfile.getmembers()
    assert len(members) == 3
    membersnames = [member.name for member in members]
    assert "bigmac/foo/bar" in membersnames

def test_export_zipfile_from_the_web():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo/bar", "INFO!")
    resp = app.get("/project/export/bigmac.zip")
    assert resp.content_type == "application/zip"
    zfile = zipfile.ZipFile(StringIO(resp.body))
    members = zfile.infolist()
    assert len(members) == 1
    assert "bigmac/foo/bar" == members[0].filename
    
def test_delete_project_from_the_web():
    global macgyver
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "README.txt", 
        "This is the readme file.")
    fm.session.commit()
    resp = app.delete("/file/at/bigmac/")
    macgyver = fm.db.user_manager.get_user("MacGyver")
    assert len(macgyver.projects) == 2
    