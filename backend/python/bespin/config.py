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
import sys

import pkg_resources
from path import path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session

from bespin import stats, auth

class InvalidConfiguration(Exception):
    pass

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
c.static_dir = path(os.path.abspath("%s/../../../frontend" % os.path.dirname(__file__)))

c.template_file_dir = None

c.docs_dir = os.path.abspath("%s/../../../docs" % os.path.dirname(__file__))
c.log_file = os.path.abspath("%s/../devserver.log" % os.path.dirname(__file__))
c.default_quota = 15
c.secure_cookie = True
c.http_only_cookie = True
c.template_path = [path(__file__).dirname().abspath()]

c.base_url = "https://bespin.mozilla.com/"

# Settings for sending email
c.email_from = "invalid@ThisIsNotAValidEmailAddressUseSomethingElse.com"
c.email_host = "localhost"
c.email_port = 25

# additional mappings from top-level of URL to directory
# in the config file, this can be provided as
# static_map=foo=/path/to/files;bar=/path/to/other/files
c.static_map = {}

# additionally, a directory can be specified as the tree of
# "first resort". This directory will be checked for static
# files first, and then the default Bespin static files will
# be used. This is a simple way to override Bespin's static
# resources without altering Bespin's sources.
c.static_override = None

# turns on asynchronous running of long jobs (like vcs)
c.async_jobs = True

# beanstalkd host and port
c.queue_host = None
c.queue_port = None

# holds the actual queue object
c.queue = None

# stats type: none, memory, redis
# memory just holds the stats in a dictionary
# redis stores the stats in a redis server
# http://code.google.com/p/redis/
c.stats_type = "none"
c.redis_host = None
c.redis_port = None

# login failure tracking: none, memory, redis
# memory holds the login failure attempts in a dictionary and should
# not be used in production
# redis holds the login failures in redis (using the same redis
# as above for stats)
c.login_failure_tracking = "none"

# number of attempts before a user is locked out
c.login_attempts = 10

# how long a user is locked out (in seconds)
c.lockout_period = 600


# if this is true, the user's UUID will be used as their
# user directory name. If it's false, their username will
# be used. Generally, you'll only want this to be false
# in development.
c.use_uuid_as_dir_identifier = True

c.fslevels = 3

c.max_import_file_size = 20000000

c.log_requests_to_stdout = False
c.log_to_stdout = False

# should Project and User names be restricted to a subset
# of characters
# (see bespin.model._check_identifiers)
c.restrict_identifiers = True

# The set of users that are allowed to view the system stats
# at /stats/. stats_type should either be
# memory or redis for this to make any sense
# this can either be a set in Python or
# a comma separated string
c.stats_users = set()

# a list of keys to display other than the base set
c.stats_display = set()

# Locations that should be added to Dojo's module path for loading
# client side code.
# See http://www.dojotoolkit.org/book/dojo-book-0-9/part-3-programmatic-dijit-and-dojo/modules-and-namespaces/creating-your-own-modul
c.dojo_module_path = {}

# Client side plugin modules that should be loaded automatically by the client.
# Should be a list of dotted names
c.javascript_plugins = []

# List of capabilities provided by the server. This is just a list of strings
# to be interpreted by the client. This will adjust the user interface to
# focus the user on the capabilities provided by this server.
c.capabilities = set(["vcs"])

# Set this variable to point to the location of a Thunderhead
# source directory and that will be used during development.
c.th_src = None

c.using_dojo_source = False

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

        file_handler = logging.handlers.RotatingFileHandler(c.log_file)
        file_handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
        root_log.addHandler(file_handler)

        paste_log = logging.getLogger("paste.httpserver.ThreadPool")
        paste_log.setLevel(logging.ERROR)

        # turn off the secure cookie, because localhost connections
        # will be HTTP
        c.secure_cookie = False
        c.use_uuid_as_dir_identifier = False
        c.default_quota = 10000
        c.log_requests_to_stdout = True
        c.log_to_stdout = True

        c.async_jobs = False
        c.fslevels = 0

        c.base_url = "http://localhost:8080/"

        c.email_host = None

def load_config(configfile):
    cp = ConfigParser.ConfigParser()
    cp.read(configfile)
    c.update(cp.items("config"))

def activate_profile():
    for ep in pkg_resources.iter_entry_points("bespin_extensions"):
        ep.load()
        
    if c.th_src:
        # in development, assume a Th directory above the bespin root
        c.static_map['js/thsrc'] = c.th_src

    if isinstance(c.email_port, basestring):
        c.email_port = int(c.email_port)

    if isinstance(c.static_map, basestring):
        static_map = {}
        mappings = c.static_map.split(";")
        for mapping in mappings:
            name, directory = mapping.split("=")
            static_map[name] = directory

    c.dbengine = create_engine(c.dburl)
    c.session_factory = scoped_session(sessionmaker(bind=c.dbengine))
    c.fsroot = path(c.fsroot)

    c.static_dir = path(c.static_dir)

    if not c.template_file_dir:
        c.template_file_dir = c.static_dir / "templates"

    c.template_file_dir = path(c.template_file_dir)

    if not c.fsroot.exists:
        c.fsroot.makedirs()

    if c.async_jobs:
        if c.queue_port:
            c.queue_port = int(c.queue_port)

        from bespin import queue
        c.queue = queue.BeanstalkQueue(c.queue_host, c.queue_port)

    if c.redis_port:
        c.redis_port = int(c.redis_port)

    if c.stats_type == "redis" or c.login_failure_tracking == "redis":
        from bespin import redis
        redis_client = redis.Redis(c.redis_host, c.redis_port)
    else:
        redis_client = None

    if c.stats_type == "redis":
        if not redis_client:
            raise InvalidConfiguration("Stats is set to redis, but redis is not configured")
        c.stats = stats.RedisStats(redis_client)
    elif c.stats_type == "memory":
        c.stats = stats.MemoryStats()
    else:
        c.stats = stats.DoNothingStats()

    if isinstance(c.stats_users, basestring):
        c.stats_users = set(c.stats_users.split(','))
    if isinstance(c.stats_display, basestring):
        c.stats_display = set(c.stats_display.split(','))

    if c.login_attempts:
        c.login_attempts = int(c.login_attempts)

    if c.lockout_period:
        c.lockout_period = int(c.lockout_period)

    if c.login_failure_tracking == "redis":
        if not redis_client:
            raise InvalidConfiguration("Login failure tracking is set to redis, but redis is not configured")
    elif c.login_failure_tracking == "memory":
        c.login_tracker = auth.MemoryFailedLoginTracker(c.login_attempts, 
                                                        c.lockout_period)
    else:
        c.login_tracker = auth.DoNothingFailedLoginTracker()

    if c.log_to_stdout:
        stdout_handler = logging.StreamHandler(sys.stdout)
        stdout_handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
        logging.getLogger().addHandler(stdout_handler)

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

