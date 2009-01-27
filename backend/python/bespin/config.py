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

class Bunch(dict):
    def __getattr__(self, attr):
        try:
            return self[attr]
        except KeyError:
            raise AttributeError("%s not found" % attr)
    
    def __setattr__(self, attr, value):
        self[attr] = value

c = Bunch()
c.users_db = None
c.users_db_cache = None
c.file_db = None
c.file_db_cache = None
c.status_db = None
c.status_db_cache = None
c.edit_db = None
c.edit_db_cache = None
c.secret = "This is the phrase that is used for secret stuff."
c.static_dir = os.path.abspath("%s/../../../frontend" % os.path.dirname(__file__))

c.max_import_file_size = 20000000

def set_profile(profile):
    if profile == "test":
        # this import will install the bespin_test store
        import bespin.tests.util
        c.users_db = "bespin_test://"
        c.users_db_cache = "simple://"
        c.file_db = "bespin_test://"
        c.file_db_cache = "simple://"
        c.status_db = "bespin_test://"
        c.status_db_cache = "simple://"
        c.edit_db = "bespin_test://"
        c.edit_db_cache = "simple://"
        c.saved_keys = dict()
    elif profile == "dev":
        if not os.path.exists("devdata"):
            os.mkdir("devdata")
        c.users_db = "jsonbase://devdata/users"
        c.users_db_cache = "memory://"
        c.file_db = "jsonfiles://devdata/files"
        c.file_db_cache = "memory://"
        c.status_db = "jsonbase://devdata/status"
        c.status_db_cache = "memory://"
        c.edit_db = "jsonbase://devdata/edits"
        c.edit_db_cache = "memory://"
    
def activate_profile():
    from shove import Shove
    from bespin.model import UserManager, FileManager, DB
    
    c.user_manager = UserManager(Shove(c.users_db, c.users_db_cache))
    c.file_manager = FileManager(Shove(c.file_db, c.file_db_cache),
                                 Shove(c.status_db, c.status_db_cache),
                                 Shove(c.edit_db, c.edit_db_cache))
    c.db = DB(c.user_manager, c.file_manager)

def dev_spawning_factory(spawning_config):
    spawning_config['app_factory'] = spawning_config['args'][0]
    set_profile('dev')
    activate_profile()
    return spawning_config

def dev_factory(config):
    from bespin.controllers import make_app
    return make_app()
    