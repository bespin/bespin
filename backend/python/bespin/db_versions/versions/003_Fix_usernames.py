import re
import sys

from sqlalchemy import *
from migrate import *

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relation, deferred, mapper, backref

Base = declarative_base()
Base.metadata.bind = migrate_engine

bad_characters = "<>| '\""
invalid_chars = re.compile(r'[%s]' % bad_characters)

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    username = Column(String(128), unique=True)
    email = Column(String(128))
    password = Column(String(20))
    settings = Column(PickleType())
    projects = relation('Project', backref='owner')
    quota = Column(Integer, default=10)
    amount_used = Column(Integer, default=0)

usertable = User.__table__

changed_names = dict()

def check_name(new_name):
    result = select([func.count('*')]).where(usertable.c.username==new_name).execute()
    row = result.fetchone()
    return row[0]

def upgrade():
    # Upgrade operations go here. Don't create your own engine; use the engine
    # named 'migrate_engine' imported from migrate.
    for row in select([usertable.c.username]).execute():
        name = row.username
        if invalid_chars.search(name):
            changed_names[name] = invalid_chars.sub("", name)
    for old_name, new_name in changed_names.items():
        if check_name(new_name):
            print "%s is in use for %s" % (new_name, old_name)
            new_name = invalid_chars.sub("-", old_name)
            changed_names[old_name] = new_name
            if check_name(new_name):
                print "EVEN WORSE: %s is in use for %s also" % (new_name, old_name)
                print "Can't continue"
                sys.exit(1)
    for old_name, new_name in changed_names.items():
        update(usertable).where(usertable.c.username==old_name).execute(username=new_name)
    

def downgrade():
    for old_name, new_name in changed_names.items():
        update(usertable).where(usertable.c.username==new_name).execute(username=old_name)
