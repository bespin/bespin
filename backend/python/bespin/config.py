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
import logging
import logging.handlers

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

class Bunch(dict):
    def __getattr__(self, attr):
        try:
            return self[attr]
        except KeyError:
            raise AttributeError("%s not found" % attr)
    
    def __setattr__(self, attr, value):
        self[attr] = value

c = Bunch()
c.dburl = None
c.secret = "This is the phrase that is used for secret stuff."
c.pw_secret = "This phrase encrypts passwords."
c.static_dir = os.path.abspath("%s/../../../frontend" % os.path.dirname(__file__))
c.docs_dir = os.path.abspath("%s/../../../docs" % os.path.dirname(__file__))
c.log_file = os.path.abspath("%s/../devserver.log" % os.path.dirname(__file__))
c.sessionmaker = sessionmaker()
c.default_quota = 10

c.max_import_file_size = 20000000

def set_profile(profile):
    if profile == "test":
        # this import will install the bespin_test store
        c.dburl = "sqlite://"
    elif profile == "dev":
        c.dburl = "sqlite:///devdata.db"
        root_log = logging.getLogger()
        root_log.setLevel(logging.DEBUG)
        handler = logging.handlers.RotatingFileHandler(
                    c.log_file)
        root_log.addHandler(handler)
        handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
    
def activate_profile():
    c.dbengine = create_engine(c.dburl)
    
def dev_spawning_factory(spawning_config):
    spawning_config['app_factory'] = spawning_config['args'][0]
    set_profile('dev')
    here = os.path.dirname(__file__)
    dbfile = os.path.abspath(os.path.join(here, "..", "devdata.db"))
    c.dburl = "sqlite:///%s" % (dbfile)
    activate_profile()
    return spawning_config

def dev_factory(config):
    from bespin.controllers import make_app
    return make_app()
    