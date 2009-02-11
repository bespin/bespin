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

import pkg_resources
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import (Column, PickleType, String, Integer,
                    Boolean, Binary, Table, ForeignKey,
                    DateTime, func)
from sqlalchemy.orm import relation, deferred, mapper, backref
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm.exc import NoResultFound

from bespin import config

log = logging.getLogger("bespin.model")

Base = declarative_base()

# quotas are expressed in 1 million byte increments
QUOTA_UNITS = 1000000

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
    
class DB(object):
    def __init__(self, user_manager, file_manager):
        self.user_manager = user_manager
        self.file_manager = file_manager
        
        user_manager.db = self
        file_manager.db = self
    
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    username = Column(String(20), unique=True)
    email = Column(String(128))
    password = Column(String(20))
    settings = Column(PickleType())
    private_project = Column(String(50))
    projects = relation('Project', backref='owner')
    quota = Column(Integer, default=10)
    amount_used = Column(Integer, default=0)
    
    def __init__(self, username, password, email):
        self.username = username
        self.email = email
        self.password = password
        self.settings = {}
        self.quota = config.c.default_quota
        
        hashobj = hashlib.sha1(self.username + " " 
                + config.c.secret + " " + self.password)
        # the NUMBER- at the beginning is the version number of the
        # key. every time we change how we compute the hash, we should
        # increment this number. This will avoid the unlikely
        # collisions.
        self.private_project = "2-" + hashobj.hexdigest()
        
    def __str__(self):
        return "%s (%s-%s)" % (self.username, self.id, id(self))
    

class UserManager(object):
    def __init__(self, session):
        self.session = session
        
    def create_user(self, username, password, email):
        """Adds a new user with the given username and password.
        This raises a ConflictError is the user already
        exists."""
        log.debug("Creating user %s", username)
        user = User(username, password, email)
        self.session.add(user)
        # flush to ensure that the user is unique
        try:
            self.session.flush()
        except DBAPIError:
            raise ConflictError("Username %s is already in use" % username)
        self.db.file_manager.install_template(user,
                                username + "_New_Project")
        return user
        
    def get_user(self, username):
        """Looks up a user by username. Returns None if the user is not
        found."""
        return self.session.query(User).filter_by(username=username).first()
            
class FileStatus(Base):
    __tablename__ = "filestatus"
    
    user_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    file_id = Column(Integer, ForeignKey('files.id'), primary_key=True)
    read_only = Column(Boolean)
    user = relation(User, backref="files")
    
class File(Base):
    __tablename__ = "files"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(700), unique=True)
    created = Column(DateTime, default=datetime.now)
    modified = Column(DateTime, onupdate=datetime.now)
    saved_size = Column(Integer)
    data = deferred(Column(Binary))
    edits = deferred(Column(PickleType))
    dir_id = Column(Integer, ForeignKey('directories.id'))
    dir = relation('Directory', backref="files")
    
    users = relation(FileStatus,
                     backref="file")
    
    @property
    def short_name(self):
        return self.name.rsplit("/", 1)[1]
        
    @property
    def mimetype(self):
        """Returns the mimetype of the file, or application/octet-stream 
        if it cannot be guessed."""
        t = mimetypes.guess_type(self.name)
        if t:
            return t[0]
        return "application/octet-stream"
                     
    def __repr__(self):
        return "File: %s" % (self.name)
        
project_members = Table('members', Base.metadata,
                        Column('project_id', Integer, ForeignKey('projects.id')),
                        Column('user_id', Integer, ForeignKey('users.id')))
    
class Directory(Base):
    __tablename__ = "directories"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(700), unique=True)
    parent_id = Column(Integer, ForeignKey('directories.id'))
    subdirs = relation('Directory', backref=backref("parent", 
                                        remote_side=[id]))
    
    @property
    def short_name(self):
        return self.name.rsplit("/", 2)[-2] + "/"
        
    def __str__(self):
        return "Dir: %s" % (self.name)
    
    __repr__ = __str__
    
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(60), unique=True)
    members = relation("User", secondary=project_members, lazy=False)
    user_id = Column(Integer, ForeignKey('users.id'))
    
    def authorize(self, user):
        log.debug("Checking user %s access to project %s owned by %s with members %s",
            user, self.name, self.owner, self.members)
        if user != self.owner and user not in self.members:
            raise NotAuthorized("You are not authorized to access that project.")
            
    def authorize_user(self, user, auth_user):
        """user is requesting to allow auth_user to access this
        project. user must be this project's owner."""
        if user != self.owner:
            raise NotAuthorized("Only the project owner can authorize users.")
        if auth_user not in self.members:
            self.members.append(auth_user)
        
    def unauthorize_user(self, user, auth_user):
        """user wants auth_user to no longer be able to access this
        project. user must be the project owner."""
        if user != self.owner:
            raise NotAuthorized("Only the project owner can unauthorize users.")
        try:
            self.members.remove(auth_user)
        except KeyError:
            pass
    
    @property
    def short_name(self):
        return self.name + "/"
            
    def __repr__(self):
        return "Project(name=%s)" % (self.name)


_text_types = set(['.txt', '.html', '.htm', '.css', '.js', '.py', '.pl'])    

class FileManager(object):
    def __init__(self, session):
        self.session = session
        
    def get_file(self, user, project, path, mode="rw"):
        """Gets the contents of the file as a string. Raises
        FileNotFound if the file does not exist. The file is 
        marked as open after this call."""
        
        project, file_obj = \
            self._check_and_get_file(user, project, path)
        self._save_status(file_obj, user, mode)
        
        contents = str(file_obj.data)
        return contents
        
    def _check_and_get_file(self, user, project, path):
        """Returns the project, user object, file object."""
        project = self.get_project(user, project)
        s = self.session
        full_path = project.name + "/" + path
        
        try:
            file_obj = s.query(File).filter_by(name=full_path).one()
        except NoResultFound:
            raise FileNotFound("File %s in project %s does not exist" 
                                % (path, project.name))
        
        if file_obj.data == None:
            raise FileNotFound("File %s in project %s does not exist" 
                                % (path, project.name))
        
        return project, file_obj
        
    def get_file_object(self, user, project, path):
        """Retrieves the File instance from the project at the
        path provided."""
        project, file_obj = \
            self._check_and_get_file(user, project, path)
        return file_obj
    
    def _save_status(self, file_obj, user_obj, mode="rw"):
        s = self.session
        
        readonly = mode != "rw"
        try:
            status_obj = s.query(FileStatus).filter_by(file_id=file_obj.id) \
                            .filter_by(user_id=user_obj.id).one()
            if status_obj.read_only != readonly:
                status_obj.read_only = readonly
        except NoResultFound:
            status_obj = FileStatus(user_id = user_obj.id, file=file_obj,
                                    read_only=readonly)
            s.add(status_obj)
            if status_obj not in user_obj.files:
                user_obj.files.append(status_obj)
            if status_obj not in file_obj.users:
                file_obj.users.append(status_obj)
        
        
    def list_files(self, user, project=None, path=""):
        """Retrieve a list of files at the path. Directories will have
        '/' at the end of the name.
        
        If project is None, this will return the projects
        owned by the user."""
        if not project:
            return sorted(user.projects, key=lambda proj: proj.name)
        project = self.get_project(user, project)
        full_path = project.name + "/" + path
        try:
            dir = self.session.query(Directory).filter_by(name=full_path).one()
        except NoResultFound:
            raise FileNotFound(full_path)
        
        result = set(dir.subdirs)
        result.update(set(dir.files))
        return sorted(result, key=lambda item: item.name)
        
    def get_project(self, user, project_name, create=False, clean=False):
        """Retrieves the project object, optionally creating it if it
        doesn't exist. Additionally, this will verify that the
        user is authorized for the project. If the project_name is
        actually a project object, that object is simply returned."""
        
        if isinstance(project_name, Project):
            return project_name
        
        s = self.session
        
        # a request for a clean project also implies that creating it
        # is okay
        if clean:
            create = True
        
        try:
            project = s.query(Project).filter_by(name=project_name).one()
            project.authorize(user)
            if clean:
                # a clean project has been requested, so we will delete its
                # contents
                self.delete(user, project)
        except NoResultFound:
            if not create:
                raise FileNotFound("Project %s not found" % project_name)
            log.debug("Creating new project %s", project_name)
            project = Project(name=project_name, owner=user)
            s.add(project)
        return project
        
    def save_file(self, user, project, path, contents, last_edit=None):
        """Saves the contents to the file path provided, creating
        directories as needed in between. If last_edit is not provided,
        the file must not be opened for editing. Otherwise, the
        last_edit parameter should include the last edit ID received by
        the user."""
        project = self.get_project(user, project, create=True)
        
        s = self.session
        full_path = project.name + "/" + path
        segments = full_path.split("/")
        fn = segments[-1]
        
        # temporary step to replace tabs with 4 spaces.
        file_type = os.path.splitext(path)[1]
        if file_type in _text_types:
            contents = contents.replace("\t", "    ")
        
        last_d = None
        
        for i in range(1, len(segments)):
            segment = "/".join(segments[0:i]) + "/"
            try:
                d = s.query(Directory).filter_by(name=segment).one()
            except NoResultFound:
                d = Directory(name=segment)
                s.add(d)
                if last_d:
                    last_d.subdirs.append(d)
            last_d = d
        if not last_d:
            raise FSException("Unable to get to path %s from the root" % full_path)
        subdir_names = [item.name for item in last_d.subdirs]
        if (full_path + "/") in subdir_names:
            raise FileConflict("Cannot save a file at %s because there is a directory there." % full_path)
        
        saved_size = len(contents) if contents is not None else 0    
        
        try:
            file = s.query(File).filter_by(name=full_path).one()
            file.data = contents
            size_change = saved_size - file.saved_size
            user.amount_used += size_change
            file.saved_size = saved_size
        except NoResultFound:
            file = File(name=full_path, dir=last_d, data=contents,
                        saved_size=saved_size)
            user.amount_used += saved_size
            s.add(file)
            
        self.reset_edits(user, project, path)
        return file
        
    def list_open(self, user):
        """list open files for the current user. a dictionary of { project: { filename: mode } } will be returned. For example, if subdir1/subdir2/test.py is open read/write, openfiles will return { "subdir1": { "somedir2/test.py": {"mode" : "rw"} } }"""
        output = {}
        current_files = None
        last_proj = None
        for fs in sorted(user.files, key=lambda item: item.file.name):
            project, path = fs.file.name.split("/", 1)
            if project != last_proj:
                last_proj = project
                current_files = {}
                output[project] = current_files
            mode = "rw" if not fs.read_only else "r"
            current_files[path] = dict(mode=mode)
            
        return output
        
    def close(self, user, project, path):
        """Close the file for the given user"""
        project = self.get_project(user, project)
        s = self.session
        full_path = project.name + "/" + path
        try:
            file_obj = s.query(File).filter_by(name=full_path).one()
        except NoResultFound:
            return
            
        try:
            fs = s.query(FileStatus).filter_by(user_id=user.id) \
                    .filter_by(file_id=file_obj.id).one()
        except NoResultFound:
            return
        
        self.reset_edits(user, project, path)
    
    def delete(self, user, project, path=""):
        """Deletes a file, as long as it is not opened. If the file is
        open, a FileConflict is raised. If the path is a directory,
        the directory and everything underneath it will be deleted.
        If the path is empty, the project will be deleted."""
        project = self.get_project(user, project)
        s = self.session
        full_path = project.name + "/" + path
        if full_path.endswith("/"):
            try:
                dir_obj = s.query(Directory).filter_by(name=full_path).one()
            except NoResultFound:
                raise FileNotFound("Directory %s not found in project %s" %
                                    (path, project.name))
                
            if dir_obj.parent:
                dir_obj.parent.subdirs.remove(dir_obj)
            s.query(Directory).filter(Directory.name.like(full_path + "%")).delete()
            file_space = s.query(func.sum(File.saved_size)) \
                            .filter(File.name.like(full_path + "%")).one()[0]
            user.amount_used -= file_space
            s.query(File).filter(File.name.like(full_path + "%")).delete()
        else:
            try:
                file_obj = s.query(File).filter_by(name=full_path).one()
            except NoResultFound:
                raise FileNotFound("File %s not found in project %s" %
                                    (path, project.name))
            open_users = set(s.user for s in file_obj.users)
            open_users.difference_update(set([user]))
            if open_users:
                raise FileConflict(
                    "File %s in project %s is in use by another user"
                    % (path, project.name))
            # make sure we delete the open status if the current
            # user has it open
            for fs in file_obj.users:
                s.delete(fs)
            user.amount_used -= file_obj.saved_size
            s.delete(file_obj)
        
    def save_edit(self, user, project, path, edit):
        project = self.get_project(user, project, create=True)
        full_path = project.name + "/" + path
        s = self.session
        try:
            file_obj = s.query(File).filter_by(name=full_path).one()
        except NoResultFound:
            file_obj = self.save_file(user, project.name, path, None)
        
        if file_obj.edits is None:
            file_obj.edits = []
        
        file_obj.edits.append(edit)
        
        self._save_status(file_obj, user, "rw")
        
    def list_edits(self, user, project, path, start_at=0):
        project = self.get_project(user, project)
        full_path = project.name + "/" + path
        try:
            file_obj = self.session.query(File).filter_by(name=full_path).one()
        except NoResultFound:
            raise FileNotFound("File %s in project %s does not exist"
                    % (path, project.name))
        edits = file_obj.edits
        if start_at:
            if start_at >= len(edits):
                raise FSException("%s only has %s edits (after %s requested)"
                    % (full_path, len(edits), start_at))
            edits = edits[start_at:]
        return edits
        
    def reset_edits(self, user, project=None, path=None):
        if not project or not path:
            for fs in user.files[:]:
                file_obj = fs.file
                project, path = file_obj.name.split("/", 1)
                self.reset_edits(user, project, path)
            return
        project = self.get_project(user, project)
        full_path = project.name + "/" + path
        s = self.session
        try:
            file_obj = s.query(File).filter_by(name=full_path).one()
        except NoResultFound:
            return
        file_obj.edits = []
        for fs in file_obj.users:
            if fs.user == user:
                s.delete(fs)
                file_obj.users.remove(fs)
                if fs in user.files:
                    user.files.remove(fs)
                break
            
    def install_template(self, user, project, template="template"):
        """Installs a set of template files into a new project."""
        log.debug("Installing template %s for user %s as project %s",
                template, user, project)
        project = self.get_project(user, project, create=True)
        source_dir = pkg_resources.resource_filename("bespin", template)
        common_path_len = len(source_dir) + 1
        for dirpath, dirnames, filenames in os.walk(source_dir):
            destdir = dirpath[common_path_len:]
            if '.svn' in destdir:
                continue
            for f in filenames:
                if destdir:
                    destpath = "%s/%s" % (destdir, f)
                else:
                    destpath = f
                contents = open(os.path.join(dirpath, f)).read()
                self.save_file(user, project, destpath, contents)
                
    def authorize_user(self, user, project, auth_user):
        """Allow auth_user to access project which is owned by user."""
        project = self.get_project(user, project)
        project.authorize_user(user, auth_user)
        
    def unauthorize_user(self, user, project, auth_user):
        """Disallow auth_user from accessing project_name which is owned
        by user."""
        project = self.get_project(user, project)
        project.unauthorize_user(user, auth_user)
        
    def import_tarball(self, user, project, filename, file_obj):
        """Imports the tarball in the file_obj into the project
        project owned by user. If the project already exists,
        IT WILL BE WIPED OUT AND REPLACED."""
        project = self.get_project(user, project, clean=True)
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
                self.save_file(user, project, member.name[base_len:], 
                    pfile.extractfile(member).read())
        
    def import_zipfile(self, user, project, filename, file_obj):
        """Imports the zip file in the file_obj into the project
        project owned by user. If the project already exists,
        IT WILL BE WIPED OUT AND REPLACED."""
        project = self.get_project(user, project, clean=True)
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
            self.save_file(user, project, member.filename[base_len:],
                pfile.read(member.filename))
        
    def export_tarball(self, user, project):
        """Exports the project as a tarball, returning a 
        NamedTemporaryFile object. You can either use that
        open file handle or use the .name property to get
        at the file."""
        project = self.get_project(user, project)
        temporaryfile = tempfile.NamedTemporaryFile()
        s = self.session
        
        mtime = time.time()
        tfile = tarfile.open(temporaryfile.name, "w:gz")
        
        dirs = s.query(Directory).filter(Directory.name.like(project.name + "/%")) \
                        .order_by(Directory.name).all()
                        
        for dir in dirs:
            tarinfo = tarfile.TarInfo(str(dir.name))
            tarinfo.type = tarfile.DIRTYPE
            # we don't know the original permissions.
            # we'll default to read/execute for all, write only by user
            tarinfo.mode = 493
            tarinfo.mtime = mtime
            tfile.addfile(tarinfo)
            for file in dir.files:
                tarinfo = tarfile.TarInfo(str(file.name))
                tarinfo.mtime = mtime
                # we don't know the original permissions.
                # we'll default to read for all, write only by user
                tarinfo.mode = 420
                data = str(file.data)
                tarinfo.size = len(data)
                fileobj = StringIO(data)
                tfile.addfile(tarinfo, fileobj)
                
                # ditch the file, because these objects can get big
                s.expunge(file)
                
            s.expunge(dir)
        
        tfile.close()
        temporaryfile.seek(0)
        return temporaryfile
        
    def export_zipfile(self, user, project):
        """Exports the project as a zip file, returning a 
        NamedTemporaryFile object. You can either use that
        open file handle or use the .name property to get
        at the file."""
        project = self.get_project(user, project)
        temporaryfile = tempfile.NamedTemporaryFile()
        s = self.session
        
        zfile = zipfile.ZipFile(temporaryfile, "w", zipfile.ZIP_DEFLATED)
        ztime = time.gmtime()[:6]
        
        files = s.query(File).filter(File.name.like(project.name + "/%")) \
                    .order_by(File.name).all()
        for file in files:
            zipinfo = zipfile.ZipInfo(str(file.name))
            # we don't know the original permissions.
            # we'll default to read for all, write only by user
            zipinfo.external_attr = 420 << 16L
            zipinfo.date_time = ztime
            zipinfo.compress_type = zipfile.ZIP_DEFLATED
            zfile.writestr(zipinfo, str(file.data))
            s.expunge(file)
            
        zfile.close()
        temporaryfile.seek(0)
        return temporaryfile
        
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
    
