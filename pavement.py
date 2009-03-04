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

# Top level pavement for putting together the Bespin project.
import sys
import tarfile
import urllib2
from urlparse import urlparse

from paver.easy import *
import paver.misctasks
import paver.virtual

HEADER = """ ***** BEGIN LICENSE BLOCK *****
Version: MPL 1.1

The contents of this file are subject to the Mozilla Public License  
Version 1.1 (the "License"); you may not use this file except in 
compliance  with the License. You may obtain a copy of the License at
http://www.mozilla.org/MPL/

Software distributed under the License is distributed on an "AS IS"  
basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. 
See the License for the specific language governing rights and
limitations under the License.

The Original Code is Bespin.

The Initial Developer of the Original Code is Mozilla.
Portions created by the Initial Developer are Copyright (C) 2009
the Initial Developer. All Rights Reserved.

Contributor(s):
  Bespin Team (bespin@mozilla.com)

***** END LICENSE BLOCK *****
"""

options(
    version=Bunch(
        number="0.1.4",
        name="Nonchalant Nimbus",
        api="2"
    ),
    build_top=path("build"),
    build_dir=lambda: options.build_top / "BespinServer",
    compress_js=Bunch(
        compressor_version = "2.4.2",
        zip_name = lambda: "yuicompressor-%s.zip" % options.compressor_version,
        url = lambda: "http://www.julienlecomte.net/yuicompressor/%s" % \
                options.zip_name,
        beautiful_soup_url = "http://www.crummy.com/software/BeautifulSoup/download/BeautifulSoup.tar.gz"
    ),
    license=Bunch(
        extensions = set([
            ("py", "#"), ("js", "//")
        ]),
        exclude=set([
            './backend/python/lib',
            './frontend/js/external',
            './backend/python/bin',
            './backend/python/bootstrap.py'
        ])
    ),
    virtualenv=Bunch(
        packages_to_install=['pip'],
        paver_command_line="required"
    ),
    server=Bunch(
        # set to true to allow connections from other machines
        address="",
        port=8080,
        try_build=False,
        dburl=None
    ),
    dojo=Bunch(
        version="1.3.0b2",
        download_url=lambda:"http://download.dojotoolkit.org/release-%s/dojo-release-%s.tar.gz"
                            % (options.dojo.version, options.dojo.version),
        src_url=lambda:"http://download.dojotoolkit.org/release-%s/dojo-release-%s-src.tar.gz"
                            % (options.dojo.version, options.dojo.version),
        destination=path('frontend/js'),
        source=False
    )
)

@task
def required():
    """Install the required packages.
    
    Installs the requirements set in requirements.txt."""
    pip = path("bin/pip")
    if not pip.exists():
        # try Windows version
        pip = path("Scripts/pip")
    sh("%s install -U -r requirements.txt" % pip)
    
    # note this change directory should be done by Paver
    cwd = path.getcwd()
    path("backend/python").chdir()
    try:
        call_pavement('pavement.py', 'develop')
    finally:
        cwd.chdir()
        
    # clean up after urlrelay's installation
    path("README").unlink()
    path("include").rmtree()

@task
def start():
    """Starts the BespinServer on localhost port 8080 for development.
    
    You can change the port and allow remote connections by setting
    server.port or server.host on the command line.
    
    paver server.host=your.ip.address server.port=8000 start
    
    will allow remote connections (assuming you don't have a firewall
    blocking the connection) and start the server on port 8000.
    """
    # automatically install Dojo if it's not there already
    if not (options.dojo.destination / "dojo").exists():
        dojo()
    
    from bespin import config, controllers
    from paste.httpserver import serve
    
    options.order('server')
    
    config.set_profile('dev')
    
    if options.server.try_build:
        config.c.static_dir = os.path.abspath("%s/../../build/BespinServer/frontend" % os.getcwd())
    
    if options.server.dburl:
        config.c.dburl = options.server.dburl
    
    config.activate_profile()
    port = int(options.port)
    serve(controllers.make_app(), options.address, port, use_threadpool=True)
    
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


def _install_compressed(html_file, jslayer):
    html_lines = html_file.lines()
    
    # strip out the MPL
    if html_lines[0].startswith("<!--"):
        end_marker = None
        for i in range(0, len(html_lines)):
            if "-->" in html_lines[i]:
                end_marker = i
                break
        del html_lines[0:end_marker+1]
    
    start_marker = None
    end_marker = None
    for i in range(0, len(html_lines)):
        if "<!-- begin script tags -->" in html_lines[i]:
            start_marker = i
        elif "<!-- end script tags -->" in html_lines[i]:
            end_marker = i
    del html_lines[start_marker:end_marker+1]
    html_lines.insert(start_marker, """
            <script type="text/javascript" src="js/dojo/dojo.js"></script>
            <script type="text/javascript" src="js/%s"></script>
""" % jslayer)
    html_file.write_bytes("".join(html_lines))

@task
def copy_front_end():
    build_dir = options.build_dir
    build_dir.mkdir()
    front_end_target = build_dir / "frontend"
    if front_end_target.exists():
        front_end_target.rmtree()
    front_end_source = path("frontend")
    front_end_source.copytree(front_end_target)
    
def update_python_version():
    version_file = path("backend/python/bespin/__init__.py")
    in_version_block = False
    lines = version_file.lines()
    replaced_lines = []
    for i in range(0, len(lines)):
        line = lines[i]
        if "BEGIN VERSION BLOCK" in line:
            in_version_block = True
            continue
        if "END VERSION BLOCK" in line:
            break
        if not in_version_block:
            continue
        if line.startswith("VERSION ="):
            lines[i] = "VERSION = '%s'\n" % (options.version.number)
        elif line.startswith("VERSION_NAME ="):
            lines[i] = 'VERSION_NAME = "%s"\n' % (options.version.name)
        elif line.startswith('API_VERSION'):
            lines[i] = "API_VERSION = '%s'\n" % (options.version.api)
        else:
            raise BuildFailure("Invalid Python version number line: %s" % line)
        replaced_lines.append(line)
    version_file.write_lines(lines)
    return replaced_lines
    
def update_javascript_version():
    version_file = path("frontend") / "js" / "bespin" / "bespin.js"
    in_version_block = False
    lines = version_file.lines()
    replaced_lines = []
    for i in range(0, len(lines)):
        line = lines[i]
        if "BEGIN VERSION BLOCK" in line:
            in_version_block = True
            continue
        if "END VERSION BLOCK" in line:
            break
        if not in_version_block:
            continue
        if "versionNumber:" in line:
            lines[i] = "versionNumber: '%s',\n" % (options.version.number)
        elif 'versionCodename:' in line:
            lines[i] = 'versionCodename: "%s",\n' % (options.version.name)
        elif 'apiVersion:' in line:
            lines[i] = "apiVersion: '%s',\n" % (options.version.api)
        else:
            raise BuildFailure("Invalid JavaScript version number line: %s" % line)
        replaced_lines.append(line)
    version_file.write_lines(lines)
    return replaced_lines
    
def restore_javascript_version(replaced_lines):
    version_file = path("frontend") / "js" / "bespin" / "bespin.js"
    lines = version_file.lines()
    version_block_start = None
    version_block_end = None
    for i in range(0, len(lines)):
        line = lines[i]
        if "BEGIN VERSION BLOCK" in line:
            version_block_start = i
        if "END VERSION BLOCK" in line:
            version_block_end = i
            break
    lines[version_block_start+1:version_block_end] = replaced_lines
    version_file.write_lines(lines)

def restore_python_version(replaced_lines):
    version_file = path("backend/python/bespin/__init__.py")
    lines = version_file.lines()
    version_block_start = None
    version_block_end = None
    for i in range(0, len(lines)):
        line = lines[i]
        if "BEGIN VERSION BLOCK" in line:
            version_block_start = i
        if "END VERSION BLOCK" in line:
            version_block_end = i
            break
    lines[version_block_start+1:version_block_end] = replaced_lines
    version_file.write_lines(lines)

@task
@needs('copy_front_end')
def compress_js():
    """Compress the JavaScript using Dojo's build system."""
    destination = options.dojo.destination.abspath()
    if not (destination / "util").exists():
        raise BuildFailure("You need to be using a Dojo source package. Run paver dojo -s.")

    replaced_lines = update_javascript_version()

    builder_dir = destination / "util/buildscripts"
    profile_file = destination / "buildProfile.js"
    release_dir = (options.build_dir / "frontend").abspath()
    cwd = path.getcwd()
    try:
        builder_dir.chdir()
        sh("sh build.sh action=release profileFile=%s version=%s "
            "releaseDir=%s optimize=shrinksafe releaseName=js" 
            % (profile_file, options.version.number, release_dir))
    finally:
        cwd.chdir()
        restore_javascript_version(replaced_lines)

    front_end_target = options.build_dir / "frontend"
    
    editor_filename = front_end_target / "editor.html"
    _install_compressed(editor_filename, "editor_all.js")
    
    dashboard_filename = front_end_target / "dashboard.html"
    _install_compressed(dashboard_filename, "editor_all.js")
    
    index_filename = front_end_target / "index.html"
    _install_compressed(index_filename, "index_all.js")
    
    final_util_directory = front_end_target / "js" / "util"
    final_util_directory.rmtree()

        
@task
def prod_server():
    """Creates the production server code."""
    current_directory = path.getcwd()
    replaced_lines = dry("Updating Python version number", update_python_version)
    try:
        path("backend/python").chdir()
        call_pavement("pavement.py", "production")
    finally:
        current_directory.chdir()
        dry("Restoring Python version number", restore_python_version, replaced_lines)

@task
@needs(['prod_server'])
def dist():
    """Generate a tarball that is ready for deployment to the server."""
    options.build_dir.rmtree()
    backend = path("backend/python/production")
    backend.copytree(options.build_dir)
    compress_js()
    docs = path("docs")
    docs.copytree(options.build_dir / "docs")
    
    current_directory = path.getcwd()
    
    options.build_top.chdir()
    tf = tarfile.open("BespinServer.tar.gz", mode="w:gz")
    tf.add("BespinServer")
    tf.close()
    current_directory.chdir()
    
    info("Output file is in build/BespinServer.tar.gz")

def _apply_header_if_necessary(f, header, first_line, last_line):
    data = f.bytes()
    if data.startswith(header):
        debug("File is already tagged")
        return
    debug("Tagging %s", f)
    if data.startswith(first_line):
        pos = data.find(last_line) + len(last_line)
        data = data[pos:]
    data = header + data
    f.write_bytes(data)

@task
def license():
    """Tags the appropriate files with the license text."""
    cwd = path(".")
    info("Tagging license text")
    for extension, comment_marker in options.extensions:
        hlines = [comment_marker + " " + line for line in HEADER.split("\n")]
        header = "\n".join(hlines) + "\n\n"
        first_line = hlines[0]
        last_line = hlines[-1]
        for f in cwd.walkfiles("*.%s" % extension):
            exclude = False
            for pattern in options.exclude:
                if f.startswith(pattern):
                    exclude=True
                    break
            if exclude:
                continue
            debug("Checking %s", f)
            _apply_header_if_necessary(f, header, first_line, last_line)
    
@task
@cmdopts([('source', 's', "Grab a Dojo source release")])
def dojo(options):
    """Download Dojo and install it to the correct location.
    Provide the -s switch if you will need the Dojo source package
    to either build production-ready packages of Bespin or
    to debug Dojo issues."""
    download_url = options.src_url if options.source else options.download_url
    destfile = path(urlparse(download_url).path)
    destfile = path("ext") / destfile.basename()
    if not destfile.exists():
        info("Downloading Dojo to " + destfile)
        datafile = urllib2.urlopen(download_url)
        output_file = open(destfile, "w")
        output_file.write(datafile.read())
        output_file.close()
        datafile.close()

    info("Expanding Dojo")
    destination = options.destination
    dojo = destination / "dojo"
    dijit = destination / "dijit"
    dojox = destination / "dojox"
    util = destination / "util"
    
    dojo.rmtree()
    dijit.rmtree()
    dojox.rmtree()
    util.rmtree()
    
    dojotar = tarfile.open(destfile)
    i = 1
    for member in dojotar.getmembers():
        name = member.name
        if member.type == tarfile.DIRTYPE:
            continue
        dropped_root = name.split('/')[1:]
        
        destpath = destination.joinpath(*dropped_root)
        destdir = destpath.dirname()
        if not destdir.exists():
            destdir.makedirs()
        f = dojotar.extractfile(member)
        destpath.write_bytes(f.read())
        f.close()
    
