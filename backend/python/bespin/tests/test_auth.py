from webtest import TestApp

from bespin import controllers, config
from bespin.auth import UserManagerPlugin

def setup_module(module):
    config.set_profile('test')
    config.activate_profile()
    
def test_unknown_user_returns_none():
    auth = UserManagerPlugin()
    environ = dict(user_manager=config.c.user_manager)
    identity = dict(username='BillBixby', password='hulkrulez')
    result = auth.authenticate(environ, identity)
    assert result is None
    
def test_missing_user_returns_none():
    auth = UserManagerPlugin()
    environ = dict(user_manager=config.c.user_manager)
    result = auth.authenticate(environ, dict())
    assert result is None
    
def test_good_user_returns_user_id():
    user_manager = config.c.user_manager
    user_manager.create_user("Aldus", "pagemaker")
    
    auth = UserManagerPlugin()
    environ = dict(user_manager=config.c.user_manager)
    identity = dict(username="Aldus", password="pagemaker")
    
    result = auth.authenticate(environ, identity)
    assert result == "Aldus"
    
def test_static_files_with_auth():
    config.activate_profile()
    app = controllers.make_app()
    app = TestApp(app)
    resp = app.get('/editor.html', status=302)
    assert resp.location == "http://localhost/"
    resp = app.get('/register/login/Aldus')
    resp = app.get('/editor.html')
    