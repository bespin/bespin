from datetime import datetime

from sqlalchemy import *
from migrate import *

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import (Column, PickleType, String, Integer,
                    Boolean, Binary, Table, ForeignKey,
                    DateTime, func, UniqueConstraint, Text)
from sqlalchemy.orm import relation, deferred, mapper, backref
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm.exc import NoResultFound

metadata = MetaData()
metadata.bind = migrate_engine
Base = declarative_base(metadata=metadata)

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
    messages = relation(Message, order_by=Message.when, backref="user")
    
    i_follow = relation(Connection,
                        primaryjoin=Connection.following_id==id,
                        secondary=Connection.__table__,
                        secondaryjoin=id==Connection.followed_id)

    following_me = relation(Connection,
                            primaryjoin=Connection.followed_id==id,
                            secondary=Connection.__table__,
                            secondaryjoin=id==Connection.following_id)

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
    invited_name = relation(User, primaryjoin=User.id==invited_user_id)
    edit = Column(Boolean, default=False)
    loadany = Column(Boolean, default=False)    

    __table_args__ = (UniqueConstraint("owner_id", "project_name", "invited_user_id"), {})

class GroupSharing(Base):
    __tablename__ = "group_sharing"

    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey('users.id', ondelete='cascade'))
    project_name = Column(String(128))
    invited_group_id = Column(Integer, ForeignKey('groups.id', ondelete='cascade'))
    invited_name = relation(Group, primaryjoin=Group.id==invited_group_id)
    edit = Column(Boolean, default=False)
    loadany = Column(Boolean, default=False)    

    __table_args__ = (UniqueConstraint("owner_id", "project_name", "invited_group_id"), {})


def upgrade():
    # Upgrade operations go here. Don't create your own engine; use the engine
    # named 'migrate_engine' imported from migrate.
    
    # create_all will check for table existence first
    metadata.create_all()
    

def downgrade():
    # Operations to reverse the above upgrade go here.
    
    Message.__table__.drop(bind=migrate_engine)
    Connection.__table__.drop(bind=migrate_engine)
    GroupMembership.__table__.drop(bind=migrate_engine)
    GroupSharing.__table__.drop(bind=migrate_engine)
    Group.__table__.drop(bind=migrate_engine)
    UserSharing.__table__.drop(bind=migrate_engine)
    