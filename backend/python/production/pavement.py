import os

from paver.easy import *

import paver.virtual

options(
    virtualenv=Bunch(
        packages_to_install=['pip'],
        paver_command_line="setup"
    ),
    db=Bunch(
        wsgiscript=lambda: os.path.abspath("../wsgi-apps/bespin.wsgi")
    )
)

@task
def setup():
    """Get this production environment setup."""
    sh("bin/pip install -r requirements.txt")
    print "Don't forget to run the database upgrade! (paver db)"
    
@task
def db(options):
    """Perform a database upgrade, if necessary.
    
    Your WSGI script is loaded in order to properly get the configuration
    set up. By default, the WSGI script is ../wsgi-apps/bespin.wsgi.
    You can override this on the command line like so:
    
    paver db.wsgiscript=/path/to/script.wsgi db
    """
    from bespin import config, model, db_versions
    from migrate.versioning.shell import main

    execfile(options.wsgiscript, {'__file__' : options.wsgiscript})
    
    repository = str(path(db_versions.__file__).dirname())
    dburl = config.c.dburl
    dry("Run the database upgrade", main, ["upgrade", dburl, repository])
    
    # touch the wsgi app so that mod_wsgi sees that we've updated
    sh("touch %s" % options.wsgiscript)

@task
def create_db():
    """Creates the production database.
    
    Your WSGI script is loaded in order to properly get the configuration
    set up. By default, the WSGI script is ../wsgi-apps/bespin.wsgi.
    You can override this on the command line like so:
    
    paver db.wsgiscript=/path/to/script.wsgi create_db
    """
    from bespin import config, database, db_versions
    from migrate.versioning.shell import main
    
    script = options.db.wsgiscript
    
    execfile(script, {'__file__' : script})

    dry("Create database tables", database.Base.metadata.create_all, bind=config.c.dbengine)
    
    repository = str(path(db_versions.__file__).dirname())
    dburl = config.c.dburl
    dry("Turn on migrate versioning", main, ["version_control", dburl, repository])
