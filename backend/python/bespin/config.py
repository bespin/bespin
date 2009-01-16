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
        c.saved_keys = set()
    elif profile == "dev":
        if not os.path.exists("devdata"):
            os.mkdir("devdata")
        c.users_db = "file://devdata/users"
        c.users_db_cache = "memory://"
        c.file_db = "file://devdata/files"
        c.file_db_cache = "memory://"
        c.status_db = "file://devdata/status"
        c.status_db_cache = "memory://"
        c.edit_db = "file://devdata/edits"
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
    