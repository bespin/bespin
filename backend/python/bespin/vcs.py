from path import path
import simplejson
from uvc import main
from uvc.main import is_new_project_command

def clone(user, args):
    """Clones or checks out the repository using the command provided."""
    working_dir = user.get_location()
    context = main.SecureContext(working_dir)
    command = main.convert(context, args)
    output = main.run_command(command, context)
    return str(output)
    
def run_command(user, project, args):
    working_dir = project.location
    
    context = main.SecureContext(working_dir)
    
    if args and args[0] in main.dialects:
        dialect = None
    elif not is_new_project_command(args):
        dialect = main.infer_dialect(working_dir)
    else:
        dialect = None
        
    command = main.convert(context, args, dialect)
    output = main.run_command(command, context)
    return str(output)
    
class KeyChain(object):
    """The KeyChain holds the user's credentials for remote
    repositories. These credentials are stored in an encrypted
    file (the file is encrypted with the password provided)."""
    
    def __init__(self, user, password):
        self.user = user
        self.password = password
        self._kcdata = None
    
    def add_ssh_identity(self, name, key):
        """Adds the provided SSH key to the keychain, identifying it
        with the name provided."""
        kcdata = self.kcdata
        ssh_keys = kcdata.setdefault("ssh_keys", {})
        ssh_keys[name] = key
    
    def delete_ssh_key(self, ssh_key_name):
        """Removes the key named ssh_key_name from this keychain.
        This will also remove the credentials information for
        any project that was using this key."""
        kcdata = self.kcdata
        ssh_keys = kcdata.setdefault("ssh_keys", {})
        try:
            del ssh_keys[ssh_key_name]
        except KeyError:
            pass
        
        projects = kcdata.setdefault("projects", {})
        print "projects: ", projects
        for pname, project in list(projects.items()):
            if project['type'] == 'ssh' and \
                project['ssh_key'] == ssh_key_name:
                del projects[pname]

    @property
    def ssh_key_names(self):
        """The names given to the SSH keys stored in the keychain"""
        kcdata = self.kcdata
        ssh_keys = kcdata.setdefault("ssh_keys", {})
        return sorted(ssh_keys.keys())
    
    @property
    def kcdata(self):
        """Return the data object representing the keychain data."""
        if self._kcdata is None:
            kcfile = self.kcfile
            if not kcfile.exists():
                self._kcdata = {}
            else:
                text = kcfile.bytes()
                text = text.decode("base64")
                self._kcdata = simplejson.loads(text)
        return self._kcdata
    
    @property
    def kcfile(self):
        """Return path object pointing to the keychain file on disk"""
        return path(self.user.get_location()) / ".bespin-keychain"
        
    def save(self):
        """Saves the new state of the keychain to the keychain file."""
        # the keychain data has not even been loaded, so we can move on.
        if self._kcdata is None:
            return
        newdata = simplejson.dumps(self.kcdata)
        newdata = newdata.encode("base64")
        self.kcfile.write_bytes(newdata)
        
    def set_ssh_for_project(self, project, ssh_key_name):
        """Stores that the SSH key provided by ssh_key_name
        should be used as the credentials for the project
        given."""
        kcdata = self.kcdata
        projects = kcdata.setdefault("projects", {})
        projects[project.full_name] = dict(type="ssh", ssh_key=ssh_key_name)
    
    def set_credentials_for_project(self, project, username, password):
        """Sets up username/password authentication for the
        given project."""
        kcdata = self.kcdata
        projects = kcdata.setdefault("projects", {})
        projects[project.full_name] = dict(type="password",
            username=username, password=password)
        
    def get_credentials_for_project(self, project):
        """Returns a dictionary with the user's information for
        the given project. The dictionary will have 'type'
        with values 'ssh', or 'password'. If the type is ssh,
        there will be an ssh_key entry. If the type is password,
        there will be username and password entries. If there
        are no credentials stored for the given project,
        None is returned."""
        kcdata = self.kcdata
        projects = kcdata.setdefault("projects", {})
        
        value = projects.get(project.full_name)
        
        if value is not None:
            # we're going to make a copy of the data so that it
            # doesn't get mutated against our wishes
            value = dict(value)
        
            # for SSH, we need to change the SSH key name into the key itself.
            if value['type'] == "ssh":
                ssh_keys = kcdata['ssh_keys']
                value['ssh_key'] = ssh_keys[value['ssh_key']]
        
        return value
    
    def delete_credentials_for_project(self, project):
        """Forget the authentication information provided
        for the given project. Note that this will not
        remove any SSH keys used by the project."""
        kcdata = self.kcdata
        projects = kcdata.setdefault("projects", {})
        try:
            del projects[project.full_name]
        except KeyError:
            pass
        