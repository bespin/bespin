"""Manages the interaction with version control systems. UVC is responsible
for handling the main interaction. This code manages the keychain which
contains a user's credentials for the remote side of a VCS.

The PyCrypto code used to encrypt the keychain is based on the example
from here:

http://www.codekoala.com/blog/2009/mar/16/aes-encryption-python-using-pycrypto/
"""
import os
import tempfile
import random

from path import path
import simplejson
from uvc import main
from uvc.main import is_new_project_command
from Crypto.Cipher import AES

from bespin import model, config

# remote repository requires authentication for read and write
AUTH_BOTH = "both"

# remote repository requires authentication only for writing
AUTH_WRITE = "write"

# project property used to save the authentication type for a project
AUTH_PROPERTY = "remote_auth"

# the block size for the cipher object; must be 16, 24, or 32 for AES
BLOCK_SIZE = 32

# the character used for padding--with a block cipher such as AES, the value
# you encrypt must be a multiple of BLOCK_SIZE in length.  This character is
# used to ensure that your value is always a multiple of BLOCK_SIZE
PADDING = '{'

# one-liner to sufficiently pad the text to be encrypted
pad = lambda s: s + (BLOCK_SIZE - len(s) % BLOCK_SIZE) * PADDING

# one-liners to encrypt/encode and decrypt/decode a string
# encrypt with AES, encode with base64
EncodeAES = lambda c, s: c.encrypt(pad(s)).encode("base64")
DecodeAES = lambda c, e: c.decrypt(e.decode("base64")).rstrip(PADDING)

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
        self.password = pad(password[:31])
        self._kcdata = None
    
    def get_ssh_key(self):
        """Returns the SSH public key for this key chain. If necessary,
        this function will generate a new key pair."""
        kcdata = self.kcdata
        if "ssh" in kcdata:
            return kcdata['ssh']['public']
        
        tdir = tempfile.mkdtemp()
        try:
            filename = str(random.randint(10, 20000000))
            destfile = path(tdir) / filename
            os.system("ssh-keygen -N '' -f %s > /dev/null" % (destfile))
            private_key = destfile.bytes()
            pubkeyfile = destfile + ".pub"
            pubkey = pubkeyfile.bytes()
        finally:
            path(tdir).rmtree()
        
        kcdata['ssh'] = dict(public=pubkey, private=private_key)
        return pubkey
    
    @property
    def kcdata(self):
        """Return the data object representing the keychain data."""
        if self._kcdata is None:
            kcfile = self.kcfile
            if not kcfile.exists():
                self._kcdata = {}
            else:
                text = kcfile.bytes()
                
                # create a cipher object using the random secret
                cipher = AES.new(self.password)
                text = DecodeAES(cipher, text)
                
                self._kcdata = simplejson.loads(text)
        return self._kcdata
    
    @property
    def kcfile(self):
        """Return path object pointing to the keychain file on disk"""
        return path(self.user.get_location()) / ".bespin-keychain"
        
    def _save(self):
        """Saves the new state of the keychain to the keychain file."""
        # the keychain data has not even been loaded, so we can move on.
        if self._kcdata is None:
            return
        newdata = simplejson.dumps(self.kcdata)
        
        # create a cipher object using the random secret
        cipher = AES.new(self.password)
        newdata = EncodeAES(cipher, newdata)
        
        self.kcfile.write_bytes(newdata)
        
    def set_ssh_for_project(self, project, remote_auth):
        """Stores that the SSH key in this keychain
        should be used as the credentials for the project
        given. If there is no SSH key, one will be
        generated. The SSH public key will be
        returned. remote_auth should be one of vcs.AUTH_BOTH
        when authentication is required for read and write
        and vcs.AUTH_WRITE when authentication is only
        required for writing to the remote repository."""
        kcdata = self.kcdata
        pubkey = self.get_ssh_key()
        projects = kcdata.setdefault("projects", {})
        projects[project.full_name] = dict(type="ssh")
        
        self._save()
        metadata = project.metadata
        metadata[AUTH_PROPERTY] = remote_auth
        metadata.close()
        return pubkey
    
    def set_credentials_for_project(self, project, remote_auth, username, 
                                    password):
        """Sets up username/password authentication for the
        given project."""
        kcdata = self.kcdata
        projects = kcdata.setdefault("projects", {})
        projects[project.full_name] = dict(type="password",
            username=username, password=password)
            
        self._save()
        metadata = project.metadata
        metadata[AUTH_PROPERTY] = remote_auth
        metadata.close()
        
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
                value['ssh_private_key'] = kcdata['ssh']['private']
        
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
        
        self._save()
        metadata = project.metadata
        del metadata[AUTH_PROPERTY]
        metadata.close()

        