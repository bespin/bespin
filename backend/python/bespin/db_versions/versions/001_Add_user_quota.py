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

quota = Column('quota', Integer, default=10)
amount_used = Column('amount_used', Integer, default=0)

user_table = User.__table__

def upgrade():
    # Upgrade operations go here. Don't create your own engine; use the engine
    # named 'migrate_engine' imported from migrate.
    quota.create(user_table)
    amount_used.create(user_table)

def downgrade():
    # Operations to reverse the above upgrade go here.
    # sqlite doesn't support this operation, sorry!
    quota.drop(user_table)
    amount_used.drop(user_table)
