#  ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
# 
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
# 
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the License.
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
from bespin.database import User, Base

app = None
session = None

def setup_module(module):
    global app, session
    config.set_profile('test')
    config.activate_profile()
    Base.metadata.drop_all(bind=config.c.dbengine)
    Base.metadata.create_all(bind=config.c.dbengine)
    session = config.c.session_factory()
    User.create_user("BillBixby", "", "bill@bixby.com")
    app = controllers.make_app()
    app = BespinTestApp(app)
    app.post("/register/login/BillBixby", dict(password=""))

def test_auth_required():
    app = controllers.make_app()
    app = BespinTestApp(app)
    app.post('/settings/', {'foo' : 'bar'}, status=401)
    app.get('/settings/', status=401)
    app.get('/settings/foo', status=401)

def test_set_settings():
    resp = app.post('/settings/', {'antigravity' : 'on', 'write_my_code' : 'on'})
    assert not resp.body
    user = User.find_user('BillBixby')
    session.expunge(user)
    user = User.find_user('BillBixby')
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
    resp = app.delete('/settings/newone')
    user = User.find_user('BillBixby')
    session.expunge(user)
    user = User.find_user('BillBixby')
    assert 'newone' not in user.settings
    