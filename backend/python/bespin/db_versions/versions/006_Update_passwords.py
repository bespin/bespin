from hashlib import sha256

from sqlalchemy import *
from sqlalchemy.ext.declarative import declarative_base
from migrate import *

from bespin.config import c

metadata = MetaData()
metadata.bind = migrate_engine
Base = declarative_base(metadata=metadata)

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

pwinfo = dict()

def upgrade():
    # Upgrade operations go here. Don't create your own engine; use the engine
    # named 'migrate_engine' imported from migrate.
    user_table = User.__table__
    pwbackup = open("pwbackup", "w")
    for row in select([user_table.c.username, user_table.c.password]).execute():
        pwbackup.write("%s %s\n" % (row.username, row.password))
        pwinfo[row.username] = row.password
    pwbackup.close()
    
    conn2 = migrate_engine.connect()
    if migrate_engine.name == "sqlite":
        conn2.execute("""
CREATE TABLE users_temp (
	id INTEGER NOT NULL, 
	uuid VARCHAR(36), 
	username VARCHAR(128), 
	email VARCHAR(128), 
	password VARCHAR(64), 
	settings BLOB, 
	quota INTEGER, 
	amount_used INTEGER, 
	file_location VARCHAR(200), 
	everyone_viewable BOOLEAN, 
	PRIMARY KEY (id), 
	 UNIQUE (uuid), 
	 UNIQUE (username)
);
""")
        conn2.execute("""INSERT INTO users_temp (id, uuid, username, 
email, password, settings, quota, amount_used, file_location, 
everyone_viewable) SELECT id, uuid, username, 
email, password, settings, quota, amount_used, file_location, 
everyone_viewable FROM users;""")
        conn2.execute("""DROP TABLE USERS;""")
        conn2.execute("""ALTER TABLE users_temp RENAME TO users;""")
    else:
        conn2.execute("""ALTER TABLE users 
    CHANGE password password VARCHAR(64)""")
    
    count = 0
    for username, password in pwinfo.items():
        password_hash = sha256()
        password_hash.update(c.pw_secret + password)
        
        update(user_table).where(user_table.c.username==username).execute(password=password_hash.hexdigest())
        count += 1
        if count % 500 == 0:
            print count

def downgrade():
    # Operations to reverse the above upgrade go here.
    user_table = User.__table__
    conn2 = migrate_engine.connect()
    if migrate_engine.name == "sqlite":
        conn2.execute("""
CREATE TABLE users_temp (
	id INTEGER NOT NULL, 
	uuid VARCHAR(36), 
	username VARCHAR(128), 
	email VARCHAR(128), 
	password VARCHAR(32), 
	settings BLOB, 
	quota INTEGER, 
	amount_used INTEGER, 
	file_location VARCHAR(200), 
	everyone_viewable BOOLEAN, 
	PRIMARY KEY (id), 
	 UNIQUE (uuid), 
	 UNIQUE (username)
);
""")
        conn2.execute("""INSERT INTO users_temp (id, uuid, username, 
email, password, settings, quota, amount_used, file_location, 
everyone_viewable) SELECT id, uuid, username, 
email, password, settings, quota, amount_used, file_location, 
everyone_viewable FROM users;""")
        conn2.execute("""DROP TABLE USERS;""")
        conn2.execute("""ALTER TABLE users_temp RENAME TO users;""")
    else:
        conn2.execute("""ALTER TABLE users 
    CHANGE password password VARCHAR(32)""")
    count = 0
    for username, password in pwinfo.items():
        update(user_table).where(user_table.c.username==username).execute(password=password)
        count += 1
        if count % 500 == 0:
            print count
    