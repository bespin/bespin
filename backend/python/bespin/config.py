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
import ConfigParser

from path import path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session

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
c.default_quota = 15
c.secure_cookie = True
c.template_path = [path(__file__).dirname().abspath()]

# turns on asynchronous running of long jobs (like vcs)
c.async_jobs = True

# beanstalkd host and port
c.queue_host = None
c.queue_port = None

# holds the actual queue object
c.queue = None

# if this is true, the user's UUID will be used as their
# user directory name. If it's false, their username will
# be used. Generally, you'll only want this to be false
# in development.
c.use_uuid_as_dir_identifier = True

c.fslevels = 3

c.max_import_file_size = 20000000

c.log_requests_to_stdout = False

# should Project and User names be restricted to a subset
# of characters
# (see bespin.model._check_identifiers)
c.restrict_identifiers = True

def set_profile(profile):
    if profile == "test":
        # this import will install the bespin_test store
        c.dburl = "sqlite://"
        c.fsroot = os.path.abspath("%s/../testfiles" 
                        % os.path.dirname(__file__))
        c.async_jobs = False
        c.fslevels = 0
    elif profile == "dev":
        c.dburl = "sqlite:///devdata.db"
        c.fsroot = os.path.abspath("%s/../../../devfiles" 
                        % os.path.dirname(__file__))
        root_log = logging.getLogger()
        root_log.setLevel(logging.DEBUG)
        handler = logging.handlers.RotatingFileHandler(c.log_file)
        handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
        root_log.addHandler(handler)

        paste_log = logging.getLogger("paste.httpserver.ThreadPool")
        paste_log.setLevel(logging.ERROR)
        
        # turn off the secure cookie, because localhost connections
        # will be HTTP
        c.secure_cookie = False
        c.use_uuid_as_dir_identifier = False
        c.default_quota=10000
        c.log_requests_to_stdout = True
        
        c.async_jobs = False
        c.fslevels = 0
    
    if c.queue_port:
        c.queue_port = int(c.queue_port)
    
def load_config(configfile):
    cp = ConfigParser.ConfigParser()
    cp.read(configfile)
    c.update(cp.items("config"))
    
def activate_profile():
    c.dbengine = create_engine(c.dburl)
    #c.session_factory = scoped_session(sessionmaker(bind=c.dbengine))
    c.session_factory = sessionmaker(bind=c.dbengine)
    c.fsroot = path(c.fsroot)
    if not c.fsroot.exists:
        c.fsroot.makedirs()
    
    if c.async_jobs:
        from bespin import queue
        c.queue = queue.BeanstalkQueue(c.queue_host, c.queue_port)
    
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
    
