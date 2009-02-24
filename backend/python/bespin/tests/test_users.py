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

from webtest import TestApp
import simplejson

from bespin import config, controllers, model
from bespin.model import User, UserManager, FileManager, File

def setup_module(module):
    config.set_profile("test")
    config.activate_profile()
    
def _clear_db():
    model.Base.metadata.drop_all(bind=config.c.dbengine)
    model.Base.metadata.create_all(bind=config.c.dbengine)
    
def _get_user_manager(clear=False):
    if clear:
        _clear_db()
    s = config.c.sessionmaker(bind=config.c.dbengine)
    user_manager = UserManager(s)
    file_manager = FileManager(s)
    db = model.DB(user_manager, file_manager)
    return s, user_manager
    
# Model tests    
def test_create_new_user():
    s, user_manager = _get_user_manager(True)
    num_users = s.query(User).count()
    assert num_users == 0
    user = user_manager.create_user("BillBixby", "hulkrulez", "bill@bixby.com")
    num_users = s.query(User).count()
    assert num_users == 1
    
def test_create_duplicate_user():
    s, user_manager = _get_user_manager(True)
    user_manager.create_user("BillBixby", "somepass", "bill@bixby.com")
    s.commit()
    try:
        user_manager.create_user("BillBixby", "otherpass", "bill@bixby.com")
        assert False, "Should have gotten a ConflictError"
    except model.ConflictError:
        pass
    s, user_manager = _get_user_manager(False)
    user = user_manager.get_user("BillBixby")
    assert user.password == "somepass", "Password should not have changed"
    
def test_get_user_returns_none_for_nonexistent():
    s, user_manager = _get_user_manager(True)
    user = user_manager.get_user("NOT THERE. NO REALLY!")
    assert user is None
    

# Controller Tests

def test_register_returns_empty_when_not_logged_in():
    app = controllers.make_app()
    app = TestApp(app)
    resp = app.get('/register/userinfo/', status=401)
    assert resp.body == ""
    
def test_register_and_verify_user():
    config.activate_profile()
    _clear_db()
    s, user_manager = _get_user_manager()
    app = controllers.make_app()
    app = TestApp(app)
    resp = app.post('/register/new/BillBixby', dict(email="bill@bixby.com",
                                                    password="notangry"))
    assert resp.content_type == "application/json"
    data = simplejson.loads(resp.body)
    assert data == {}
    assert resp.cookies_set['auth_tkt']
    assert app.cookies
    fm = user_manager.db.file_manager
    billbixby = user_manager.get_user("BillBixby")
    sample_project = fm.get_project(billbixby, billbixby, "SampleProject")
    file = s.query(File).filter_by(name="readme.txt") \
        .filter_by(project=sample_project).one()
    svnfiles = list(s.query(File).filter(File.name.like("%s.svn%s")).all())
    assert not svnfiles
    
    # should be able to run again without an exception appearing
    resp = app.post('/register/new/BillBixby', dict(email="bill@bixby.com",
                                                    password="notangry"),
                    status=409)
    
    # with the cookie set, we should be able to retrieve the 
    # logged in name
    resp = app.get('/register/userinfo/')
    assert resp.content_type == 'application/json'
    data = simplejson.loads(resp.body)
    assert data['username'] == 'BillBixby'
    assert 'quota' in data
    assert data['quota'] == 15000000
    assert 'amountUsed' in data
    
    resp = app.get("/file/at/BespinSettings/config.js")
    app.post("/file/close/BespinSettings/config.js")
    
def test_logout():
    s, user_manager = _get_user_manager(True)
    user_manager.create_user("BillBixby", "hulkrulez", "bill@bixby.com")
    app = controllers.make_app()
    app = TestApp(app)
    resp = app.post("/register/login/BillBixby", 
        dict(password='hulkrulez'))
    resp = app.get("/register/logout/")
    assert resp.cookies_set['auth_tkt'] == '""'
    
def test_bad_login_yields_401():
    s, user_manager = _get_user_manager(True)
    user_manager.create_user("BillBixby", "hulkrulez", "bill@bixby.com")
    app = controllers.make_app()
    app = TestApp(app)
    resp = app.post("/register/login/BillBixby",
        dict(password="NOTHULK"), status=401)
    
def test_login_without_cookie():
    s, user_manager = _get_user_manager(True)
    user_manager.create_user("BillBixby", "hulkrulez", "bill@bixby.com")
    app = controllers.make_app()
    app = TestApp(app)
    resp = app.post("/register/login/BillBixby",
        dict(password="hulkrulez"))
    assert resp.cookies_set['auth_tkt']
    
def test_static_files_with_auth():
    _clear_db()
    app = controllers.make_app()
    app = TestApp(app)
    resp = app.get('/editor.html', status=302)
    assert resp.location == "http://localhost/"
    resp = app.post('/register/new/Aldus', dict(password="foo", 
                                                email="a@b.com"))
    resp = app.get('/editor.html')

def test_register_existing_user_should_not_authenticate():
    s, user_manager = _get_user_manager(True)
    app_orig = controllers.make_app()
    app = TestApp(app_orig)
    resp = app.post('/register/new/BillBixby', dict(email="bill@bixby.com",
                                                    password="notangry"))
    app = TestApp(app_orig)
    resp = app.post("/register/new/BillBixby", dict(email="bill@bixby.com",
                                                    password="somethingelse"),
                    status=409)
    assert not resp.cookies_set
    user = user_manager.get_user("BillBixby")
    assert user.password == 'notangry'
    
def test_bad_ticket_is_ignored():
    _clear_db()
    app = controllers.make_app()
    app = TestApp(app)
    resp = app.post("/register/new/Aldus", dict(password="foo", 
                                        email="a@b.com"))
    app.cookies['auth_tkt'] = app.cookies['auth_tkt'][:-1]
    resp = app.get("/preview/at/SampleProjectFor%3AAldus/index.html", status=401)

def test_api_version_header():
    app = controllers.make_app()
    app = TestApp(app)    
    resp = app.get("/register/userinfo/", status=401)
    assert resp.headers.get("X-Bespin-API") == "dev"
    
def test_username_with_bad_characters():
    app = controllers.make_app()
    app = TestApp(app)
    resp = app.post("/register/new/Thinga%20Majig",
            dict(password="foo", email="thinga@majig"), status=400)
    resp = app.post("/register/new/Thinga<majig>",
            dict(password="foo", email="thinga@majig"), status=400)
    