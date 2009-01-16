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
    