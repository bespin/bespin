#  ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the License.
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

"""Data classes for working with files/projects/users."""
import os
import time
import tarfile
import tempfile
import mimetypes
import zipfile
from datetime import datetime
import logging
import re
import itertools
import sqlite3

from path import path as path_obj
from pathutils import LockError as PULockError, Lock, LockFile
import simplejson

from bespin import config, jsontemplate
from bespin.utils import _check_identifiers, BadValue

log = logging.getLogger("bespin.model")

# quotas are expressed in 1 megabyte increments
QUOTA_UNITS = 1048576

class FSException(Exception):
    pass

class FileNotFound(FSException):
    pass

class FileConflict(FSException):
    pass

class NotAuthorized(FSException):
    pass

class OverQuota(FSException):
    pass

class LockError(FSException):
    pass

def _cmp_files_in_project(fs1, fs2):
    file1 = fs1.file
    file2 = fs2.file
    proj_diff = cmp(file1.project.name, file2.project.name)
    if not proj_diff:
        return cmp(file1.name, file2.name)
    return proj_diff

def get_project(user, owner, project_name, create=False, clean=False):
    """Create a project object that provides an appropriate view
    of the project for the given user. A project is identified by
    the 'owner' of the project and by the project name. If
    create is True, the project will be created if it does not
    already exist. If clean is True, the project will be deleted
    and recreated if it already exists."""

    _check_identifiers("Project names", project_name)

    if user != owner:
        if not owner.is_project_shared(project_name, user):
            raise NotAuthorized("User %s is not allowed to access project %s" %
                                (user, project_name))

    # a request for a clean project also implies that creating it
    # is okay
    if clean:
        create = True

    location = owner.get_location() / project_name
    if location.exists():
        project = ProjectView(user, owner, project_name, location)
        if clean:
            location.rmtree()
            location.makedirs()
    else:
        if not create:
            raise FileNotFound("Project %s not found" % project_name)
        log.debug("Creating new project %s", project_name)
        location.makedirs()
        project = ProjectView(user, owner, project_name, location)
        config.c.stats.incr("projects")
    return project

def _find_common_base(member_names):
    base = None
    base_len = None
    for name in member_names:
        if base is None:
            slash = name.find("/")
            base = name[:slash+1]
            base_len = len(base)
            continue
        if name[:base_len] != base:
            base = ""
            break
    return base

class LenientUndefinedDict(dict):
    def get(self, key, default=''):
        return super(LenientUndefinedDict, self).get(key, default)

    def __missing__(self, key):
        return ""

class _SearchMatch(object):
    """Comparable objects that store the result of a file search match"""
    def __init__(self, query, match):
        # if the query string is directly in there, boost the score
        if query in match.lower():
            self.score = 1
        else:
            self.score = 0
        percent_match = float(len(query)) / len(match)
        if percent_match >= 0.5:
            self.score += 0.5
        self.match = match

    def __cmp__(self, other):
        diff = cmp(other.score, self.score)
        if diff:
            return diff
        return cmp(self.match, other.match)

    def __str__(self):
        return str(self.match)

class Directory(object):
    def __init__(self, project, name):
        if "../" in name:
            raise BadValue("Relative directories are not allowed")

        # chop off any leading slashes
        while name and name.startswith("/"):
            name = name[1:]

        if not name.endswith("/"):
            name += "/"
        self.name = name

        self.location = project.location / name

    @property
    def short_name(self):
        return self.name.parent.basename() + "/"

class File(object):
    def __init__(self, project, name):
        if "../" in name:
            raise BadValue("Relative directories are not allowed")

        # chop off any leading slashes
        while name and name.startswith("/"):
            name = name[1:]

        self.project = project
        self.name = name
        self.location = project.location / name
        self._info = None

    @property
    def short_name(self):
        return self.location.basename()

    def exists(self):
        return self.location.exists()

    @property
    def info(self):
        if self._info is not None:
            return self._info
        info = {}
        self._info = info
        stat = self.location.stat()
        info['size'] = stat.st_size
        info['created_time'] = datetime.fromtimestamp(stat.st_ctime)
        info['modified_time'] = datetime.fromtimestamp(stat.st_mtime)
        return info

    @property
    def data(self):
        return self.location.bytes()

    @property
    def mimetype(self):
        """Returns the mimetype of the file, or application/octet-stream
        if it cannot be guessed."""
        type, encoding = mimetypes.guess_type(self.name)
        if type:
            return type
        return "application/octet-stream"

    @property
    def saved_size(self):
        return self.info['size']

    @property
    def created(self):
        return self.info['created_time']

    @property
    def modified(self):
        return self.info['modified_time']

    def save(self, contents):
        self.location.write_bytes(contents)

    @property
    def statusfile(self):
        project = self.project
        return project.location / ".." / (".%s.json" % (project.name))

    def mark_opened(self, user_obj, mode):
        """Keeps track of this file as being currently open by the
        user with the mode provided."""
        statusfile = self.statusfile
        try:
            lock = Lock(statusfile)
            lock.lock()
            if statusfile.exists():
                statusinfo = statusfile.bytes()
                statusinfo = simplejson.loads(statusinfo)
            else:
                statusinfo = dict()

            open_files = statusinfo.setdefault("open", {})
            file_users = open_files.setdefault(self.name, {})
            file_users[user_obj.username] = mode

            statusfile.write_bytes(simplejson.dumps(statusinfo))
            lock.unlock()
        except PULockError, e:
            raise LockError("Problem tracking open status for file %s: %s" %
                        (self.name, str(e)))

    @property
    def users(self):
        """Returns a dictionary with the keys being the list of users
        with this file open and the values being the modes."""
        statusfile = self.statusfile
        if statusfile.exists():
            try:
                statusfile = LockFile(self.statusfile)
                statusinfo = statusfile.read()
                statusfile.close()
            except PULockError, e:
                raise LockError("Problem reading open file status: %s", str(e))

            statusinfo = simplejson.loads(statusinfo)
            open_files = statusinfo.get("open", {})
            return open_files.get(self.name, {})
        else:
            return {}

    def close(self, user):
        """Close this file for the given user."""
        statusfile = self.statusfile
        if not statusfile.exists():
            return
        try:
            lock = Lock(statusfile)
            lock.lock()
            if statusfile.exists():
                statusinfo = statusfile.bytes()
                statusinfo = simplejson.loads(statusinfo)
            else:
                statusinfo = dict()

            open_files = statusinfo.setdefault("open", {})
            file_users = open_files.setdefault(self.name, {})
            try:
                del file_users[user.username]
            except KeyError:
                pass

            statusfile.write_bytes(simplejson.dumps(statusinfo))
            lock.unlock()
        except PULockError, e:
            raise LockError("Problem tracking open status for file %s: %s" %
                        (self.name, str(e)))

    def __repr__(self):
        return "File: %s" % (self.name)

def _get_file_list(directory):
    total = 0
    files = []
    for f in directory.walkfiles():
        if ".hg" in f or ".svn" in f or ".bzr" in f or ".git" in f:
            continue
        total += f.size
        files.append(directory.relpathto(f))
    return total, files

def _get_space_used(directory):
    total = 0
    for f in directory.walkfiles():
        if ".hg" in f or ".svn" in f or ".bzr" in f or ".git" in f:
            continue
        total += f.size
    return total

def _regexp(expr, item):
    if expr is None:
        return False
    # only search on basenames
    p = path_obj(item)
    item = p.basename()
    return re.search(expr, item, re.UNICODE|re.I) is not None
    
def rescan_project(qi):
    """Runs an asynchronous rescan of a project"""
    from bespin import database
    
    message = qi.message
    s = database._get_session()
    user = database.User.find_user(message['user'])
    project = get_project(user, user, message['project'])
    print "Got project %s from user %s" % (project.name, user.username)
    project.scan_files()
    print "Scan done"
    retvalue = database.Message(user_id=user.id, message=simplejson.dumps(
            dict(asyncDone=True,
            jobid=qi.id, output="Rescan complete")))
    s.add(retvalue)
    

class Project(object):
    """Provides access to the files in a project."""

    def __init__(self, owner, name, location):
        self.owner = owner
        self.name = name
        self.location = location

    @property
    def metadata(self):
        try:
            return self._metadata
        except AttributeError:
            self._metadata = ProjectMetadata(self)
            return self._metadata

    @property
    def short_name(self):
        return self.name + "/"

    @property
    def full_name(self):
        return self.owner.uuid + "/" + self.name

    def __repr__(self):
        return "Project(name=%s)" % (self.name)

    def save_file(self, destpath, contents=None):
        """Saves the contents to the file path provided, creating
        directories as needed in between. If last_edit is not provided,
        the file must not be opened for editing. Otherwise, the
        last_edit parameter should include the last edit ID received by
        the user."""
        if "../" in destpath:
            raise BadValue("Relative directories are not allowed")

        # chop off any leading slashes
        while destpath and destpath.startswith("/"):
            destpath = destpath[1:]

        saved_size = len(contents) if contents is not None else 0
        if not self.owner.check_save(saved_size):
            raise OverQuota()

        file_loc = self.location / destpath

        if file_loc.isdir():
            raise FileConflict("Cannot save file at %s in project "
                "%s, because there is already a directory with that name."
                % (destpath, self.name))

        file_dir = file_loc.dirname()
        if not file_dir.exists():
            file_dir.makedirs()

        file = File(self, destpath)
        if file.exists():
            size_delta = saved_size - file.saved_size
        else:
            size_delta = saved_size
            self.metadata.cache_add(destpath)
            config.c.stats.incr("files")
        file.save(contents)
        self.owner.amount_used += size_delta
        return file

    def create_directory(self, destpath):
        """Create a new directory"""
        if "../" in destpath:
            raise BadValue("Relative directories are not allowed")

        # chop off any leading slashes
        while destpath and destpath.startswith("/"):
            destpath = destpath[1:]

        file_loc = self.location / destpath
        if file_loc.exists():
            if file_loc.isfile():
                raise FileConflict("Cannot create directory %s "
                    "because there is already a file there."
                    % destpath)
        else:
            file_loc.makedirs()

    def install_template_file(self, path, options):
        """Installs a single template file at the path
        provided, using template information specified in options.
        
        Options is a dictionary containing the following
        attributes:
        
        stdtemplate: the name of a template file in the frontend/templates
        directory.
        
        values: a dictionary of values to be plugged into the template.
        
        Note that the template file itself is a JSON Template template.
        """
        template_name = options['stdtemplate']
        if template_name.startswith("/") or ".." in template_name:
            raise FileNotFound("Template filename %s is invalid" % template_name)
            
        template_file = config.c.template_file_dir / template_name
        try:
            fileobj = template_file.open()
        except IOError:
            raise FileNotFound("There is no template called " + template_name);
        tobj = jsontemplate.FromFile(fileobj)
        try:
            contents = tobj.expand(options['values'])
        finally:
            fileobj.close()
            
        self.save_file(path, contents)

    def install_template(self, template="template", other_vars=None):
        """Installs a set of template files into a new project.

        The template directory will be found by searching
        config.c.template_path to find a matching directory name.
        The files inside of that directory will be installed into
        the project, with the common root for the files chopped off.

        Additionally, filenames containing { will be treated as JSON Template
        templates and the contents of files will be treated as JSON Template
        templates. This means that the filenames can contain variables
        that are substituted when the template is installed into the
        user's project. The contents of the files can also have variables
        and small amounts of logic.

        These JSON Template templates automatically have the following
        variables:

        * project: the project name
        * username: the project owner's username
        * filename: the name of the file being generated

        You can pass in a dictionary for other_vars and those values
        will also be available in the templates.
        """
        log.debug("Installing template %s for user %s as project %s",
                template, self.owner, self.name)
        if "/" in template or "." in template:
            raise BadValue("Template names cannot include '/' or '.'")
        found = False
        for p in config.c.template_path:
            source_dir = path_obj(p) / template
            if source_dir.isdir():
                found = True
                break
        if not found:
            raise FSException("Unknown project template: %s" % template)

        if other_vars is not None:
            variables = LenientUndefinedDict(other_vars)
        else:
            variables = LenientUndefinedDict()

        variables['project'] = self.name
        variables['username'] = self.owner.username

        common_path_len = len(source_dir) + 1
        for dirpath, dirnames, filenames in os.walk(source_dir):
            destdir = dirpath[common_path_len:]
            if '.svn' in destdir:
                continue
            for f in filenames:
                if "{" in f:
                    dest_f = jsontemplate.expand(f, variables)
                else:
                    dest_f = f

                if destdir:
                    destpath = "%s/%s" % (destdir, dest_f)
                else:
                    destpath = dest_f
                contents = open(os.path.join(dirpath, f)).read()
                variables['filename'] = dest_f
                contents = jsontemplate.expand(contents, variables)
                self.save_file(destpath, contents)

    def list_files(self, path=""):
        """Retrieve a list of files at the path. Directories will have
        '/' at the end of the name."""
        location = self.location if not path else \
            self.location / path

        if not location.exists():
            raise FileNotFound("Directory %s in self.%s does not exist"
                              % (path, self.name))

        names = location.listdir()

        result = []
        for name in names:
            if name.isdir():
                result.append(Directory(self, self.location.relpathto(name)))
            else:
                result.append(File(self, self.location.relpathto(name)))

        return sorted(result, key=lambda item: item.name)

    def _check_and_get_file(self, path):
        """Returns the file object."""
        file_obj = File(self, path)
        if not file_obj.exists():
            raise FileNotFound("File %s in project %s does not exist"
                                % (path, self.name))

        if file_obj.location.isdir():
            raise FSException("%s in project %s is a file, not a directory"
                    % (path, self.name))

        return file_obj

    def get_file_object(self, path):
        """Retrieves the File instance from the project at the
        path provided."""
        file_obj = self._check_and_get_file(path)
        return file_obj

    def delete(self, path=""):
        """Deletes a file, as long as it is not opened. If the file is
        open, a FileConflict is raised. If the path is a directory,
        the directory and everything underneath it will be deleted.
        If the path is empty, the project will be deleted."""
        # deleting the project?
        if not path or path.endswith("/"):
            dir_obj = Directory(self, path)
            if not path:
                location = self.location
                if not location.exists():
                    raise FileNotFound("Project %s does not exist" % (self.name))
            else:
                location = dir_obj.location
                if not location.exists():
                    raise FileNotFound("Directory %s in project %s does not exist" %
                            (path, self.name))

            space_used = _get_space_used(location)

            if not path:
                self.metadata.delete()
            else:
                self.metadata.cache_delete(path, True)

            location.rmtree()
            config.c.stats.decr("projects")
            self.owner.amount_used -= space_used
        else:
            file_obj = File(self, path)

            if not file_obj.exists():
                raise FileNotFound("Cannot delete %s in project %s, file not found."
                    % (path, self.name))

            open_users = file_obj.users
            if open_users:
                raise FileConflict(
                    "File %s in project %s is in use by another user"
                    % (path, self.name))

            self.owner.amount_used -= file_obj.saved_size
            file_obj.location.remove()
            config.c.stats.decr("files")
            self.metadata.cache_delete(path)

    def import_tarball(self, filename, file_obj):
        """Imports the tarball in the file_obj into the project
        project owned by user. If the project already exists,
        IT WILL BE WIPED OUT AND REPLACED."""
        pfile = tarfile.open(filename, fileobj=file_obj)
        max_import_file_size = config.c.max_import_file_size
        info = list(pfile)

        base = _find_common_base(member.name for member in info)
        base_len = len(base)

        for member in info:
            # save the files, directories are created automatically
            # note that this does not currently support empty directories.
            if member.isreg():
                if member.size > max_import_file_size:
                    raise FSException("File %s too large (max is %s bytes)"
                        % (member.name, max_import_file_size))
                self.save_file(member.name[base_len:],
                    pfile.extractfile(member).read())

    def import_zipfile(self, filename, file_obj):
        """Imports the zip file in the file_obj into the project
        project owned by user. If the project already exists,
        IT WILL BE WIPED OUT AND REPLACED."""
        max_import_file_size = config.c.max_import_file_size

        pfile = zipfile.ZipFile(file_obj)
        info = pfile.infolist()

        base = _find_common_base(member.filename for member in info)
        base_len = len(base)

        for member in pfile.infolist():
            if member.filename.endswith("/"):
                continue
            if member.file_size > max_import_file_size:
                raise FSException("File %s too large (max is %s bytes)"
                    % (member.filename, max_import_file_size))
            self.save_file(member.filename[base_len:],
                pfile.read(member.filename))

    def export_tarball(self):
        """Exports the project as a tarball, returning a
        NamedTemporaryFile object. You can either use that
        open file handle or use the .name property to get
        at the file."""
        temporaryfile = tempfile.NamedTemporaryFile()

        mtime = time.time()
        tfile = tarfile.open(temporaryfile.name, "w:gz")

        location = self.location
        project_name = self.name

        # we'll do the top-level directory first and then
        # step through the other directories
        for dir in itertools.chain([location], location.walkdirs()):
            bname = dir.basename()
            if bname == "." or bname == "..":
                continue
            tarinfo = tarfile.TarInfo(project_name + "/"
                        + location.relpathto(dir))
            tarinfo.type = tarfile.DIRTYPE
            # we don't know the original permissions.
            # we'll default to read/execute for all, write only by user
            tarinfo.mode = 493
            tarinfo.mtime = mtime
            tfile.addfile(tarinfo)
            for file in dir.files():
                bname = file.basename()
                if bname == "." or bname == ".." or bname.startswith(".bespin"):
                    continue
                tarinfo = tarfile.TarInfo(project_name + "/"
                                + location.relpathto(file))
                tarinfo.mtime = mtime
                # we don't know the original permissions.
                # we'll default to read for all, write only by user
                tarinfo.mode = 420
                tarinfo.size = file.size
                fileobj = open(file)
                tfile.addfile(tarinfo, fileobj)
                fileobj.close()

        tfile.close()
        temporaryfile.seek(0)
        return temporaryfile

    def export_zipfile(self):
        """Exports the project as a zip file, returning a
        NamedTemporaryFile object. You can either use that
        open file handle or use the .name property to get
        at the file."""
        temporaryfile = tempfile.NamedTemporaryFile()

        zfile = zipfile.ZipFile(temporaryfile, "w", zipfile.ZIP_DEFLATED)
        ztime = time.gmtime()[:6]

        project_name = self.name
        location = self.location

        for file in self.location.walkfiles():
            zipinfo = zipfile.ZipInfo(project_name + "/"
                            + location.relpathto(file))
            # we don't know the original permissions.
            # we'll default to read for all, write only by user
            zipinfo.external_attr = 420 << 16L
            zipinfo.date_time = ztime
            zipinfo.compress_type = zipfile.ZIP_DEFLATED
            zfile.writestr(zipinfo, file.bytes())

        zfile.close()
        temporaryfile.seek(0)
        return temporaryfile

    def rename(self, new_name):
        """Renames this project to new_name, assuming there is
        not already another project with that name."""
        _check_identifiers("Project name", new_name)
        old_location = self.location
        new_location = self.location.parent / new_name
        self.metadata.rename(new_name)
        if new_location.exists():
            raise FileConflict("Cannot rename project %s to %s, because"
                " a project with the new name already exists."
                % (self.name, new_name))
        old_location.rename(new_location)
        self.name = new_name
        self.location = new_location

    def scan_files(self):
        """Looks through the files, computes how much space they
        take and updates the cached file list."""
        space_used, files = _get_file_list(self.location)
        self.metadata.cache_replace(files)
        return space_used

    def search_files(self, query, limit=20):
        """Scans the files for filenames that match the queries."""

        # make the query lower case so that the match boosting
        # in _SearchMatch can use it
        query = query.lower()
        if isinstance(query, unicode):
            query = query.encode('utf-8')
        escaped_query = [re.escape(char) for char in query]
        search_re = ".*".join(escaped_query)
        files = self.metadata.search_files(search_re)
        match_list = [_SearchMatch(query, f) for f in files]
        all_results = [str(match) for match in sorted(match_list)]
        return all_results[:limit]

class ProjectView(Project):
    """Provides a view of a project for a specific user. This handles
    things like open file status for the user."""

    def __init__(self, user, owner, name, location):
        self.user = user
        super(ProjectView, self).__init__(owner, name, location)

    def __repr__(self):
        return "ProjectView(name=%s)" % (self.name)

    def get_file(self, path, mode="rw"):
        """Gets the contents of the file as a string. Raises
        FileNotFound if the file does not exist. The file is
        marked as open after this call."""

        file_obj = self._check_and_get_file(path)
        self.user.mark_opened(file_obj, mode)
        file_obj.mark_opened(self.user, mode)

        contents = str(file_obj.data)
        return contents

    def delete(self, path=""):
        """Deletes a file, as long as it is not opened by another user.
        If the file is open, a FileConflict is raised. If the path is a
        directory, the directory and everything underneath it will be deleted.
        If the path is empty, the project will be deleted."""
        if path and not path.endswith("/"):
            file_obj = File(self, path)
            open_users = set(file_obj.users.keys())
            open_users.difference_update(set([self.user.username]))
            if open_users:
                raise FileConflict(
                    "File %s in project %s is in use by another user"
                    % (path, self.name))

            self.user.close(file_obj)
            file_obj.close(self.user)
        super(ProjectView, self).delete(path)

    def close(self, path):
        """Close the file for the current user"""
        file_obj = File(self, path)
        file_obj.close(self.user)
        self.user.close(file_obj)
        # self.reset_edits(user, project, path)

class ProjectMetadata(dict):
    """Provides access to Bespin-specific project information.
    This metadata is stored in an sqlite database in the user's
    metadata area."""

    def __init__(self, project):
        self.project_name = project.name
        self.project_location = project.location
        self.filename = self.project_location / ".." / \
                        (".%s_metadata" % self.project_name)
        self._connection = None
        self._regexp_initialized = False

    @property
    def connection(self):
        """Opens the database. This is generally done automatically
        by the methods that use the DB."""
        if self._connection:
            return self._connection

        is_new = not self.filename.exists()

        conn = sqlite3.connect(self.filename)
        self._connection = conn

        if is_new:
            c = conn.cursor()
            c.execute('''create table keyvalue (
    key text primary key,
    value text
)''')
            c.execute('''create table search_cache (
    filename
)''')
            conn.commit()
            c.close()
        return conn

    def delete(self):
        """Remove this metadata file."""
        if self.filename.exists():
            self.close()
            self.filename.unlink()

    def rename(self, new_project_name):
        """Rename this metadata file, because the project name is changing."""
        if self.filename.exists():
            d = self.filename.dirname()
            new_name = d / (".%s_metadata" % new_project_name)
            self.filename.rename(new_name)
            self.filename = new_name

    ######
    #
    # Methods for handling the filename cache
    #
    ######

    def cache_add(self, filename):
        """Add the file to the search cache."""
        conn = self.connection
        c = conn.cursor()
        c.execute("""insert into search_cache values (?)""", (filename,))
        conn.commit()
        c.close()

    def cache_delete(self, filename, recursive=False):
        """Remove the file from the search cache. If recursive is True,
        this will remove everything under there."""
        conn = self.connection
        c = conn.cursor()

        if recursive:
            op = " LIKE "
            if filename.endswith("/"):
                filename = filename[:-1]
            filename += "%"
        else:
            op = "="

        c.execute("""delete from search_cache where filename%s?""" % op, (filename,))
        conn.commit()
        c.close()

    def cache_replace(self, files):
        """Replace the entire search cache with the list of files provided."""
        conn = self.connection
        c = conn.cursor()
        c.execute("delete from search_cache")
        for filename in files:
            c.execute("""insert into search_cache values (?)""", (filename,))
        conn.commit()
        c.close()

    def search_files(self, search_expr):
        """Search the file list with the given regular expression."""
        conn = self.connection
        # the sqlite REGEXP support needs a supplied regexp function
        if not self._regexp_initialized:
            conn.create_function("regexp", 2, _regexp)
        c = conn.cursor()
        rs = c.execute(
            "SELECT filename FROM search_cache WHERE filename REGEXP ?",
            (search_expr,))
        result = [item[0] for item in rs]
        c.close()
        return result

    def get_file_list(self):
        """Return a list of all files."""
        conn = self.connection
        c = conn.cursor()
        rs = c.execute(
            "SELECT filename FROM search_cache"
        )
        result = [item[0] for item in rs]
        c.close()
        return result

    ######
    #
    # Dictionary methods for the key/value store
    #
    ######

    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default

    def __getitem__(self, key):
        conn = self.connection
        c = conn.cursor()
        c.execute("""select value from keyvalue where key=?""", (key,))
        value = None
        for row in c:
            value = row[0]
        c.close()
        if value is None:
            raise KeyError("%s not found" % key)
        return value

    def __setitem__(self, key, value):
        conn = self.connection
        c = conn.cursor()
        c.execute("delete from keyvalue where key=?", (key,))
        c.execute("""insert into keyvalue (key, value) values (?, ?) """,
                    (key, value))
        conn.commit()
        c.close()

    def __delitem__(self, key):
        conn = self.connection
        c = conn.cursor()
        c.execute("delete from keyvalue where key=?", (key,))
        conn.commit()
        c.close()

    def close(self):
        """Close the metadata database."""
        if self._connection:
            self._connection.close()
            self._connection = None

    def __del__(self):
        self.close()
