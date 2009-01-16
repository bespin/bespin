from webtest import TestApp
import simplejson

from bespin import config, controllers

user_manager = None
app = None

def setup_module(module):
    global user_manager, app
    config.set_profile('test')
    config.activate_profile()
    user_manager = config.c.user_manager
    user_manager.create_user("BillBixby", "", "bill@bixby.com")
    app = controllers.make_app()
    app = TestApp(app)
    app.post("/register/login/BillBixby", dict(password=""))

def test_auth_required():
    app = controllers.make_app()
    app = TestApp(app)
    app.post('/settings/', {'foo' : 'bar'}, status=401)
    app.get('/settings/', status=401)
    app.get('/settings/foo', status=401)

def test_set_settings():
    config.c.saved_keys.clear()
    resp = app.post('/settings/', {'antigravity' : 'on', 'write_my_code' : 'on'})
    assert not resp.body
    assert 'BillBixby' in config.c.saved_keys
    user = user_manager.get_user('BillBixby')
    assert user.settings['antigravity'] == 'on'
    assert user.settings['write_my_code'] == 'on'
    
    resp = app.get('/settings/')
    assert resp.content_type == 'application/json'
    data = simplejson.loads(resp.body)
    assert data == {'antigravity' : 'on', 'write_my_code' : 'on'}
    
    resp = app.get('/settings/antigravity')
    assert resp.content_type == "application/json"
    assert resp.body == '"on"'

def test_non_existent_setting_sends_404():
    resp = app.get('/settings/BADONE', status=404)
    
def test_delete_setting():
    resp = app.post('/settings/', {'newone' : 'hi there'})
    config.c.saved_keys.clear()
    resp = app.delete('/settings/newone')
    assert 'BillBixby' in config.c.saved_keys
    user = user_manager.get_user("BillBixby")
    assert 'newone' not in user.settings
    