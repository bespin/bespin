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
    user = user_manager.create_user("BillBixby", "hulkrulez")
    assert len(user_manager.store) == 1
    assert 'BillBixby' in config.c.saved_keys
    
def test_create_duplicate_user():
    config.activate_profile()
    assert not config.c.saved_keys
    user_manager = config.c.user_manager
    user_manager.create_user("BillBixby", "somepass")
    try:
        user_manager.create_user("BillBixby", "otherpass")
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
    
def test_login_and_verify_user():
    config.activate_profile()
    app = controllers.make_app()
    app = TestApp(app)
    resp = app.get('/register/login/BillBixby')
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
    resp = app.get('/register/login/BillBixby')
    
    # with the cookie set, we should be able to retrieve the 
    # logged in name
    resp = app.get('/register/userinfo/')
    assert resp.content_type == 'application/json'
    data = simplejson.loads(resp.body)
    assert 'project' in data
    assert data['username'] == 'BillBixby'
    
def test_logout():
    config.activate_profile()
    user_manager = config.c.user_manager
    user_manager.create_user("BillBixby", "")
    app = controllers.make_app()
    app = TestApp(app)
    resp = app.get("/register/login/BillBixby")
    resp = app.get("/register/logout/")
    assert resp.cookies_set['auth_tkt'] == '""'