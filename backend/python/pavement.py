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

import subprocess
import os
import re
import signal

import paver.virtual

options(
    setup=Bunch(
        name="BespinServer",
        version="0.1",
        packages=['bespin']
    ),
    virtualenv=Bunch(
        packages_to_install=['pip'],
        paver_command_line="required"
    )
)

@task
def required():
    """Install the required packages.
    
    Installs the requirements set in requirements.txt."""
    sh("bin/pip install -r requirements.txt")
    call_task('develop')
    # clean up after urlrelay's installation
    path("README").unlink()
    path("include").rmtree()

@task
def start():
    """Starts the BespinServer on localhost port 8080 for development."""
    from bespin import config, controllers
    from wsgiref.simple_server import make_server
    
    config.set_profile('dev')
    config.activate_profile()
    make_server('localhost', 8080, controllers.make_app()).serve_forever()
    
@task
def clean_data():
    """Deletes the development data and recreates the database."""
    data_path = path("devdata.db")
    data_path.unlink()
    create_db()
    
@task
def create_db():
    """Creates the development database"""
    from bespin import config, model, db_versions
    from migrate.versioning.shell import main
    
    if path("devdata.db").exists():
        raise BuildFailure("Development database already exists")
    config.set_profile('dev')
    config.activate_profile()
    dry("Create database tables", model.Base.metadata.create_all, bind=config.c.dbengine)
    
    repository = str(path(db_versions.__file__).dirname())
    dburl = config.c.dburl
    dry("Turn on migrate versioning", main, ["version_control", dburl, repository])
