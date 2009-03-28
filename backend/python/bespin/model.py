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

"""Data classes for working with files/projects/users."""
import os
import time
from cStringIO import StringIO
import hashlib
import tarfile
import tempfile
import mimetypes
import zipfile
from datetime import datetime
import logging
import re
from uuid import uuid4
import shutil
import subprocess
import itertools

from path import path as path_obj
from pathutils import LockError as PULockError, Lock, LockFile
import pkg_resources
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import (Column, PickleType, String, Integer,
                    Boolean, Binary, Table, ForeignKey,
                    DateTime, func, UniqueConstraint)
from sqlalchemy.orm import relation, deferred, mapper, backref
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm.exc import NoResultFound
import simplejson
import jinja2

from bespin import config

log = logging.getLogger("bespin.model")

Base = declarative_base()

# quotas are expressed in 1 megabyte increments
QUOTA_UNITS = 1048576

class ConflictError(Exception):
    pass
    
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

class BadValue(FSException):
    pass
    
class LockError(FSException):
    pass
    
class Connection(Base):
    __tablename__ = "connections"

    followed_id = Column(Integer, ForeignKey('users.id', ondelete='cascade'), primary_key=True)
    followed = relation('User', primaryjoin='User.id==Connection.followed_id')
    following_id = Column(Integer, ForeignKey('users.id', ondelete='cascade'), primary_key=True)
    following = relation('User', primaryjoin='User.id==Connection.following_id')

    followed_viewable = Column(Boolean, default=False)

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    uuid = Column(String(36), unique=True)
    username = Column(String(128), unique=True)
    email = Column(String(128))
    password = Column(String(20))
    settings = Column(PickleType())
    quota = Column(Integer, default=10)
    amount_used = Column(Integer, default=0)
    file_location = Column(String(200))
    everyone_viewable = Column(Boolean, default=False)
    
    i_follow = relation(Connection,
                        primaryjoin=Connection.following_id==id,
                        secondary=Connection.__table__,
                        secondaryjoin=id==Connection.followed_id)

    following_me = relation(Connection,
                            primaryjoin=Connection.followed_id==id,
                            secondary=Connection.__table__,
                            secondaryjoin=id==Connection.following_id)
    
    def __init__(self, username, password, email):
        self.username = username
        self.email = email
        self.password = password
        self.settings = {}
        self.quota = config.c.default_quota
        self.uuid = str(uuid4())
        if config.c.use_uuid_as_dir_identifier:
            file_location = self.uuid
        else:
            file_location = username
            
        if config.c.fslevels:
            levels = config.c.fslevels
            file_location = "/".join(file_location[:levels]) + "/" + file_location
            
        self.file_location = file_location
        
    def __str__(self):
        return "%s (%s-%s)" % (self.username, self.id, id(self))
        
    def check_save(self, amount):
        """Confirms that the user can save this amount. Returns True
        if the user has enough available in their quota, False otherwise.
        """
        return (self.quota * QUOTA_UNITS - self.amount_used - amount) > 0
        
    def quota_info(self):
        """Returns the tuple of quota and amount_used"""
        return (self.quota * QUOTA_UNITS, self.amount_used)
    
    def get_location(self):
        file_loc = self.file_location
        if file_loc.startswith("/"):
            location = path_obj(file_loc)
        else:
            location = config.c.fsroot / file_loc
        if not location.exists():
            location.makedirs()
        return location
    
    @property
    def projects(self):
        location = self.get_location()
        result = [Project(self, name.basename(), location / name) 
                for name in location.dirs()
                if not name.basename().startswith(".")]
        result = sorted(result, key=lambda item: item.name)
        return result
        
    @property
    def statusfile(self):
        return self.get_location() / ".bespin-status.json"
        
    def recompute_files(self):
        """Recomputes how much space the user has used."""
        total = 0
        # add up all of the directory contents
        # by only looking at directories, we skip
        # over our metadata files
        for proj in self.projects:
            additional, files = _get_file_list(proj.location)
            total += additional
            proj._save_file_list(files)
        self.amount_used = total

    def mark_opened(self, file_obj, mode):
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
            project_files = open_files.setdefault(file_obj.project.name, {})
            project_files[file_obj.name] = {'mode' : mode}
            statusfile.write_bytes(simplejson.dumps(statusinfo))
            lock.unlock()
        except PULockError, e:
            raise LockError("Problem tracking open status for file %s: %s" %
                        (file_obj.name, str(e)))
    
    def close(self, file_obj):
        """Keeps track of this file as being currently closed by the
        user."""
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
            project_files = open_files.get(file_obj.project.name)
            if project_files is not None:
                try:
                    del project_files[file_obj.name]
                except KeyError:
                    pass
                
                if not project_files:
                    del open_files[file_obj.project.name]
                    
                statusfile.write_bytes(simplejson.dumps(statusinfo))
                
            lock.unlock()
        except PULockError, e:
            raise LockError("Problem tracking open status for file %s: %s" %
                        (file_obj.name, str(e)))
    
    @property
    def files(self):
        """Returns a dictionary of the form::
            
            {'project' : {'path/to/file' : {'mode' : 'rw'}}}
        """
        if not self.statusfile.exists():
            return {}
        try:
            statusfile = LockFile(self.statusfile)
            statusinfo = statusfile.read()
            statusfile.close()
        except PULockError, e:
            raise LockError("Problem reading open file status: %s", str(e))
        
        statusinfo = simplejson.loads(statusinfo)
        return statusinfo.get("open", {})
        
class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey('users.id', ondelete='cascade'))
    name = Column(String(128))
    owner_viewable = Column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("owner_id", "name"), {})

class GroupMembership(Base):
    __tablename__ = "group_memberships"

    group_id = Column(Integer, ForeignKey('groups.id', ondelete='cascade'), primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='cascade'), primary_key=True)

class UserSharing(Base):
    __tablename__ = "user_sharing"

    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey('users.id', ondelete='cascade'))
    project_name = Column(String(128))
    invited_user_id = Column(Integer, ForeignKey('users.id', ondelete='cascade'))
    edit = Column(Boolean, default=False)
    loadany = Column(Boolean, default=False)    

    __table_args__ = (UniqueConstraint("owner_id", "project_name", "invited_user_id"), {})

class GroupSharing(Base):
    __tablename__ = "group_sharing"

    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey('users.id', ondelete='cascade'))
    project_name = Column(String(128))
    invited_group_id = Column(Integer, ForeignKey('groups.id', ondelete='cascade'))
    edit = Column(Boolean, default=False)
    loadany = Column(Boolean, default=False)    

    __table_args__ = (UniqueConstraint("owner_id", "project_name", "invited_group_id"), {})

bad_characters = "<>| '\"/"
invalid_chars = re.compile(r'[%s]' % bad_characters)

def _check_identifiers(kind, value):
    if invalid_chars.search(value):
        raise BadValue("%s cannot contain any of: %s"
            % (kind, bad_characters))
    if value.startswith("."):
        raise BadValue("%s cannot start with '.'" % (kind))
    

class UserManager(object):
    def __init__(self, session):
        self.session = session
        
    def create_user(self, username, password, email, override_location=None):
        """Adds a new user with the given username and password.
        This raises a ConflictError is the user already
        exists."""
        _check_identifiers("Usernames", username)
            
        log.debug("Creating user %s", username)
        user = User(username, password, email)
        if override_location is not None:
            user.file_location = override_location
        self.session.add(user)
        # flush to ensure that the user is unique
        try:
            self.session.flush()
        except DBAPIError, e:
            raise ConflictError("Username %s is already in use" % username)
        
        project = get_project(user, user, "SampleProject", create=True)
        project.install_template()
        return user
        
    def get_user(self, username):
        """Looks up a user by username. Returns None if the user is not
        found."""
        return self.session.query(User).filter_by(username=username).first()
        
    def users_i_follow(self, following_user):
        """ """
        return self.session.query(Connection).filter_by(following=following_user).all()

    def users_following_me(self, followed_user):
        """ """
        return self.session.query(Connection).filter_by(followed=followed_user).all()

    def follow(self, following_user, followed_user):
        """ """
        if (followed_user == following_user):
            raise ConflictError("You can't follow yourself")

        following_user_name = following_user.username;
        followed_user_name = followed_user.username;
        self.session.add(Connection(followed=followed_user, following=following_user))
        try:
            self.session.flush()
        except DBAPIError:
            raise ConflictError("%s is already following %s" % (following_user_name, followed_user_name))

    def unfollow(self, following_user, followed_user):
        """ """
        following_user_name = following_user.username;
        followed_user_name = followed_user.username;
        rows = self.session.query(Connection).filter_by(followed=followed_user, following=following_user).delete()
        if (rows == 0):
            raise ConflictError("%s is not following %s" % (following_user_name, followed_user_name))

    def get_groups(self, user):
        """ """
        groups = self.session.query(Group).filter_by(owner_id=user.id).all()
        return groups

    def get_group_members(self, user, groupname):
        """ """
        group = self.session.query(Group).filter_by(owner_id=user.id, name=groupname).one()
        members = self.sesison.query(GroupMember).filter_by(group_id=group.id).all()
        return members

    def remove_all_group_members(self, user, groupname):
        """ """
        group = self.session.query(Group).filter_by(owner_id=user.id, name=groupname).one()
        members = self.sesison.query(GroupMember).filter_by(group_id=group.id).delete()
        pass

    def remove_group_members(self, user, groupname, other_user):
        """ """
        group = self.session.query(Group).filter_by(owner_id=user.id, name=groupname).one()
        members = self.sesison.query(GroupMember).filter_by(group_id=group.id, user_id=other_user.id).delete()
        pass

    def add_group_members(self, user, groupname, other_user):
        """ """
        group = self.session.query(Group).filter_by(owner_id=user.id, name=groupname).one()
        self.session.add(GroupMember(group_id=group.id, user_id=other_user.id))
        try:
            self.session.flush()
        except DBAPIError:
            raise ConflictError("%s is already following %s" % (following_user_name, followed_user_name))
        pass

    def get_sharing(project, member=None):
        return [ "Not implemented", project, member ]

    def remove_sharing(project, member=None):
        return [ "Not implemented", project, member ]

    def add_sharing(project, member, options):
        return [ "Not implemented", project, member, options ]

    def get_viewme(member=None):
        return [ "Not implemented", member ]

    def set_viewme(member, value):
        return [ "Not implemented", member, value ]


class Directory(object):
    def __init__(self, name):
        if not name.endswith("/"):
            name += "/"
        self.name = name
    
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
        file_obj = self.location.write_bytes(contents)
                     
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
                        (file_obj.name, str(e)))
    
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
                        (file_obj.name, str(e)))
        

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


class Project(object):
    """Provides access to the files in a project."""
    
    def __init__(self, owner, name, location):
        self.owner = owner
        self.name = name
        self.location = location
    
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
        
        # this is the case where save_file is being used to
        # create a directory
        if contents is None:
            if destpath.endswith("/"):
                if file_loc.exists():
                    if file_loc.isfile():
                        raise FileConflict("Cannot create directory %s "
                            "because there is already a file there."
                            % destpath)
                else:
                    file_loc.makedirs()
                    return
            else:
                raise FSException("Cannot create %s because no content "
                    " was provided for the file" % destpath)
        
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
            self._search_cache.write_bytes("%s\n" % destpath, append=True)
        file.save(contents)
        self.owner.amount_used += size_delta
        return file

    def install_template(self, template="template", other_vars=None):
        """Installs a set of template files into a new project.
        
        The template directory will be found by searching 
        config.c.template_path to find a matching directory name.
        The files inside of that directory will be installed into
        the project, with the common root for the files chopped off.
        
        Additionally, filenames containing { will be treated as Jinja2
        templates and the contents of files will be treated as Jinja2
        templates. This means that the filenames can contain variables
        that are substituted when the template is installed into the
        user's project. The contents of the files can also have variables
        and small amounts of logic.
        
        These Jinja2 templates automatically have "project" as a variable
        (you might often want to use project.name). You can pass in
        a dictionary for other_vars and those values will also be available
        in the templates.
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
        
        env = jinja2.Environment()
        if other_vars is not None:
            variables = other_vars
        else:
            variables = {}
        
        variables['project'] = self
            
        common_path_len = len(source_dir) + 1
        for dirpath, dirnames, filenames in os.walk(source_dir):
            destdir = dirpath[common_path_len:]
            if '.svn' in destdir:
                continue
            for f in filenames:
                if "{" in f:
                    temp = env.from_string(f)
                    dest_f = temp.render(variables)
                else:
                    dest_f = f
                
                if destdir:
                    destpath = "%s/%s" % (destdir, dest_f)
                else:
                    destpath = dest_f
                contents = open(os.path.join(dirpath, f)).read()
                temp = env.from_string(contents)
                contents = temp.render(variables)
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
                result.append(Directory(self.location.relpathto(name)))
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
            if not path:
                location = self.location
                if not location.exists():
                    raise FileNotFound("Project %s does not exist" % (self.name))
            else:
                location = self.location / path
                if not location.exists():
                    raise FileNotFound("Directory %s in project %s does not exist" %
                            (path, self.name))
            
            space_used = _get_space_used(location)
            location.rmtree()
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
        old_location = self.location
        new_location = self.location.parent / new_name
        if new_location.exists():
            raise FileConflict("Cannot rename project %s to %s, because"
                " a project with the new name already exists."
                % (self.name, new_name))
        old_location.rename(new_location)
        self.name = new_name
        self.location = new_location
        
    @property
    def _search_cache(self):
        return self.location.parent / (".%s_filelist" % (self.name))
        
    def _save_file_list(self, files):
        cache_file = self._search_cache
        cache_file.write_bytes("\n".join(files))
        
    def search_files(self, query, limit=20):
        """Scans the files for filenames that match the queries."""
        match_list = []
        
        # make the query lower case so that the match boosting
        # in _SearchMatch can use it
        query = query.lower()
        escaped_query = [re.escape(char) for char in query]
        search_re = ".*".join(escaped_query)
        main_search = re.compile(search_re, re.I)
        location = self.location
        files = self._search_cache.lines(retain=False)
        for f in files:
            if main_search.search(path_obj(f).basename()):
                match_list.append(_SearchMatch(query, f))
        all_results = [str(match) for match in sorted(match_list)]
        return all_results[:limit]
        

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
    
