# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
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
#     Bespin Team (bespin@mozilla.com)
#
# ***** END LICENSE BLOCK *****

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
    