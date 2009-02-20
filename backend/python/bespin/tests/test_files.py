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

def test_basic_file_creation():
    fm = _get_fm()
    starting_point = macgyver.amount_used
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "reqs", "Chewing gum wrapper")
    file_obj = fm.session.query(model.File).filter_by(name="reqs") \
                .filter_by(project=bigmac).one()
    data = str(file_obj.data)
    assert data == 'Chewing gum wrapper'
    assert file_obj.saved_size == 19
    ending_point = macgyver.amount_used
    difference = ending_point - starting_point
    assert difference == 19
    
    now = datetime.now()
    assert now - file_obj.created < timedelta(seconds=2)
    
    file_obj.created = file_obj.created - timedelta(days=1)
    fm.session.flush()
    
    bigmac = fm.get_project(macgyver, macgyver, "bigmac")
    files = fm.list_files(macgyver, bigmac, "")
    assert len(files) == 1
    assert files[0].name == 'reqs'
    proj_names = set([proj.name for proj in macgyver.projects])
    assert proj_names == set(['bigmac', "SampleProject", 
                              "BespinSettings"])
    
    # let's update the contents
    fm.save_file(macgyver, bigmac, "reqs", "New content")
    file_obj = fm.session.query(model.File).filter_by(name="reqs") \
            .filter_by(project=bigmac).one()
    
    assert now - file_obj.created < timedelta(days=1, seconds=2)
    assert now - file_obj.modified < timedelta(seconds=2)
    
    assert file_obj.data == 'New content'
    fm.session.rollback()
    
def test_changing_file_contents_changes_amount_used():
    fm = _get_fm()
    starting_point = macgyver.amount_used
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo", "step 1")
    assert macgyver.amount_used == starting_point + 6
    fm.save_file(macgyver, bigmac, "foo", "step two")
    assert macgyver.amount_used == starting_point + 8
    
def test_cannot_save_beyond_quota():
    fm = _get_fm()
    old_units = model.QUOTA_UNITS
    model.QUOTA_UNITS = 10
    try:
        fm.save_file(macgyver, "bigmac", "foo", "x" * 11)
        assert False, "Expected an OverQuota exception"
    except model.OverQuota:
        pass
    finally:
        model.QUOTA_UNITS = old_units
        
def test_amount_used_can_be_recomputed():
    fm = _get_fm()
    starting_point = macgyver.amount_used
    macgyver.amount_used = 0
    fm.recompute_used(macgyver)
    assert macgyver.amount_used == starting_point
    
    
def test_retrieve_file_obj():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "reqs", "tenletters")
    try:
        fm.get_file_object(macgyver, bigmac, "foo/bar")
        assert False, "expected file not found for missing file"
    except model.FileNotFound:
        pass
        
    file_obj = fm.get_file_object(macgyver, bigmac, "reqs")
    assert file_obj.saved_size == 10
        

def test_error_if_you_try_to_replace_dir_with_file():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo/bar/baz", "biz")
    try:
        fm.save_file(macgyver, bigmac, "foo/bar", "NOT GONNA DO IT!")
        assert False, "Expected a FileConflict exception"
    except model.FileConflict:
        pass
    
def test_get_file_opens_the_file():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo/bar/baz", "biz")
    contents = fm.get_file(macgyver, bigmac, "foo/bar/baz")
    assert contents == "biz"
    
    s = fm.session
    file_obj = s.query(File).filter_by(name="foo/bar/baz") \
                .filter_by(project=bigmac).one()
    files = [f.file for f in macgyver.files]
    assert file_obj in files
    
    open_files = fm.list_open(macgyver)
    print "OF: ", open_files
    info = open_files['bigmac']['foo/bar/baz']
    assert info['mode'] == "rw"
    
    fm.close(macgyver, bigmac, "foo")
    # does nothing, because we don't have that one open
    open_files = fm.list_open(macgyver)
    info = open_files['bigmac']['foo/bar/baz']
    assert info['mode'] == "rw"
    
    fm.close(macgyver, bigmac, "foo/bar/baz")
    open_files = fm.list_open(macgyver)
    assert open_files == {}

def test_get_file_raises_exception_if_its_a_directory():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo/bar/baz", "biz")
    try:
        contents = fm.get_file(macgyver, bigmac, "foo/bar/")
        assert False, "Expected exception for directory"
    except model.FSException:
        pass
    
def test_get_file_raises_not_found_exception():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo/bar/baz", "biz")
    try:
        contents = fm.get_file(macgyver, bigmac, "NOTFOUND")
        assert False, "Expected exception for not found"
    except model.FileNotFound:
        pass
    
def test_directory_shortname_computed_to_have_last_dir():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo/bar/baz", "biz")
    res = fm.list_files(macgyver, bigmac, "foo/")
    assert len(res) == 1
    d = res[0]
    shortname = d.short_name
    assert shortname == "bar/"
    
    
def test_delete_raises_file_not_found():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    try:
        fm.delete(macgyver, bigmac, "DOESNT MATTER")
        assert False, "Expected not found for missing project"
    except model.FileNotFound:
        pass
    fm.save_file(macgyver, bigmac, "foo/bar/baz", "biz")
    try:
        fm.delete(macgyver, bigmac, "STILL DOESNT MATTER")
        assert False, "Expected not found for missing file"
    except model.FileNotFound:
        pass
    flist = fm.list_files(macgyver, bigmac)
    assert flist[0].name == "foo/"
    fm.delete(macgyver, bigmac, "foo/bar/")
    
def test_authorize_other_user():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo/bar/baz", "biz")
    fm.authorize_user(macgyver, bigmac, someone_else)
    b2 = fm.get_project(someone_else, macgyver, "bigmac")
    assert b2.name == "bigmac"
    
    fm.unauthorize_user(macgyver, bigmac, someone_else)
    try:
        b2 = fm.get_project(someone_else, macgyver, "bigmac")
        assert False, "Should have not been authorized any more"
    except model.NotAuthorized:
        pass
    
    
def test_only_owner_can_authorize_user():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo/bar/baz", "biz")
    fm.authorize_user(macgyver, bigmac, someone_else)
    yet_another = fm.db.user_manager.create_user("YetAnother", "", "yet@another.user")
    try:
        fm.authorize_user(someone_else, bigmac, yet_another)
        assert False, "Should not have been allowed to authorize with non-owner"
    except model.NotAuthorized:
        pass
    
    try:
        fm.unauthorize_user(someone_else, bigmac, macgyver)
        assert False, "Should not have been allowed to unauthorize with non-owner"
    except model.NotAuthorized:
        pass
    
def test_cannot_delete_file_open_by_someone_else():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo/bar/baz", "biz")
    fm.authorize_user(macgyver, bigmac, someone_else)
    fm.get_file(macgyver, bigmac, "foo/bar/baz")
    try:
        fm.delete(someone_else, bigmac, "foo/bar/baz")
        assert False, "Expected FileConflict exception for deleting open file"
    except model.FileConflict:
        pass
        
def test_can_delete_file_open_by_me():
    fm = _get_fm()
    s = fm.session
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo/bar/baz", "biz")
    fm.get_file(macgyver, bigmac, "foo/bar/baz")
    file_obj_id = s.query(File).filter_by(name="foo/bar/baz") \
                .filter_by(project=bigmac).one().id
    fm.delete(macgyver, bigmac, "foo/bar/baz")
    fs = fm.session.query(FileStatus).filter_by(file_id=file_obj_id).first()
    assert fs is None
    
def test_successful_deletion():
    fm = _get_fm()
    starting_used = macgyver.amount_used
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo/bar/baz", "biz")
    fm.delete(macgyver, bigmac, "foo/bar/baz")
    assert macgyver.amount_used == starting_used
    try:
        fm.get_file(macgyver, bigmac, "foo/bar/baz")
        assert False, "Expected FileNotFound because the file is gone"
    except model.FileNotFound:
        pass
    files = fm.list_files(macgyver, bigmac, "foo/bar/")
    assert not files
    
def test_top_level_deletion():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo", "data")
    fm.delete(macgyver, bigmac, "foo")
    flist = fm.list_files(macgyver, bigmac)
    assert flist == []
    
def test_directory_deletion():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "whiz/bang", "stillmore")
    starting_used = macgyver.amount_used
    fm.save_file(macgyver, bigmac, "foo/bar", "data")
    fm.save_file(macgyver, bigmac, "foo/blorg", "moredata")
    fm.delete(macgyver, bigmac, "foo/")
    flist = fm.list_files(macgyver, bigmac)
    assert len(flist) == 1
    assert flist[0].name == 'whiz/'
    file = fm.session.query(File).filter_by(name="foo/bar") \
                        .filter_by(project=bigmac).first()
    assert file is None
    assert macgyver.amount_used == starting_used
    
def test_project_deletion():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo/bar/baz", "biz")
    fm.delete(macgyver, bigmac)
    flist = fm.list_files(macgyver)
    assert "bigmac" not in flist
    assert 'bigmac' not in macgyver.projects

def test_basic_edit_functions():
    fm = _get_fm()
    s = fm.session
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    bigmac2 = fm.get_project(someone_else, someone_else, "bigmac", create=True)
    fm.save_edit(macgyver, bigmac, "foo/bar/baz", "['edit', 'thinger']")
    fm.save_edit(someone_else, bigmac2, "foo/bar/baz", "['some', 'thing']")
    file_obj = s.query(File).filter_by(name="foo/bar/baz") \
                .filter_by(project=bigmac).one()
    assert len(file_obj.edits) == 1
    
    try:
        content = fm.get_file(macgyver, bigmac, "foo/bar/baz")
        assert False, "Files are not retrievable until the edits are saved"
    except model.FileNotFound:
        pass
        
    files = fm.list_open(macgyver)
    info = files['bigmac']['foo/bar/baz']
    assert info['mode'] == "rw"
    
    edits = fm.list_edits(macgyver, bigmac, "foo/bar/baz")
    assert edits == ["['edit', 'thinger']"]
    
    fm.save_edit(macgyver, bigmac, "foo/bar/baz", "['second', 'edit']")
    edits = fm.list_edits(macgyver, bigmac, "foo/bar/baz")
    assert edits == ["['edit', 'thinger']", "['second', 'edit']"]
    edits = fm.list_edits(macgyver, bigmac, "foo/bar/baz", 1)
    assert edits == ["['second', 'edit']"]
    
    try:
        edits = fm.list_edits(macgyver, bigmac, "foo/bar/baz", 2)
        assert False, "Expected FSException for out-of-bounds start point"
    except model.FSException:
        pass
    
def test_reset_edits():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_edit(macgyver, bigmac, "foo/bar/baz", "['edit', 'thinger']")
    fm.reset_edits(macgyver, bigmac, "foo/bar/baz")
    edits = fm.list_edits(macgyver, bigmac, "foo/bar/baz")
    assert edits == []
    files = fm.list_open(macgyver)
    assert files == {}
    
    fm.save_edit(macgyver, bigmac, "foo/bar/baz", "['edit', 'thinger']")
    fm.save_edit(macgyver, bigmac, "foo/bar/blork", "['edit', 'thinger']")
    files = fm.list_open(macgyver)
    bigmac_files = files['bigmac']
    assert len(bigmac_files) == 2
    fm.reset_edits(macgyver)
    files = fm.list_open(macgyver)
    assert files == {}
    edits = fm.list_edits(macgyver, bigmac, "foo/bar/baz")
    assert edits == []
    
def test_edits_cleared_after_save():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_edit(macgyver, bigmac, "foo/bar/baz", "['edit', 'thinger']")
    fm.save_file(macgyver, bigmac, "foo/bar/baz", "macaroni")
    edits = fm.list_edits(macgyver, bigmac, "foo/bar/baz")
    assert edits == []

def test_edits_cleared_after_close():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo/bar/baz", "macaroni")
    fm.get_file(macgyver, bigmac, "foo/bar/baz")
    fm.save_edit(macgyver, bigmac, "foo/bar/baz", "['edit', 'thinger']")
    fm.close(macgyver, bigmac, "foo/bar/baz")
    edits = fm.list_edits(macgyver, bigmac, "foo/bar/baz")
    assert edits == []
    
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
    
def test_list_top_level():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "readme.txt", "Hi there!")
    result = fm.list_files(macgyver, bigmac)
    result_names = [file.name for file in result]
    assert result_names == ["readme.txt"]
    result = fm.list_files(macgyver)
    result_names = [proj.name for proj in result]
    assert result_names == ["BespinSettings",
                            "SampleProject", "bigmac"]
    
    
def test_secondary_objects_are_saved_when_creating_new_file():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "foo/bar", "Data")
    project_names = [proj.name for proj in macgyver.projects]
    assert "bigmac" in project_names
    bigmac_obj = fm.session.query(Directory).filter_by(name="")\
                    .filter_by(project=bigmac).one()
    assert bigmac_obj.subdirs[0].name == "foo/"
    
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

def test_delete_does_not_affect_other_projects():
    global macgyver, someone_else
    fm = _get_fm()
    bigmac1 = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac1, "bar/foo", "bar!")
    fm.save_file(macgyver, bigmac1, "bar/foobar", "yo")
    bigmac2 = fm.get_project(someone_else, someone_else, "bigmac", create=True)
    fm.save_file(someone_else, bigmac2, "other/myfoo", "double bar!")
    fm.save_file(someone_else, bigmac2, "bar/foo", "this one is mine!")
    assert len(macgyver.projects) == 3
    assert len(someone_else.projects) == 3
    
    fm.delete(macgyver, bigmac1, "bar/foo")
    flist = fm.list_files(macgyver, bigmac1, "bar/")
    assert len(flist) == 1
    flist = fm.list_files(someone_else, bigmac2, "bar/")
    assert len(flist) == 1
    
    fm.delete(macgyver, bigmac1)
    
    s = fm.session
    s.expire(macgyver)
    s.expire(someone_else)
    macgyver = s.query(User).filter_by(username='MacGyver').one()
    someone_else = s.query(User).filter_by(username='SomeoneElse').one()
    assert len(macgyver.projects) == 2
    assert len(someone_else.projects) == 3
    flist = fm.list_files(someone_else, bigmac2)
    assert len(flist) == 2
    assert flist[0].name == "bar/"
    file_obj = fm.get_file_object(someone_else, bigmac2, "other/myfoo")
    assert str(file_obj.data) == "double bar!"
    try:
        file_obj = fm.get_file_object(macgyver, bigmac1, "bar/foo")
        assert False, "File should be gone"
    except model.FileNotFound:
        pass
        

# -------
# Web tests
# -------
    
def test_good_file_operations_from_web():
    fm = _get_fm()
    s = fm.session
    app.put("/file/at/bigmac/reqs", "Chewing gum wrapper")
    fileobj = s.query(File).filter_by(name="reqs").one()
    fileobj.created = datetime(2009, 2, 3, 10, 0, 0)
    fileobj.modified = datetime(2009, 2, 4, 11, 30, 30)
    s.commit()
    contents = str(fileobj.data)
    assert contents == "Chewing gum wrapper"
    
    resp = app.get("/file/at/bigmac/reqs")
    assert resp.body == "Chewing gum wrapper"
    resp = app.get("/file/listopen/")
    assert resp.content_type == "application/json"
    data = simplejson.loads(resp.body)
    bigmac_data = data['bigmac']
    assert len(bigmac_data) == 1
    assert bigmac_data['reqs']['mode'] == "rw"
    app.post("/file/close/bigmac/reqs")
    
    resp = app.get("/file/at/bigmac/reqs?mode=r")
    assert resp.body == "Chewing gum wrapper"
    
    resp = app.get("/file/list/bigmac/")
    data = simplejson.loads(resp.body)
    assert data[0]['openedBy'] == ['MacGyver']
    
    resp = app.get("/file/listopen/")
    data = simplejson.loads(resp.body)
    bigmac_data = data['bigmac']
    assert len(bigmac_data) == 1
    assert bigmac_data['reqs']['mode'] == "r"
    app.post("/file/close/bigmac/reqs")
    resp = app.get("/file/listopen/")
    data = simplejson.loads(resp.body)
    assert data == {}
    
    resp = app.get("/file/list/")
    data = simplejson.loads(resp.body)
    assert data == [{'name' : 'BespinSettings/'},
                    {'name' : 'SampleProject/'}, 
                    {'name' : 'bigmac/'}]
    
    resp = app.get("/file/list/SampleProject/")
    data = simplejson.loads(resp.body)
    assert data[1]['name'] == 'index.html'
    
    resp = app.get("/file/list/bigmac/")
    assert resp.content_type == "application/json"
    data = simplejson.loads(resp.body)
    assert len(data) == 1
    data = data[0]
    assert data['name'] == 'reqs'
    assert data['size'] == 19
    assert data['created'] == "20090203T100000"
    assert data['modified'] == '20090204T113030'
    
    app.delete("/file/at/bigmac/reqs")
    resp = app.get("/file/list/bigmac/")
    data = simplejson.loads(resp.body)
    assert data == []
    
    
def test_error_conditions_from_web():
    fm = _get_fm()
    app.get("/file/at/bigmac/UNKNOWN", status=404)
    app.put("/file/at/bigmac/bar/baz", "A file in bar")
    app.put("/file/at/bigmac/bar", "A file to replace bar", status=409)
    app.get("/file/at/bigmac/bar/baz")
    app.get("/file/at/bigmac", status=400)
    app.get("/file/at/bigmac/", status=404)
    app.get("/file/at/", status=400)

def test_edit_interface():
    fm = _get_fm()
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
    bigmac_data = data['bigmac']
    assert len(bigmac_data) == 1
    assert bigmac_data['bar/baz']['mode'] == 'rw'
    
    app.post("/edit/reset/")
    resp = app.get("/edit/list/bigmac/bar/baz")
    data = simplejson.loads(resp.body)
    assert data == []
    
    app.put("/edit/at/bigmac/bar/baz", "Starting a file")
    app.post("/edit/reset/bigmac/bar/baz")
    resp = app.get("/edit/list/bigmac/bar/baz")
    data = simplejson.loads(resp.body)
    assert data == []
    
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
    
def test_get_file_stats_from_web():
    fm = _get_fm()
    s = fm.session
    app.put("/file/at/bigmac/reqs", "Chewing gum wrapper")
    resp = app.get("/file/stats/bigmac/reqs")
    assert resp.content_type == "application/json"
    data = simplejson.loads(resp.body)
    assert data['size'] == 19
    
def test_preview_mode():
    fm = _get_fm()
    bigmac = fm.get_project(macgyver, macgyver, "bigmac", create=True)
    fm.save_file(macgyver, bigmac, "README.txt", 
        "This is the readme file.")
    fm.session.commit()
    
    resp = app.get("/preview/at/bigmac/", status=404)
    resp = app.get("/preview/at/bigmac/README.txt")
    assert resp.body == "This is the readme file."
    assert resp.content_type == "text/plain"
    
    fm.save_file(macgyver, bigmac, "index.html",
        "<html><body>Simple HTML file</body></html>")
    fm.session.commit()
    resp = app.get("/preview/at/bigmac/index.html")
    assert resp.body == "<html><body>Simple HTML file</body></html>"
    assert resp.content_type == "text/html"
    
def test_quota_limits_on_the_web():
    fm = _get_fm()
    old_units = model.QUOTA_UNITS
    model.QUOTA_UNITS = 10
    try:
        resp = app.put("/file/at/bigmac/foo", "x" * 11, status=400)
        assert resp.body == "Over quota"
    finally:
        model.QUOTA_UNITS = old_units
    
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
    