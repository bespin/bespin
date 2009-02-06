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
    # touch the wsgi app so that mod_wsgi sees that we've updated
    sh("touch ../wsgi-apps/bespin.wsgi")