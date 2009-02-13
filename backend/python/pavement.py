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

import re
import os

from setuptools import find_packages
from paver.setuputils import find_package_data

from paver.defaults import *

import paver.virtual

options(
    setup=Bunch(
        name="BespinServer",
        version="0.1.1",
        packages=find_packages(),
        package_data=find_package_data('bespin', 'bespin', 
                                only_in_packages=False)
    ),
    virtualenv=Bunch(
        packages_to_install=['pip'],
        paver_command_line="required"
    ),
    server=Bunch(
        # set to true to allow connections from other machines
        open=False,
        port=8080,
        try_build=False
    )
)

@task
def required():
    """Install the required packages.
    
    Installs the requirements set in requirements.txt."""
    sh("bin/pip install -U -r requirements.txt")
    call_task('develop')
    # clean up after urlrelay's installation
    path("README").unlink()
    path("include").rmtree()

@task
def start():
    """Starts the BespinServer on localhost port 8080 for development.
    
    You can change the port and allow remote connections by setting
    server.port or server.open on the command line.
    
    paver server.open=1 server.port=8000 start
    
    will allow remote connections (assuming you don't have a firewall
    blocking the connection) and start the server on port 8000.
    """
    from bespin import config, controllers
    from wsgiref.simple_server import make_server
    
    options.order('server')
    
    config.set_profile('dev')
    
    if options.server.try_build:
        config.c.static_dir = os.path.abspath("%s/../../build/BespinServer/frontend" % os.getcwd())
    config.activate_profile()
    port = int(options.port)
    if options.open in ["True", "true", "yes", "1"]:
        listen_on = ""
    else:
        listen_on = "localhost"
    info("Server starting on %s:%s" % (listen_on, port))
    make_server(listen_on, port, controllers.make_app()).serve_forever()
    
@task
def try_build():
    """Starts the server using the compressed JavaScript."""
    options.server.try_build=True
    start()
    
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

@task
def upgrade():
    """Upgrade your database."""
    from bespin import config, model, db_versions
    from migrate.versioning.shell import main
    config.set_profile('dev')
    config.activate_profile()
    repository = str(path(db_versions.__file__).dirname())
    dburl = config.c.dburl
    dry("Run the database upgrade", main, ["upgrade", dburl, repository])
    

@task
@needs(['sdist'])
def production():
    """Gets things ready for production."""
    current_directory = path.getcwd()
    
    non_production_packages = set(["py", "WebTest", "boto", "virtualenv", 
                                  "Paver", "BespinServer"])
    production = path("production")
    production_requirements = production / "requirements.txt"
    
    libs_dest = production / "libs"
    libs_dest.rmtree()
    libs_dest.mkdir()
    
    sdist_file = path("dist/BespinServer-%s.tar.gz" % options.version)
    sdist_file.move(libs_dest)
    
    ext_dir = path("ext")
    external_libs = []
    for f in ext_dir.glob("*"):
        f.copy(libs_dest)
        name = f.basename()
        name = name[:name.index("-")]
        non_production_packages.add(name)
        external_libs.append("libs/%s" % (f.basename()))
        
    sh("bin/pip freeze -r requirements.txt %s" % (production_requirements))
    
    lines = production_requirements.lines()
    
    requirement_pattern = re.compile(r'^(.*)==')
    
    i = 0
    while i < len(lines):
        rmatch = requirement_pattern.match(lines[i])
        if rmatch:
            name = rmatch.group(1)
            deleted = False
            for npp in non_production_packages:
                if name == npp:
                    del lines[i]
                    deleted = True
                    break
            if deleted:
                continue
        i+=1
    
    lines.append("libs/BespinServer-%s.tar.gz" % options.version)
    lines.append("MySQL-python")
    lines.extend(external_libs)
    production_requirements.write_lines(lines)
    
    production.chdir()
    sh("../bin/paver bootstrap")
    current_directory.chdir()
    