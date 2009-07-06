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
        number="0.3.1",
        name="Stratospheric Stratus",
        api="4"
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
        dburl=None,
        async=False,
        config_file=path("devconfig.py")
    ),
    dojo=Bunch(
        version="1.3.0",
        download_url=lambda:"http://download.dojotoolkit.org/release-%s/dojo-release-%s.tar.gz"
                            % (options.dojo.version, options.dojo.version),
        src_url=lambda:"http://download.dojotoolkit.org/release-%s/dojo-release-%s-src.tar.gz"
                            % (options.dojo.version, options.dojo.version),
        destination=path('frontend/js'),
        source=False
    ),
    jsparser=Bunch(
        download_urls=[
          "http://mxr.mozilla.org/mozilla/source/js/narcissus/jsdefs.js?raw=1",
          "http://mxr.mozilla.org/mozilla/source/js/narcissus/jsparse.js?raw=1"
        ]
    ),
)

@task
def required():
    """Install the required packages.
    
    Installs the requirements set in requirements.txt."""
    pip = path("bin/pip")
    if not pip.exists():
        # try Windows version
        pip = path("Scripts") / "pip"
    sh('%s install -U --install-option="--install-data=backend/python/installed-package-data" -r requirements.txt' % pip)
    
    call_pavement('backend/python/pavement.py', 'develop')
        
    # clean up after urlrelay's installation
    path("README").unlink()
    path("include").rmtree()
    
@task
def devconfig(options):
    """Generate a developer webserver config file (devconfig.py)."""
    options.server.config_file.write_text("""
from bespin.config import c

# uncomment the following line to turn off stdout logging of requests
# c.log_requests_to_stdout = False

# uncomment the following line to turn off stdout logging of log statements
# c.log_to_stdout = False

# change the following line if you want to test Bespin
# with another database, such as MySQL
# c.dburl = mysql://user:password@localhost/databasename

# uncomment the following line to use the beanstalkd queue and
# bespin_worker jobs
# c.async_jobs = True

# should Project and User names be restricted to a subset
# of characters
# (see bespin.model._check_identifiers)
# uncomment the next line to turn off the restrictions
# c.restrict_identifiers = False

# if you are going to be working on the Thunderhead project code,
# you can point at the directory where Thunderhead is located
# and the script tags will be dynamically replaced
# c.th_src = c.static_dir / ".." / ".." / "th" / "src"

# Look in bespin.config to see more options you can set
""")
    info("Config file created in: %s", options.server.config_file)

@task
def start():
    """Starts the BespinServer on localhost port 8080 for development.
    
    You can change the port and allow remote connections by setting
    server.port or server.address on the command line.
    
    paver server.address=your.ip.address server.port=8000 start
    
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
        config.c.static_dir = (options.build_dir / "frontend").abspath()
    
    if options.server.dburl:
        config.c.dburl = options.server.dburl
    
    if options.server.async:
        config.c.async_jobs = True
    
    config_file = options.server.config_file
    if config_file.exists():
        info("Loading config: %s", config_file)
        code = compile(config_file.bytes(), config_file, "exec")
        exec code in {}
    
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
    from bespin import config, database, db_versions
    from migrate.versioning.shell import main
    
    if path("devdata.db").exists():
        raise BuildFailure("Development database already exists")
    config.set_profile('dev')
    config.activate_profile()
    dry("Create database tables", database.Base.metadata.create_all, bind=config.c.dbengine)
    
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
def try_upgrade():
    """Run SQLAlchemy-migrate test on your database."""
    from bespin import config, model, db_versions
    from migrate.versioning.shell import main
    config.set_profile('dev')
    config.activate_profile()
    repository = str(path(db_versions.__file__).dirname())
    dburl = config.c.dburl
    dry("Test the database upgrade", main, ["test", repository, dburl])

def replace_block(f, begin, end, new_content):
    html_lines = f.lines()
    start_marker = None
    end_marker = None
    for i in range(0, len(html_lines)):
        if begin in html_lines[i]:
            start_marker = i
        elif end in html_lines[i]:
            end_marker = i
    del html_lines[start_marker:end_marker+1]
    html_lines.insert(start_marker, new_content)
    f.write_bytes("".join(html_lines))
    

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
    
    html_file.write_bytes("".join(html_lines))
    
    replace_block(html_file, "<!-- begin script tags -->", "<!-- end script tags -->",
                """
                        <script type="text/javascript" src="js/dojo/dojo.js"></script>
                        <script type="text/javascript" src="js/%s"></script>
""" % jslayer)

    
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
            
        # ignore comment lines
        if "/**" in line:
            continue
        elif "versionNumber:" in line:
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
    embed_profile = destination / "embedProfile.js"
    release_dir = (options.build_dir / "frontend").abspath()
    embed_release_dir = (options.build_top / "embed" ).abspath()
    cwd = path.getcwd()
    try:
        builder_dir.chdir()
        # sh("sh build.sh action=release profileFile=%s version=%s "
        #     "releaseDir=%s optimize=shrinksafe releaseName=js "
        #     'scopeMap=[[\\"dojo\\",\\"bespindojo\\"],[\\"dijit\\",\\"bespindijit\\"]]' 
        #     % (embed_profile, options.version.number, embed_release_dir))
        sh("sh build.sh action=release profileFile=%s version=%s "
            "releaseDir=%s optimize=shrinksafe releaseName=js" 
            % (profile_file, options.version.number, release_dir))
    finally:
        cwd.chdir()
        restore_javascript_version(replaced_lines)
    
    dojo_js = embed_release_dir / "js" / "dojo/dojo.js"
    dojo_js.copy(options.build_top / "embed.js")

    front_end_target = options.build_dir / "frontend"
    
    editor_filename = front_end_target / "editor.html"
    _install_compressed(editor_filename, "editor_all.js")
    
    index_filename = front_end_target / "index.html"
    _install_compressed(index_filename, "index_all.js")
    
    final_util_directory = front_end_target / "js" / "util"
    final_util_directory.rmtree()
    
    # put the th file back in
    (path("frontend") / "js" / "th.compressed.js").copy(front_end_target / "js")
        
@task
def prod_server():
    """Creates the production server code."""
    replaced_lines = dry("Updating Python version number", update_python_version)
    sh("bin/pip freeze -r requirements.txt backend/python/production/requirements.txt")
    try:
        call_pavement("backend/python/pavement.py", "production")
    finally:
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
        output_file = open(destfile, "wb")
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

@task
def testfrontend():
    """Run the frontend tests via DOH"""
    basedir = options.dojo.destination.abspath()
    if not (basedir / "util").exists():
        raise BuildFailure("You need to be using a Dojo source package. Run paver dojo -s.")

    # copy the fixed runner script into place in dojo. Shouldn't do this each time :/
    fixedrunner = basedir / ".." / "tests" / "unit" / "runner.js"
    fixedrunner.copy(basedir / "util" / "doh" / "runner.js")

    sh("java -jar frontend/js/util/shrinksafe/js.jar frontend/js/util/doh/runner.js dojoUrl=frontend/js/dojo/dojo.js testUrl=frontend/tests/unit/loadfiles.js testModule=tests.unit.loadfiles dohBase=frontend/js/util/doh/")


"""
Cannot be used because jsparse needed to be slightly patched
@task
@cmdopts([('source', 's', "Grab JSParser from trunk :)")])
def jsparser(options):
    download_urls = options.jsparser.download_urls
    
    for download_url in download_urls:
        destfile = path(urlparse(download_url).path)
        destdir  = path("frontend/js/jsparse")
        destfile = destdir / destfile.basename()
        if not destdir.exists():
            destdir.makedirs()
            
        if not destfile.exists():
            info("Downloading JSParser to " + destfile)
            datafile = urllib2.urlopen(download_url)
            output_file = open(destfile, "w")
            output_file.write(datafile.read())
            output_file.close()
            datafile.close()"""
            

@task
@cmdopts([('user=', 'u', 'User to set up for Bespin editing'),
          ('file=', 'f', 'Passwordless SSH private key file')])
def installkey(options):
    """Install an SSH key into your Bespin keychain. This will
    prompt you for your Bespin keychain password. You must
    give a Bespin username with -u. You must also specify
    a passwordless SSH private key file with -f."""
    
    if not 'installkey' in options or not options.installkey.user:
        raise BuildFailure("You must specify a user with -u for this task.")
    
    if not options.installkey.file:
        raise BuildFailure("You must specify a private key with with -f")
    
    private_key = path(options.installkey.file)
    public_key = private_key + ".pub"
    
    if not private_key.exists() or not public_key.exists():
        raise BuildFailure("Either your private key file or public key file does not exist")
        
    
        
    user = options.installkey.user
    
    import getpass
    
    password = getpass.getpass("Enter your keychain password: ")
    
    from bespin import config
    from bespin import database, filesystem, vcs
    from sqlalchemy.orm.exc import NoResultFound
    
    config.set_profile("dev")
    config.activate_profile()
    session = config.c.session_factory()
    try:
        user = session.query(database.User).filter_by(username=user).one()
    except NoResultFound:
        raise BuildFailure("I couldn't find %s in the database. Sorry!" % (user))
    
    keychain = vcs.KeyChain(user, password)
    public_key = public_key.bytes()
    private_key = private_key.bytes()
    keychain.set_ssh_key(private_key, public_key)


@task
@cmdopts([('user=', 'u', 'User to set up for Bespin editing')])
def editbespin(options):
    """Use Bespin to edit Bespin. This will change the given
    user's file location to the directory above Bespin, allowing
    you to edit Bespin (and any other projects you have
    in that directory)."""
    
    if not 'editbespin' in options or not options.editbespin.user:
        raise BuildFailure("You must specify a user with -u for this task.")
        
    user = options.editbespin.user
    
    from bespin import config
    from bespin import database, filesystem
    from sqlalchemy.orm.exc import NoResultFound
    
    config.set_profile("dev")
    config.activate_profile()
    session = config.c.session_factory()
    try:
        user = session.query(database.User).filter_by(username=user).one()
    except NoResultFound:
        raise BuildFailure("I couldn't find %s in the database. Sorry!" % (user))
    
    location = path.getcwd().parent.abspath()
    user.file_location = location
    user.recompute_files()
    session.commit()
    bespinsettings_loc = location / "BespinSettings"
    if not bespinsettings_loc.exists():
        project = filesystem.get_project(user, user, "BespinSettings", create=True)
        project.install_template('usertemplate')
    info("User %s set up to access directory %s" % (user, location))

@task
def test():
    #import nose
    #nose.main("bespin.tests")
    from os import system
    system("nosetests backend/python/bespin")

@task
def mobwrite():
    from bespin.mobwrite import mobwrite_daemon
    mobwrite_daemon.main()

@task
def seeddb():
    from bespin import config, filesystem
    from bespin.database import User, Connection
    config.set_profile("dev")
    config.activate_profile()

    def get_user(name):
        user = User.find_user(name)
        if user == None:
            user = User.create_user(name, name, name + "@foo.com")
            session.commit()
            info("Created user called '" + name + "'")
        try:
            filesystem.get_project(user, user, "BespinSettings")
        except:
            settings = filesystem.get_project(user, user, "BespinSettings", create=True)
            settings.install_template('usertemplate')
            info("Created BespinSettings project for '" + name + "'")
        return user

    # Seriously there is something wrong with my ego today ;-)
    bgalbraith = get_user("bgalbraith")
    kdangoor = get_user("kdangoor")
    dalmaer = get_user("d")
    mattb = get_user("mattb")
    zuck = get_user("zuck")
    tom = get_user("tom")
    ev = get_user("ev")
    j = get_user("j")

    bgalbraith.follow(j)
    kdangoor.follow(j)
    dalmaer.follow(j)
    mattb.follow(j)
    zuck.follow(j)
    tom.follow(j)
    ev.follow(j)

    jproject = filesystem.get_project(j, j, "SampleProject", create=True)

    j.add_sharing(jproject, bgalbraith, edit=True)
    j.add_sharing(jproject, kdangoor, edit=True)
    j.add_sharing(jproject, dalmaer, edit=True)
    j.add_sharing(jproject, mattb, edit=False)
    j.add_sharing(jproject, zuck, edit=False)
    j.add_sharing(jproject, tom, edit=False)
    j.add_sharing(jproject, ev, edit=False)

