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
from traceback import format_exc
import logging

from path import path
import simplejson
from uvc import main
from uvc.main import is_new_project_command
from Crypto.Cipher import AES

from bespin import config, queue, database, filesystem
from bespin.database import User, Message
from bespin.filesystem import FSException, NotAuthorized, get_project

log = logging.getLogger("bespin.vcs")

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

def _get_vcs_user(user, project):
    metadata = project.metadata
    vcsuser = metadata.get("vcsuser")
    if vcsuser:
        return vcsuser
        
    settings = user.get_settings()
    vcsuser = settings.get("vcsuser")
    if vcsuser:
        return vcsuser
    return user.username

def clone(user, source, dest=None, push=None, remoteauth="write",
            authtype=None, username=None, password=None, kcpass="",
            vcs="hg"):
    """Clones or checks out the repository using the command provided."""
    user = user.username
    job_body = dict(user=user, source=source, dest=dest, push=push, 
        remoteauth=remoteauth,
        authtype=authtype, username=username, password=password,
        kcpass=kcpass, vcs=vcs)
    return queue.enqueue("vcs", job_body, execute="bespin.vcs:clone_run",
                        error_handler="bespin.vcs:vcs_error",
                        use_db=True)

def vcs_error(qi, e):
    """Handles exceptions that come up during VCS operations.
    A message is added to the user's message queue."""
    log.debug("Handling VCS error: %s", e)
    s = database._get_session()
    user = qi.message['user']
    # if the user hadn't already been looked up, go ahead and pull
    # them out of the database
    if isinstance(user, basestring):
        user = User.find_user(user)
    else:
        s.add(user)
    
    # if we didn't find the user in the database, there's not much
    # we can do.
    if user:
        if isinstance(e, (FSException, main.UVCError)):
            # for exceptions that are our types, just display the
            # error message
            tb = str(e)
        else:
            # otherwise, it looks like a programming error and we
            # want more information
            tb = format_exc()
        message = dict(jobid=qi.id, output=tb, error=True)
        message['asyncDone'] = True
        retval = Message(user_id=user.id, message=simplejson.dumps(message))
        s.add(retval)

def clone_run(qi):
    """Runs the queued up clone job."""
    message = qi.message
    s = database._get_session()
    user = User.find_user(message['user'])
    message['user'] = user
    result = _clone_impl(**message)
    result.update(dict(jobid=qi.id, asyncDone=True))
    retvalue = Message(user_id=user.id, message=simplejson.dumps(result))
    s.add(retvalue)
    config.c.stats.incr('vcs_DATE')

def _clone_impl(user, source, dest=None, push=None, remoteauth="write",
            authtype=None, username=None, password=None, kcpass="",
            vcs="hg"):
    working_dir = user.get_location()
    
    args = ["clone", source]
    if dest:
        args.append(dest)
    auth = {}
    if username:
        auth['username'] = username
    if password:
        auth['password'] = password

    keychain = KeyChain(user, kcpass)
    keyfile = None
    
    if vcs:
        dialect = main.get_dialect(vcs)
    else:
        dialect = None
    
    if authtype:
        auth['type'] = authtype
        if authtype == "ssh":
            public_key, private_key = keychain.get_ssh_key()
            keyfile = TempSSHKeyFile()
            keyfile.store(public_key, private_key)
            auth['key'] = keyfile.filename

    try:
        context = main.SecureContext(working_dir, auth)
        command = main.convert(context, args, dialect)

        output = main.run_command(command, context)
        log.debug(output)
    finally:
        if keyfile:
            keyfile.delete()
    
    project = filesystem.get_project(user, user, command.dest)
    
    if authtype == "ssh":
        keychain.set_ssh_for_project(project, remoteauth)
    elif authtype == "password":
        keychain.set_credentials_for_project(project, remoteauth, username, 
                password)
    
    metadata = project.metadata
    metadata['remote_url'] = source

    if push:
        metadata['push'] = push
    
    space_used = project.scan_files()
    user.amount_used += space_used

    metadata.close()

    result = dict(output=str(output), command="clone",
                    project=command.dest)
    return result

def run_command(user, project, args, kcpass=None):
    """Run any VCS command through UVC."""
    user = user.username
    project = project.name
    job_body = dict(user=user, project=project, args=args, kcpass=kcpass)
    return queue.enqueue("vcs", job_body, execute="bespin.vcs:run_command_run",
                        error_handler="bespin.vcs:vcs_error",
                        use_db=True)

def run_command_run(qi):
    """Runs the queued up run_command job."""
    message = qi.message
    s = database._get_session()
    user = User.find_user(message['user'])
    message['user'] = user
    message['project'] = get_project(user, user, message['project'])

    result = _run_command_impl(**message)
    result.update(dict(jobid=qi.id, asyncDone=True))
    retvalue = Message(user_id=user.id, message=simplejson.dumps(result))
    s.add(retvalue)
    config.c.stats.incr('vcs_DATE')

def _run_command_impl(user, project, args, kcpass):
    """Synchronous implementation of run_command."""
    working_dir = project.location
    metadata = project.metadata
    
    try:
        for i in range(0, len(args)):
            if args[i] == "_BESPIN_REMOTE_URL":
                try:
                    args[i] = metadata["remote_url"].encode("utf8")
                except KeyError:
                    del args[i]
                    break
            elif args[i] == "_BESPIN_PUSH":
                try:
                    args[i] = metadata["push"].encode("utf8")
                except KeyError:
                    del args[i]
                    break
                    
        context = main.SecureContext(working_dir)
        context.user = _get_vcs_user(user, project)
    
        if args and args[0] in main.dialects:
            dialect = None
        elif not is_new_project_command(args):
            dialect = main.infer_dialect(working_dir)
        else:
            dialect = None
        
        command_class = main.get_command_class(context, args, dialect)
        command_name = command_class.__name__
    
        keyfile = None
    
        if command_class.reads_remote or command_class.writes_remote:
            remote_auth = metadata.get(AUTH_PROPERTY)
            if command_class.writes_remote or remote_auth == AUTH_BOTH:
                if not kcpass:
                    raise NotAuthorized("Keychain password is required for this command.")
                keychain = KeyChain(user, kcpass)
                credentials = keychain.get_credentials_for_project(project)
                if credentials['type'] == 'ssh':
                    keyfile = TempSSHKeyFile()
                    keyfile.store(credentials['ssh_public_key'], 
                                  credentials['ssh_private_key'])
                    auth = dict(type='ssh', key=keyfile.filename)
                else:
                    auth = credentials
                context.auth = auth
                
        try:
            command = command_class.from_args(context, args)

            output = main.run_command(command, context)
            log.debug(output)
        finally:
            if keyfile:
                keyfile.delete()
    finally:        
        metadata.close()
    
    result = dict(command=command_name, output=str(output))
    return result
    
class TempSSHKeyFile(object):
    def __init__(self):
        self.tdir = path(tempfile.mkdtemp())
        self.filename = self.tdir / str(random.randint(10, 20000000))
        
    def create_key(self):
        destfile = self.filename
        os.system("ssh-keygen -N '' -f %s > /dev/null" % (destfile))
        private_key = destfile.bytes()
        pubkeyfile = destfile + ".pub"
        pubkey = pubkeyfile.bytes()
        return pubkey, private_key
        
    def store(self, public_key, private_key):
        destfile = self.filename
        destfile.write_bytes(private_key)
        pubkeyfile = destfile + ".pub"
        pubkeyfile.write_bytes(public_key)
        self.fix_permissions()
    
    def fix_permissions(self):
        destfile = self.filename
        destfile.chmod(0600)
        destfile = destfile + ".pub"
        destfile.chmod(0600)
        
    def delete(self):
        self.tdir.rmtree()
    
class KeyChain(object):
    """The KeyChain holds the user's credentials for remote
    repositories. These credentials are stored in an encrypted
    file (the file is encrypted with the password provided)."""
    
    def __init__(self, user, password):
        self.user = user
        self.password = pad(password[:31])
        self._kcdata = None
        
    @classmethod
    def get_ssh_public_key(cls, user):
        """Retrieve the user's public key without decrypting
        the keychain."""
        # external API users should not instantiate without a KeyChain password
        kc = cls(user, "")
        pubfile = kc.public_key_file
        if not pubfile.exists():
            raise NotAuthorized("Keychain is not set up. Please initialize with a password.")
        return pubfile.bytes()
    
    def get_ssh_key(self):
        """Returns the SSH key pair for this key chain. If necessary,
        this function will generate a new key pair."""
        kcdata = self.kcdata
        if "ssh" in kcdata:
            return kcdata['ssh']['public'], kcdata['ssh']['private']
        
        sshkeyfile = TempSSHKeyFile()
        try:
            pubkey, private_key = sshkeyfile.create_key()
        finally:
            sshkeyfile.delete()
            
        kcdata['ssh'] = dict(public=pubkey, private=private_key)
        self.public_key_file.write_bytes(pubkey)
        self._save()
        return pubkey, private_key
        
    def set_ssh_key(self, private_key, public_key):
        """Sets the SSH key. This key should be a passwordless key."""
        kcdata = self.kcdata
        kcdata['ssh'] = dict(public=public_key, private=private_key)
        self.public_key_file.write_bytes(public_key)
        self._save()
    
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
                
                if not text.startswith("{"):
                    raise NotAuthorized("Bad keychain password")
                
                self._kcdata = simplejson.loads(text)
        return self._kcdata
    
    @property
    def public_key_file(self):
        """Get the public key filename"""
        return self.kcfile + "-public"
    
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
                value['ssh_public_key'] = kcdata['ssh']['public']
        
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

        