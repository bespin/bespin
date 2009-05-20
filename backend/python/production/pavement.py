from paver.easy import *

import paver.virtual

options(
    virtualenv=Bunch(
        packages_to_install=['pip'],
        paver_command_line="setup"
    )
)

@task
def setup():
    """Get this production environment setup."""
    sh("bin/pip install -r requirements.txt")
    print "Don't forget to run the database upgrade! (paver db)"
    
@task
def db():
    from bespin import config, model, db_versions
    from migrate.versioning.shell import main

    execfile("../wsgi-apps/bespin.wsgi", {'__file__' : '/home/wsgiapps/wsgi-apps/bespin.wsgi'})
    
    repository = str(path(db_versions.__file__).dirname())
    dburl = config.c.dburl
    dry("Run the database upgrade", main, ["upgrade", dburl, repository])
    
    # touch the wsgi app so that mod_wsgi sees that we've updated
    sh("touch ../wsgi-apps/bespin.wsgi")

@task
def create_db():
    """Creates the production database (requires ../wsgi-apps/bespin.wsgi to set up config)"""
    from bespin import config, database, db_versions
    from migrate.versioning.shell import main
    
    execfile("../wsgi-apps/bespin.wsgi", {'__file__' : '/home/wsgiapps/wsgi-apps/bespin.wsgi'})

    dry("Create database tables", database.Base.metadata.create_all, bind=config.c.dbengine)
    
    repository = str(path(db_versions.__file__).dirname())
    dburl = config.c.dburl
    dry("Turn on migrate versioning", main, ["version_control", dburl, repository])
