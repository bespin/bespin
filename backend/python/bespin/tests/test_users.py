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

def setup_module(module):
    config.set_profile("test")
    config.activate_profile()

# Model tests    
def test_create_new_user():
    config.activate_profile()
    user_manager = config.c.user_manager
    assert len(user_manager.store) == 0
    user = user_manager.create_user("BillBixby", "hulkrulez", "bill@bixby.com")
    assert len(user_manager.store) == 1
    assert 'BillBixby' in config.c.saved_keys
    
def test_create_duplicate_user():
    config.activate_profile()
    assert not config.c.saved_keys
    user_manager = config.c.user_manager
    user_manager.create_user("BillBixby", "somepass", "bill@bixby.com")
    try:
        user_manager.create_user("BillBixby", "otherpass", "bill@bixby.com")
        assert False, "Should have gotten a ConflictError"
    except model.ConflictError:
        pass
    user = user_manager.get_user("BillBixby")
    assert user.password == "somepass", "Password should not have changed"
    
def test_get_user_returns_none_for_nonexistent():
    user = config.c.user_manager.get_user("NOT THERE. NO REALLY!")
    assert user is None
    

# Controller Tests

def test_register_returns_empty_when_not_logged_in():
    app = controllers.make_app()
    app = TestApp(app)
    resp = app.get('/register/userinfo/', status=401)
    assert resp.body == ""
    
def test_register_and_verify_user():
    config.activate_profile()
    app = controllers.make_app()
    app = TestApp(app)
    resp = app.post('/register/new/BillBixby', dict(email="bill@bixby.com",
                                                    password="notangry"))
    assert 'BillBixby' in config.c.saved_keys
    assert resp.content_type == "application/json"
    data = simplejson.loads(resp.body)
    assert data['project']
    assert resp.cookies_set['auth_tkt']
    assert app.cookies
    assert 'BillBixby_New_Project/readme.txt' in config.c.file_manager.file_store
    for key in config.c.file_manager.file_store.keys():
        assert '.svn' not in key
    
    # should be able to run again without an exception appearing
    resp = app.post('/register/new/BillBixby', dict(email="bill@bixby.com",
                                                    password="notangry"),
                    status=409)
    
    # with the cookie set, we should be able to retrieve the 
    # logged in name
    resp = app.get('/register/userinfo/')
    assert resp.content_type == 'application/json'
    data = simplejson.loads(resp.body)
    assert 'project' in data
    assert data['username'] == 'BillBixby'
    
    project_id = data['project']
    resp = app.get("/file/at/%s/config.js" % project_id)
    app.post("/file/close/%s/config.js" % project_id)
    
def test_logout():
    config.activate_profile()
    user_manager = config.c.user_manager
    user_manager.create_user("BillBixby", "hulkrulez", "bill@bixby.com")
    app = controllers.make_app()
    app = TestApp(app)
    resp = app.post("/register/login/BillBixby", 
        dict(password='hulkrulez'))
    resp = app.get("/register/logout/")
    assert resp.cookies_set['auth_tkt'] == '""'
    
def test_bad_login_yields_401():
    config.activate_profile()
    user_manager = config.c.user_manager
    user_manager.create_user("BillBixby", "hulkrulez", "bill@bixby.com")
    app = controllers.make_app()
    app = TestApp(app)
    resp = app.post("/register/login/BillBixby",
        dict(password="NOTHULK"), status=401)
    
def test_login_without_cookie():
    config.activate_profile()
    user_manager = config.c.user_manager
    user_manager.create_user("BillBixby", "hulkrulez", "bill@bixby.com")
    app = controllers.make_app()
    app = TestApp(app)
    resp = app.post("/register/login/BillBixby",
        dict(password="hulkrulez"))
    assert resp.cookies_set['auth_tkt']
    
def test_static_files_with_auth():
    config.activate_profile()
    app = controllers.make_app()
    app = TestApp(app)
    resp = app.get('/editor.html', status=302)
    assert resp.location == "http://localhost/"
    resp = app.post('/register/new/Aldus', dict(password="foo", 
                                                email="a@b.com"))
    resp = app.get('/editor.html')

def test_register_existing_user_should_not_authenticate():
    config.activate_profile()
    app_orig = controllers.make_app()
    app = TestApp(app_orig)
    resp = app.post('/register/new/BillBixby', dict(email="bill@bixby.com",
                                                    password="notangry"))
    app = TestApp(app_orig)
    resp = app.post("/register/new/BillBixby", dict(email="bill@bixby.com",
                                                    password="somethingelse"),
                    status=409)
    assert not resp.cookies_set
    user = config.c.user_manager.get_user("BillBixby")
    assert user.password == 'notangry'
    
