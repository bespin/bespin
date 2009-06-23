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
from datetime import datetime
import logging
from uuid import uuid4
import simplejson
from hashlib import sha256

from path import path as path_obj
from pathutils import LockError as PULockError, Lock, LockFile

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import (Column, PickleType, String, Integer,
                    Boolean, ForeignKey, Binary,
                    DateTime, Text)
from sqlalchemy.orm import relation
from sqlalchemy.exc import DBAPIError
from sqlalchemy.schema import UniqueConstraint

from bespin import config, filesystem
from bespin.utils import _check_identifiers, BadValue
from bespin.filesystem import get_project, Project, LockError

log = logging.getLogger("bespin.model")

class ConflictError(Exception):
    pass

def debug():
    for table in [ User, Group, GroupMembership ]:
        for found in _get_session().query(table).all():
            print found

def _get_session():
    return config.c.session_factory()

Base = declarative_base()

class Connection(Base):
    __tablename__ = "connections"

    followed_id = Column(Integer, ForeignKey('users.id', ondelete='cascade'), primary_key=True)
    followed = relation('User', primaryjoin='User.id==Connection.followed_id')
    following_id = Column(Integer, ForeignKey('users.id', ondelete='cascade'), primary_key=True)
    following = relation('User', primaryjoin='User.id==Connection.following_id')

    followed_viewable = Column(Boolean, default=False)

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="cascade"))
    when = Column(DateTime, default=datetime.now)
    message = Column(Text)

    def __str__(self):
        return "Message[id=%s, msg=%s]" % (self.id, self.message)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    uuid = Column(String(36), unique=True)
    username = Column(String(128), unique=True)
    email = Column(String(128))
    password = Column(String(64))
    settings = Column(PickleType())
    quota = Column(Integer, default=10)
    amount_used = Column(Integer, default=0)
    file_location = Column(String(200))
    everyone_viewable = Column(Boolean, default=False)
    messages = relation(Message, order_by=Message.when, backref="user")

    i_follow = relation(Connection,
                        primaryjoin=Connection.following_id==id,
                        secondary=Connection.__table__,
                        secondaryjoin=id==Connection.followed_id)

    following_me = relation(Connection,
                            primaryjoin=Connection.followed_id==id,
                            secondary=Connection.__table__,
                            secondaryjoin=id==Connection.following_id)
                    
                    
    @staticmethod
    def generate_password(password):
        password_hash = sha256()
        password_hash.update(config.c.pw_secret + password)
        return password_hash.hexdigest()

    @classmethod
    def create_user(cls, username, password, email, override_location=None):
        """Adds a new user with the given username and password.
        This raises a ConflictError is the user already
        exists."""
        _check_identifiers("Usernames", username)

        log.debug("Creating user %s", username)
        password = User.generate_password(password)
        
        user = cls(username, password, email)
        if override_location is not None:
            user.file_location = override_location
        _get_session().add(user)
        # flush to ensure that the user is unique
        try:
            _get_session().flush()
        except DBAPIError, e:
            raise ConflictError("Username %s is already in use" % username)

        project = get_project(user, user, "SampleProject", create=True)
        project.install_template()
        config.c.stats.incr("users")
        return user

    @classmethod
    def find_user(cls, username, password=None):
        """Looks up a user by username. If password is provided, the password
        will be verified. Returns None if the user is not
        found or the password does not match."""
        user = _get_session().query(cls).filter_by(username=username).first()
        if user and password is not None:
            digest = User.generate_password(password)
            if str(user.password) != digest:
                user = None
        return user
        
    @classmethod
    def find_by_email(cls, email):
        """Looks up a user by email address."""
        users = _get_session().query(cls).filter_by(email=email).all()
        return users

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
        return "User[%s id=%s]" % (self.username, self.id)

    def check_save(self, amount):
        """Confirms that the user can save this amount. Returns True
        if the user has enough available in their quota, False otherwise.
        """
        return (self.quota * filesystem.QUOTA_UNITS - self.amount_used - amount) > 0

    def quota_info(self):
        """Returns the tuple of quota and amount_used"""
        return (self.quota * filesystem.QUOTA_UNITS, self.amount_used)

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

    def get_all_projects(self, include_shared=False):
        """Find all the projects that are accessible to the given user.
        See also user.projects, however this method also takes into account
        projects that have been shared by this users followees"""
        location = self.get_location()
        result = [Project(self, name.basename(), location / name)
                for name in location.dirs()
                if not name.basename().startswith(".")]
        result = sorted(result, key=lambda item: item.name)
        if include_shared:
            for followee_connection in self.users_i_follow():
                followee = followee_connection.followed
                for project in followee.projects:
                    if followee.is_project_shared(project, self):
                        result.append(project)
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
            additional = proj.scan_files()
            total += additional
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

    def get_settings(self):
        """Load a user's settings from BespinSettings/settings.
        Returns a dictionary."""
        location = self.get_location()
        settings_file = location / "BespinSettings" / "settings"
        if not settings_file.exists():
            return {}
        settings = {}
        for line in settings_file.lines(retain=False):
            info = line.split(" ", 1)
            if len(info) != 2:
                continue
            settings[info[0]] = info[1]
        return settings

    def find_member(self, member):
        """When a user refers to X, is this a reference to a user or a group or
        even the everyone setting"""
        if isinstance(member, User):
            return member
        if isinstance(member, Group):
            return member
        if isinstance(member, str):
            if member == 'everyone':
                return member
            else:
                group = self.get_group(member)
                if group != None:
                    return group
                else:
                    user = User.find_user(member)
                    if user != None:
                        return user
        raise BadValue("No groups or users found called '%s'" % (member))

    def users_i_follow(self):
        """Retrieve a list of the users that someone follows."""
        return _get_session().query(Connection).filter_by(following=self).all()

    def users_following_me(self):
        """Retrieve a list of the users that someone is following"""
        return _get_session().query(Connection).filter_by(followed=self).all()

    def follow(self, followed_user):
        """Add a follow connection between 2 users"""
        if (followed_user == self):
            raise ConflictError("You can't follow yourself")

        following_user_name = self.username;
        followed_user_name = followed_user.username;
        _get_session().add(Connection(followed=followed_user, following=self))
        try:
            _get_session().flush()
        except DBAPIError:
            _get_session().rollback()
            raise ConflictError("%s is already following %s" % (following_user_name, followed_user_name))

    def unfollow(self, followed_user):
        """Remove a follow connection between 2 users"""
        following_user_name = self.username;
        followed_user_name = followed_user.username;
        rows = _get_session().query(Connection) \
            .filter_by(followed=followed_user) \
            .filter_by(following=self) \
            .delete()
        if rows == 0:
            raise ConflictError("%s is not following %s" % (following_user_name, followed_user_name))

    def get_group(self, group_name, create_on_not_found=False, raise_on_not_found=False):
        """Check to see if the given member name represents a group"""
        match = _get_session().query(Group) \
            .filter_by(owner_id=self.id) \
            .filter_by(name=group_name) \
            .first()

        if match != None:
            return match

        if create_on_not_found:
            return self.add_group(group_name)
        elif raise_on_not_found:
            raise ConflictError("%s does not have a group called '%s'" % (self.username, group_name))
        else:
            return None

    def add_group(self, group_name):
        """Create (and return) a new group for the given user, with the given name"""
        group = Group(self, group_name)
        _get_session().add(group)
        _get_session().flush()
        return group

    def get_groups(self, with_member=None):
        """Retrieve a list of the groups created by a given user."""
        query = _get_session().query(Group).filter_by(owner_id=self.id)
        if with_member != None:
            query = query.filter(GroupMembership.user_id==with_member.id) \
                .filter(Group.id==GroupMembership.group_id)
        return query.all()

    def get_sharing(self, project=None, member=None):
        """Retrieve a list of the shares (at all levels) made by a given user,
        optionally filtered by project and by invited member"""
        if member == None:
            return self._get_user_sharing(project) + \
                   self._get_group_sharing(project) + \
                   self._get_everyone_sharing(project)
        else:
            if member == 'everyone':
                # The user and group shares are irrelevant if we're only looking
                # at everyone sharing
                return self._get_everyone_sharing(project)
            else:
                if isinstance(member, Group):
                    # The user shares are irrelevant if we're only looking at
                    # group level sharing
                    return self._get_group_sharing(project, member) + \
                           self._get_everyone_sharing(project)
                else:
                    return self._get_user_sharing(project, member) + \
                           self._get_group_sharing(project, member) + \
                           self._get_everyone_sharing(project)

    def _get_user_sharing(self, project=None, invited_user=None):
        """Retrieve a list of the user level shares made by a user, optionally
        filtered by project and by invited user"""
        query = _get_session().query(UserSharing).filter_by(owner_id=self.id)
        if project != None:
            query = query.filter_by(project_name=project.name)
        if invited_user != None:
            query = query.filter_by(invited_user_id=invited_user.id)
        return [self._create_share_record(self.username, 'user', sharing) for sharing in query.all()]

    def _get_group_sharing(self, project=None, invited_group=None):
        """Retrieve a list of the group level shares made by a user, optionally
        filtered by project and by invited group"""
        query = _get_session().query(GroupSharing).filter_by(owner_id=self.id)
        if project != None:
            query = query.filter_by(project_name=project.name)
        if invited_group != None:
            query = query.filter_by(invited_group_id=invited_group.id)
        return [self._create_share_record(self.username, 'group', sharing) for sharing in query.all()]

    def _get_everyone_sharing(self, project=None):
        """Retrieve a list of the public level shares made by a user, optionally
        filtered by project"""
        query = _get_session().query(EveryoneSharing).filter_by(owner_id=self.id)
        if project != None:
            query = query.filter_by(project_name=project.name)
        return [self._create_share_record(self.username, 'everyone', sharing) for sharing in query.all()]

    def _create_share_record(self, owner_name, type, sharing):
        """For internal use by the get_*_sharing methods"""
        return {
            'owner':owner_name,
            'project':sharing.project_name,
            'type':type,
            'recipient':sharing.invited_name,
            'edit':sharing.edit,
            'loadany':sharing.loadany
        }

    def is_project_shared(self, project, user):
        if self._is_project_everyone_shared(project):
            return True
        if self._is_project_user_shared(project, user):
            return True
        groups = self.get_groups(user)
        for group in groups:
            if self._is_project_group_shared(project, group):
                return True
        return False

    def _is_project_user_shared(self, project, user):
        if isinstance(project, Project):
            project = project.name
        match = _get_session().query(UserSharing) \
                .filter_by(owner_id=self.id) \
                .filter_by(project_name=project) \
                .filter_by(invited_user_id=user.id) \
                .first()
        return match != None

    def _is_project_group_shared(self, project, group):
        if isinstance(project, Project):
            project = project.name
        match = _get_session().query(GroupSharing) \
                .filter_by(owner_id=self.id) \
                .filter_by(project_name=project) \
                .filter_by(invited_group_id=group.id) \
                .first()
        return match != None

    def _is_project_everyone_shared(self, project):
        if isinstance(project, Project):
            project = project.name
        match = _get_session().query(EveryoneSharing) \
                .filter_by(owner_id=self.id) \
                .filter_by(project_name=project) \
                .first()
        return match != None

    def add_sharing(self, project, member, edit=False, loadany=False):
        if member == 'everyone':
            return self._add_everyone_sharing(project, edit, loadany)
        else:
            if isinstance(member, Group):
                return self._add_group_sharing(project, member, edit, loadany)
            else:
                return self._add_user_sharing(project, member, edit, loadany)

    def _add_user_sharing(self, project, invited_user, edit=False, loadany=False):
        sharing = UserSharing(self, project.name, invited_user, edit, loadany)
        _get_session().add(sharing)
        return sharing

    def _add_group_sharing(self, project, invited_group, edit=False, loadany=False):
        sharing = GroupSharing(self, project.name, invited_group, edit, loadany)
        _get_session().add(sharing)
        return sharing

    def _add_everyone_sharing(self, project, edit=False, loadany=False):
        sharing = EveryoneSharing(self, project.name, edit, loadany)
        _get_session().add(sharing)
        return sharing

    def remove_sharing(self, project, member=None):
        if member == None:
            rows = 0
            rows += self._remove_user_sharing(project)
            rows += self._remove_group_sharing(project)
            rows += self._remove_everyone_sharing(project)
            return rows
        else:
            if member == 'everyone':
                return self._remove_everyone_sharing(project)
            else:
                if isinstance(member, Group):
                    return self._remove_group_sharing(project, member)
                else:
                    return self._remove_user_sharing(project, member)

    def _remove_user_sharing(self, project, invited_user=None):
        user_query = _get_session().query(UserSharing).filter_by(owner_id=self.id)
        if project != None:
            user_query = user_query.filter_by(project_name=project.name)
        if invited_user != None:
            user_query = user_query.filter_by(invited_user_id=invited_user.id)
        return user_query.delete()

    def _remove_group_sharing(self, project, invited_group=None):
        group_query = _get_session().query(GroupSharing).filter_by(owner_id=self.id)
        if project != None:
            group_query = group_query.filter_by(project_name=project.name)
        if invited_group != None:
            group_query = group_query.filter_by(invited_group_id=invited_group.id)
        return group_query.delete()

    def _remove_everyone_sharing(self, project):
        everyone_query = _get_session().query(EveryoneSharing).filter_by(owner_id=self.id)
        if project != None:
            everyone_query = everyone_query.filter_by(project_name=project.name)
        return everyone_query.delete()

    def get_viewme(self, member=None):
        return [ "Not implemented", member ]

    def set_viewme(self, member, value):
        return [ "Not implemented", member, value ]

    def publish(self, message_obj):
        data = simplejson.dumps(message_obj)
        message = Message(user=self, message=data)
        self.messages.append(message)
        print(message)

    def pop_messages(self):
        messages = []
        for message in self.messages:
            messages.append(message.message)
            _get_session().delete(message)
        return messages

class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey('users.id', ondelete='cascade'))
    name = Column(String(128))
    owner_viewable = Column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("owner_id", "name"), {})

    def __init__(self, owner, name, owner_viewable=False):
        self.owner_id = owner.id
        self.name = name
        self.owner_viewable = owner_viewable

    def __str__(self):
        return "Group[%s id=%s owner_id=%s]" % (self.name, self.id, self.owner_id)

    def remove(self):
        """Remove a group (and all its members) from the owning users profile"""
        return _get_session().query(Group). \
            filter_by(id=self.id). \
            delete()

    def get_members(self):
        """Retrieve a list of the members of a given users group"""
        return _get_session().query(GroupMembership) \
            .filter_by(group_id=self.id) \
            .all()

    def add_member(self, other_user):
        """Add a member to a given users group."""
        if self.owner_id == other_user.id:
            raise ConflictError("You can't be a member of your own group")
        membership = GroupMembership(self, other_user)
        _get_session().add(membership)
        return membership

    def remove_member(self, other_user):
        """Remove a member from a given users group."""
        return _get_session().query(GroupMembership) \
            .filter_by(group_id=self.id) \
            .filter_by(user_id=other_user.id) \
            .delete()

    def remove_all_members(self):
        """Remove all the members of a given group"""
        return _get_session().query(GroupMembership) \
            .filter_by(group_id=self.id) \
            .delete()

class GroupMembership(Base):
    __tablename__ = "group_memberships"

    group_id = Column(Integer, ForeignKey('groups.id', ondelete='cascade'), primary_key=True)
    group = relation(Group, primaryjoin=Group.id==group_id)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='cascade'), primary_key=True)
    user = relation(User, primaryjoin=User.id==user_id)

    def __init__(self, group, user):
        if group.id == None:
            raise BadValue("Null group.id for " + group.name)
        self.group_id = group.id
        self.user_id = user.id

    def __str__(self):
        return "GroupMembership[group_id=%s, user_id=%s]" % (self.group_id, self.user_id)

class UserSharing(Base):
    __tablename__ = "user_sharing"

    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey('users.id', ondelete='cascade'))
    project_name = Column(String(128))
    invited_user_id = Column(Integer, ForeignKey('users.id', ondelete='cascade'))
    invited = relation(User, primaryjoin=User.id==invited_user_id)
    edit = Column(Boolean, default=False)
    loadany = Column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("owner_id", "project_name", "invited_user_id"), {})

    def __init__(self, owner, project_name, user, edit, loadany):
        self.owner_id = owner.id
        self.project_name = project_name
        self.invited_user_id = user.id
        #self.invited = user
        self.edit = edit
        self.loadany = loadany

    @property
    def invited_name(self):
        return self.invited.username

class GroupSharing(Base):
    __tablename__ = "group_sharing"

    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey('users.id', ondelete='cascade'))
    project_name = Column(String(128))
    invited_group_id = Column(Integer, ForeignKey('groups.id', ondelete='cascade'))
    invited = relation(Group, primaryjoin=Group.id==invited_group_id)
    edit = Column(Boolean, default=False)
    loadany = Column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("owner_id", "project_name", "invited_group_id"), {})

    def __init__(self, owner, project_name, group, edit, loadany):
        self.owner_id = owner.id
        self.project_name = project_name
        self.invited_group_id = group.id
        #self.invited = group
        self.edit = edit
        self.loadany = loadany

    @property
    def invited_name(self):
        return self.invited.name

class EveryoneSharing(Base):
    __tablename__ = "everyone_sharing"

    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey('users.id', ondelete='cascade'))
    project_name = Column(String(128))
    edit = Column(Boolean, default=False)
    loadany = Column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("owner_id", "project_name"), {})

    def __init__(self, owner, project_name, edit, loadany):
        self.owner_id = owner.id
        self.project_name = project_name
        self.edit = edit
        self.loadany = loadany

    @property
    def invited_name(self):
        return 'everyone'
