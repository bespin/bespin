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

from __init__ import BespinTestApp
import simplejson

from bespin import config, controllers
from bespin.database import User, Base, ConflictError
from bespin.filesystem import get_project

def setup_module(module):
    config.set_profile("test")
    config.activate_profile()
    
def _clear_db():
    Base.metadata.drop_all(bind=config.c.dbengine)
    Base.metadata.create_all(bind=config.c.dbengine)
    fsroot = config.c.fsroot
    if fsroot.exists() and fsroot.basename() == "testfiles":
        fsroot.rmtree()
    fsroot.makedirs()
    
    
def _get_session(clear=False):
    if clear:
        _clear_db()
    s = config.c.session_factory()
    return s
    
# Model tests    
def test_create_new_user():
    s = _get_session(True)
    num_users = s.query(User).count()
    assert num_users == 0
    user = User.create_user("BillBixby", "hulkrulez", "bill@bixby.com")
    assert len(user.uuid) == 36
    num_users = s.query(User).count()
    assert num_users == 1
    
def test_create_duplicate_user():
    s = _get_session(True)
    User.create_user("BillBixby", "somepass", "bill@bixby.com")
    s.commit()
    try:
        User.create_user("BillBixby", "otherpass", "bill@bixby.com")
        assert False, "Should have gotten a ConflictError"
    except ConflictError:
        s.rollback()
    s = _get_session(False)
    user = User.find_user("BillBixby")
    assert user.password == "somepass", "Password should not have changed"
    
def test_get_user_returns_none_for_nonexistent():
    s = _get_session(True)
    user = User.find_user("NOT THERE. NO REALLY!")
    assert user is None
    

# Controller Tests

def test_register_returns_empty_when_not_logged_in():
    app = controllers.make_app()
    app = BespinTestApp(app)
    resp = app.get('/register/userinfo/', status=401)
    assert resp.body == ""
    
def test_register_and_verify_user():
    config.activate_profile()
    _clear_db()
    s = _get_session()
    app = controllers.make_app()
    app = BespinTestApp(app)
    resp = app.post('/register/new/BillBixby', dict(email="bill@bixby.com",
                                                    password="notangry"))
    assert resp.content_type == "application/json"
    data = simplejson.loads(resp.body)
    assert data == {}
    assert resp.cookies_set['auth_tkt']
    assert app.cookies
    billbixby = User.find_user("BillBixby")
    sample_project = get_project(billbixby, billbixby, "SampleProject")
    files = [file.name for file in sample_project.list_files()]
    assert "readme.txt" in files
    
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
    assert data['quota'] == 15728640
    assert 'amountUsed' in data
    
    resp = app.get("/file/at/BespinSettings/config")
    app.post("/file/close/BespinSettings/config")
    
def test_logout():
    s = _get_session(True)
    User.create_user("BillBixby", "hulkrulez", "bill@bixby.com")
    app = controllers.make_app()
    app = BespinTestApp(app)
    resp = app.post("/register/login/BillBixby", 
        dict(password='hulkrulez'))
    resp = app.get("/register/logout/")
    assert resp.cookies_set['auth_tkt'] == '""'
    
def test_bad_login_yields_401():
    s = _get_session(True)
    User.create_user("BillBixby", "hulkrulez", "bill@bixby.com")
    app = controllers.make_app()
    app = BespinTestApp(app)
    resp = app.post("/register/login/BillBixby",
        dict(password="NOTHULK"), status=401)
    
def test_login_without_cookie():
    s = _get_session(True)
    User.create_user("BillBixby", "hulkrulez", "bill@bixby.com")
    app = controllers.make_app()
    app = BespinTestApp(app)
    resp = app.post("/register/login/BillBixby",
        dict(password="hulkrulez"))
    assert resp.cookies_set['auth_tkt']
    
def test_static_files_with_auth():
    _clear_db()
    app = controllers.make_app()
    app = BespinTestApp(app)
    resp = app.get('/editor.html', status=302)
    assert resp.location == "http://localhost/"
    resp = app.post('/register/new/Aldus', dict(password="foo", 
                                                email="a@b.com"))
    resp = app.get('/editor.html')

def test_register_existing_user_should_not_authenticate():
    s = _get_session(True)
    app_orig = controllers.make_app()
    app = BespinTestApp(app_orig)
    resp = app.post('/register/new/BillBixby', dict(email="bill@bixby.com",
                                                    password="notangry"))
    app = BespinTestApp(app_orig)
    resp = app.post("/register/new/BillBixby", dict(email="bill@bixby.com",
                                                    password="somethingelse"),
                    status=409)
    assert not resp.cookies_set
    user = User.find_user("BillBixby")
    assert user.password == 'notangry'
    
def test_bad_ticket_is_ignored():
    _clear_db()
    app = controllers.make_app()
    app = BespinTestApp(app)
    resp = app.post("/register/new/Aldus", dict(password="foo", 
                                        email="a@b.com"))
    app.cookies['auth_tkt'] = app.cookies['auth_tkt'][:-1]
    resp = app.get("/preview/at/SampleProjectFor%3AAldus/index.html", status=401)

def test_api_version_header():
    app = controllers.make_app()
    app = BespinTestApp(app)    
    resp = app.get("/register/userinfo/", status=401)
    assert resp.headers.get("X-Bespin-API") == "dev"
    
def test_username_with_bad_characters():
    _clear_db()
    app = controllers.make_app()
    app = BespinTestApp(app)
    resp = app.post("/register/new/Thinga%20Majig",
            dict(password="foo", email="thinga@majig"), status=400)
    resp = app.post("/register/new/Thinga<majig>",
            dict(password="foo", email="thinga@majig"), status=400)
    resp = app.post("/register/new/Thing/", 
                    dict(password="foo", email="thinga@majig"), status=400)
    resp = app.post("/register/new/..", 
                    dict(password="foo", email="thinga@majig"), status=400)

def test_messages_sent_from_server_to_user():
    _clear_db()
    app = controllers.make_app()
    app = BespinTestApp(app)
    resp = app.post("/register/new/macgyver",
        dict(password="foo", email="macgyver@ducttape.macgyver"))
    s = _get_session()
    macgyver = User.find_user("macgyver")
    assert len(macgyver.messages) == 0
    macgyver.publish(dict(my="message"))
    s.commit()
    resp = app.post("/messages/")
    assert resp.content_type == "application/json"
    data = simplejson.loads(resp.body)
    assert len(data) == 1
    assert data[0] == dict(my="message")
    
    # the message should be consumed
    resp = app.post("/messages/")
    data = simplejson.loads(resp.body)
    assert len(data) == 0
    
def test_get_users_settings():
    _clear_db()
    app = controllers.make_app()
    app = BespinTestApp(app)
    resp = app.post("/register/new/macgyver",
        dict(password="foo", email="macgyver@ducttape.macgyver"))
    resp = app.put("/file/at/BespinSettings/settings", """
vcsuser Mack Gyver <gyver@mac.com>

""")
    s = _get_session()
    macgyver = User.find_user("macgyver")
    settings = macgyver.get_settings()
    assert settings == dict(vcsuser="Mack Gyver <gyver@mac.com>")
    