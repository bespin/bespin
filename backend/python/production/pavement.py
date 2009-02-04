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
    sh("bin/pip install BespinServer.pybundle")