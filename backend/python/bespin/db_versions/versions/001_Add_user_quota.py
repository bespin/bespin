from sqlalchemy import *
from migrate import *
from migrate.changeset import *

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relation, deferred, mapper, backref

Base = declarative_base()
Base.metadata.bind = migrate_engine

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    username = Column(String(20), unique=True)
    email = Column(String(128))
    password = Column(String(20))
    settings = Column(PickleType())
    private_project = Column(String(50))
    projects = relation('Project', backref='owner')

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)
    name = Column(String(60), unique=True)
    user_id = Column(Integer, ForeignKey('users.id'))

class File(Base):
    __tablename__ = "files"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(700), unique=True)
    saved_size = Column(Integer)
    data = deferred(Column(Binary))
    edits = deferred(Column(PickleType))
    dir_id = Column(Integer, ForeignKey('directories.id'))
    dir = relation('Directory', backref="files")


quota = Column('quota', Integer, default=10)
amount_used = Column('amount_used', Integer, default=0)

user_table = User.__table__
utc = user_table.c
file_table = File.__table__
ftc = file_table.c
project_table = Project.__table__
ptc = project_table.c

def upgrade():
    # Upgrade operations go here. Don't create your own engine; use the engine
    # named 'migrate_engine' imported from migrate.
    quota.create(user_table)
    amount_used.create(user_table)
    user_table.update().execute(quota=15)
    query = select([utc.id, func.sum(ftc.saved_size)])
    query = query.where(ptc.user_id==utc.id)
    query = query.where("files.name like projects.name || '/%'")
    query = query.group_by(utc.id)
    result = query.execute()
    for row in list(result):
        query = user_table.update().where(utc.id==row[0])
        query.execute(amount_used=row[1])
    

def downgrade():
    # Operations to reverse the above upgrade go here.
    # sqlite doesn't support this operation, sorry!
    quota.drop(user_table)
    amount_used.drop(user_table)
