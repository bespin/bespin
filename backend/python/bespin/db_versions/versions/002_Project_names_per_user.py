from datetime import datetime

from sqlalchemy import *
from migrate import *

from migrate.changeset import *

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relation, deferred, mapper, backref

Base = declarative_base()
Base.metadata.bind = migrate_engine
migrate_engine.echo = True

class File(Base):
    __tablename__ = "files"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(700), nullable=False)
    created = Column(DateTime, default=datetime.now)
    modified = Column(DateTime, onupdate=datetime.now)
    saved_size = Column(Integer)
    data = deferred(Column(Binary))
    edits = deferred(Column(PickleType))
    dir_id = Column(Integer, ForeignKey('directories.id'))
    dir = relation('Directory', backref="files")
    
class Directory(Base):
    __tablename__ = "directories"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(700), nullable=False)
    parent_id = Column(Integer, ForeignKey('directories.id'))
    subdirs = relation('Directory', backref=backref("parent", 
                                        remote_side=[id]))
    
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(60), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    

file_table = File.__table__
directory_table = Directory.__table__
project_table = Project.__table__


def upgrade():
    # Upgrade operations go here. Don't create your own engine; use the engine
    # named 'migrate_engine' imported from migrate.
    if migrate_engine.name == "sqlite":
        import sys
        print "sqlite development databases are not supported by this migration"
        print "In other words, you need to recreate your development database."
        print "Sorry! To create your database, run"
        print "bin/paver create_db"
        sys.exit(1)
    
    file_project_id = Column('project_id', Integer, ForeignKey('projects.id', ondelete='cascade'))
    directory_project_id = Column('project_id', Integer, ForeignKey('projects.id', ondelete='cascade'))
    
    file_project_id.create(file_table)
    directory_project_id.create(directory_table)
    conn = migrate_engine.connect()
    conn.execute("ALTER TABLE files DROP INDEX name")
    conn.execute("ALTER TABLE directories DROP INDEX name")
    conn.execute("ALTER TABLE projects DROP INDEX name")
    conn.execute("ALTER TABLE files DROP FOREIGN KEY files_ibfk_1")
    conn.execute("""ALTER TABLE files
        ADD CONSTRAINT files_ibfk_1
        FOREIGN KEY (dir_id)
        REFERENCES directories(id)
        ON DELETE CASCADE
    """)
    conn.execute("ALTER TABLE directories DROP FOREIGN KEY directories_ibfk_1")
    conn.execute("""ALTER TABLE directories
        ADD CONSTRAINT directories_ibfk_1
        FOREIGN KEY (parent_id)
        REFERENCES directories(id)
        ON DELETE CASCADE
    """)
    conn.execute("ALTER TABLE filestatus DROP FOREIGN KEY filestatus_ibfk_1")
    conn.execute("""ALTER TABLE filestatus
        ADD CONSTRAINT filestatus_ibfk_1
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    """)
    conn.execute("ALTER TABLE filestatus DROP FOREIGN KEY filestatus_ibfk_2")
    conn.execute("""ALTER TABLE filestatus
        ADD CONSTRAINT filestatus_ibfk_2
        FOREIGN KEY (file_id)
        REFERENCES files(id)
        ON DELETE CASCADE
    """)
    conn.execute("ALTER TABLE members DROP FOREIGN KEY members_ibfk_1")
    conn.execute("""ALTER TABLE members
        ADD CONSTRAINT members_ibfk_1
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE
    """)
    conn.execute("ALTER TABLE members DROP FOREIGN KEY members_ibfk_2")
    conn.execute("""ALTER TABLE members
        ADD CONSTRAINT members_ibfk_2
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    """)
    conn.execute("DELETE FROM projects WHERE user_id IS NULL OR user_id=0")
    
    migrate_engine.echo = False
    transaction = conn.begin()
    result = select([func.count(file_table.c.id)]).execute().fetchall()
    num_files = result[0][0]
    try:
        current_project_name = None
        current_project_id = None
        delete_these = set()
        counter = 0
        for file_obj in select([file_table.c.id,
                file_table.c.name]).order_by(file_table.c.name).execute():
            counter += 1
            if counter % 500 == 0:
                print "%s out of %s (%5.2f%%)" % (counter, num_files,
                    float(counter)*100/num_files)
            project_name, path = file_obj.name.split('/', 1)
            
            if project_name != current_project_name:
                current_project_name = project_name
                result = select([project_table.c.id]) \
                    .where(project_table.c.name==project_name).execute()
                try:
                    result = iter(result).next()
                    current_project_id = result.id
                except StopIteration:
                    print "Project %s is bogus" % (project_name)
                    current_project_id = None
            if current_project_id is None:
                delete_these.add(file_obj.id)
                continue
            query = file_table.update().where(file_table.c.id==file_obj.id) \
                .values(project_id=current_project_id, name=path).execute()
    
        print "Deleting %s bad files" % (len(delete_these))
        for id in delete_these:
            file_table.delete().where(file_table.c.id==id).execute()
    
        current_project_name = None
        current_project_id = None
        delete_these = set()
        result = select([func.count(directory_table.c.id)]).execute().fetchall()
        num_dirs = result[0][0]
        counter = 0
        for dir_obj in select([directory_table.c.id,
                directory_table.c.name]).order_by(directory_table.c.name).execute():
            counter += 1
            if counter % 500 == 0:
                print "%s out of %s (%5.2f%%)" % (counter, num_dirs,
                    float(counter)*100/num_dirs)
            project_name, dir_name = dir_obj.name.split('/', 1)
            if project_name != current_project_name:
                current_project_name = project_name
                result = select([project_table.c.id]) \
                    .where(project_table.c.name==project_name).execute()
                try:
                    result = iter(result).next()
                    current_project_id = result.id
                except StopIteration:
                    print "Project %s is bogus" % (project_name)
                    current_project_id = None
            if current_project_id is None:
                delete_these.add(dir_obj.id)
                continue
            query = directory_table.update().where(directory_table.c.id==dir_obj.id) \
                .values(project_id=current_project_id, name=dir_name).execute()

        print "Deleting %s bad directories" % (len(delete_these))
        for id in delete_these:
            directory_table.update().where(directory_table.c.parent_id==id) \
                .values(parent_id=None).execute()
            directory_table.delete().where(directory_table.c.id==id).execute()
        transaction.commit()
    except:
        transaction.rollback()
        raise
        
    migrate_engine.echo = True
    conn.execute("""ALTER TABLE projects DROP FOREIGN KEY projects_ibfk_1""")
    conn.execute("""ALTER TABLE projects
        ADD CONSTRAINT projects_ibfk_1
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    """)
    conn.execute("""ALTER TABLE projects ADD INDEX name (name)""")
    conn.execute("""UPDATE projects, users SET projects.name='BespinSettings'
        WHERE projects.name=users.private_project""")
    conn.execute("ALTER TABLE users DROP COLUMN private_project")
    conn.execute("""ALTER TABLE files 
            CHANGE name name VARCHAR(700) NOT NULL,
            CHANGE project_id project_id INTEGER NOT NULL,
            ADD UNIQUE (project_id, name)""")
    conn.execute("""ALTER TABLE directories
            CHANGE name name VARCHAR(700) NOT NULL,
            CHANGE project_id project_id INTEGER NOT NULL,
            ADD UNIQUE (project_id, name)""")
    conn.execute("""ALTER TABLE projects
            CHANGE name name VARCHAR(60) NOT NULL,
            CHANGE user_id user_id INTEGER NOT NULL,
            ADD UNIQUE (user_id, name)""")

def downgrade():
    # Operations to reverse the above upgrade go here.
    print "Downgrade is not available for this one. Sorry!"
