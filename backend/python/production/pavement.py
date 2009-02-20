from paver.defaults import *

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

