import uuid
import re
from pprint import pprint

from sqlalchemy import *
from migrate import *
from path import path

from bespin.config import c

metadata = MetaData()
metadata.bind = migrate_engine
metadata.reflect()

files_table = metadata.tables['files']
users_table = metadata.tables['users']
projects_table = metadata.tables['projects']

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

    def save(self, contents):
        file_obj = self.location.write_bytes(contents)

class Project(object):
    """Provides access to the files in a project."""
    
    def __init__(self, name, location):
        self.name = name
        self.location = location

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
        file.save(contents)
        return file

def upgrade():
    # Upgrade operations go here. Don't create your own engine; use the engine
    # named 'migrate_engine' imported from migrate.
    conn2 = migrate_engine.connect()
    conn2.execute("""ALTER TABLE users
ADD COLUMN uuid VARCHAR(36) UNIQUE,
ADD COLUMN file_location VARCHAR(200),
ADD COLUMN everyone_viewable TINYINT(1) DEFAULT NULL
""")
    data = users_table.select().execute()
    conn3 = migrate_engine.connect()
    conn4 = migrate_engine.connect()
    total = 0
    invalid = 0
    invalids = dict()
    files_written = 0
    for user in data:
        total += 1
        username = user.username
        
        user_uuid = str(uuid.uuid4())
        user_location = user_uuid
        user_location = path("/".join(user_location[:4]) + "/" + user_location)
        # normally, we'd want to ensure that we use a prepared statement.
        # in this case, it's fine to just substitute in strings, because we
        # know exactly what these values look like
        conn2.execute("""UPDATE users SET uuid='%s', file_location='%s', username='%s' WHERE id=%s""" % (user_uuid, user_location, username, user.id))
        
        projects = projects_table.select().where(projects_table.c.user_id==user.id).execute(bind=conn2)
        for project in projects:
            projectname = project.name
            if projectname.startswith("SampleProjectFor:"):
                projectname = "SampleProject"
            else:
                projectname = projectname
            
            project_location = path(c.fsroot) / user_location / projectname
            project_obj = Project(projectname, project_location)
            
            files = files_table.select().where(files_table.c.project_id==project.id).execute(bind=conn3)
            for file in files:
                # filter out a weird case where there's a file that has
                # no name but has data
                content = str(file.data)
                if not file.name or (file.name.endswith('/') and len(content) > 0) \
                    or file.name.endswith('yourcommands.js/yourcommands.js') \
                    or file.name.endswith("README/README"):
                    continue
                project_obj.save_file(file.name, content)
                files_written += 1
                if not files_written % 500:
                    print "Files written:", files_written
        
    pprint(invalids)
    print "Users: Total:", total, " Invalid:", invalid
    
    data = select([func.count(files_table.c.id)]).execute()
    print "Number of files:", list(data)

def downgrade():
    # Operations to reverse the above upgrade go here.
    conn = migrate_engine.connect()
    conn.execute("""ALTER TABLE USERS
DROP COLUMN uuid,
DROP COLUMN file_location,
DROP COLUMN everyone_viewable""")
    
