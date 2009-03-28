from uvc.tests.util import mock_run_command
from webtest import TestApp
from uvc import hg
import simplejson
from path import path

from bespin import vcs, config, controllers, model

macgyver = None
app = None

def setup_module(module):
    global app
    config.set_profile('test')
    app = controllers.make_app()
    app = TestApp(app)
    
def _init_data():
    global macgyver
    config.activate_profile()
    
    fsroot = config.c.fsroot
    if fsroot.exists() and fsroot.basename() == "testfiles":
        fsroot.rmtree()
    fsroot.makedirs()
    
    app.reset()
    
    model.Base.metadata.drop_all(bind=config.c.dbengine)
    model.Base.metadata.create_all(bind=config.c.dbengine)
    s = config.c.sessionmaker(bind=config.c.dbengine)
    user_manager = model.UserManager(s)
    
    app.post("/register/new/MacGyver", 
        dict(password="richarddean", email="rich@sg1.com"))
        
    macgyver = user_manager.get_user("MacGyver")


clone_output = """requesting all changes
adding changesets
adding manifests
adding file changes
added 9 changesets with 39 changes to 10 files
updating working directory
10 files updated, 0 files merged, 0 files removed, 0 files unresolved
"""

@mock_run_command(clone_output)
def test_run_an_hg_clone(run_command_params):
    _init_data()
    cmd = "clone http://hg.mozilla.org/labs/bespin bespin".split()
    output = vcs.clone(macgyver, cmd)
    command, context = run_command_params
    
    assert isinstance(command, hg.clone)
    working_dir = context.working_dir
    assert working_dir == macgyver.get_location()
    assert output == clone_output

diff_output = """diff -r ff44251fbb1e uvc/main.py
--- a/uvc/main.py	Thu Mar 19 11:55:30 2009 -0400
+++ b/uvc/main.py	Fri Mar 20 15:01:07 2009 -0400
@@ -1,4 +1,5 @@
 "Implements the uvc command processing."
+# Copyright 2009 Mozilla Corporation
 
 import sys
 import os
"""

@mock_run_command(diff_output)
def test_run_a_diff(run_command_params):
    _init_data()
    bigmac = model.get_project(macgyver, macgyver, 'bigmac', create=True)
    bigmac.save_file(".hg/hgrc", "# test rc file\n")
    cmd = ["diff"]
    output = vcs.run_command(macgyver, bigmac, cmd)
    command, context = run_command_params
    
    working_dir = context.working_dir
    
    assert isinstance(command, hg.diff)
    assert working_dir == bigmac.location
    assert output == diff_output
    
# Web tests

@mock_run_command(clone_output)
def test_hg_clone_on_web(run_command_params):
    _init_data()
    request = simplejson.dumps({'command' : ['clone', 'http://hg.mozilla.org/labs/bespin']})
    resp = app.post("/vcs/bigmac/", request)
    assert resp.content_type == "application/json"
    output = simplejson.loads(resp.body)
    assert 'output' in output
    output = output['output']
    command, context = run_command_params
    
    working_dir = context.working_dir
    
    command_line = " ".join(command.get_command_line())
    assert command_line == "hg clone http://hg.mozilla.org/labs/bespin bigmac"
    assert working_dir == macgyver.get_location()
    assert output == clone_output

@mock_run_command(diff_output)
def test_hg_diff_on_web(run_command_params):
    _init_data()
    bigmac = model.get_project(macgyver, macgyver, 'bigmac', create=True)
    bigmac.save_file(".hg/hgrc", "# test rc file\n")
    
    request = simplejson.dumps({'command' : ['diff']})
    resp = app.post("/vcs/bigmac/", request)
    
    assert resp.content_type == "application/json"
    output = simplejson.loads(resp.body)
    assert 'output' in output
    output = output['output']
    command, context = run_command_params
    
    working_dir = context.working_dir
    
    command_line = " ".join(command.get_command_line())
    assert command_line == "hg diff"
    assert working_dir == bigmac.location
    assert output == diff_output

# passphrase for this key is This is the passphrase.
# (maybe "This is my passphrase.")
identity = \
"""-----BEGIN RSA PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
DEK-Info: DES-EDE3-CBC,F6FA99F7A13B52B2

oldSAS2sPwmqPNN4Tqz+t7ECOtsht9rHFvdae2EPfy2zF4JF171iueXFfR9ijbwu
TpkYIoV0rQGyKgroAH1HllkO5MdMGD1LasbKdAd76XsC5bsUDM3oFt08zOO5kcmx
r6Zo8Lkc/sEoNOk5RvVMGEdPbEk+0XNR9/vvYUTia0Pe3SE+hq3kk0mQRsTDhDwz
0ygxfMa+GDvJUBsM1DPQBHmH7nRLgXSMRiLdqdEKZ1D0HSt2plTuj0wjrJal671U
mDppExH/l1U1tYacHk75apS5K/NEgQT+cf4mWXB6JNQVbn1GlAIiR7BMyufGdMmR
O+zvr0ihh5T5hKFbU+Ht6z3CDafovnB9sCrDdwExaiKfxkiWyRR95JcDEFbD2m9j
svKwm02dC1+KMfvVT28Kf14uamGgnl4oILXMlLXgnogAVvRnRtwLmPtIvY3cbidQ
OQYVNTFwRtE6Spzk6x0DBmNiiPKYzy8YV/QGokUrYoOs50+sAEPb3szSn2zPkqkh
CjflCMb1F0JTV60Y+08AafIhGxK0IadGGxgmsIjdcjy/46TELmXsKjI3C3zUB5kp
6Vg3nzLZRLEszRmZABlMu+Y/Jrtq87c4l7eDZ2W8KV85NqlMLOTDqEnOiWbForKh
eAOn/3+HfZ/KRCGaabk/AbaOfo09QQOOz+HhCEJ3qjJ7dd2lBylldGZzcQqyKQce
u9TLs1+FKwfj6PVUHEVnzEQVOU/oARh5nNlnrl5qSh+y5t6Xm2+eCmG3X3U5/rrt
5mTJZkv/RVEDKt5EjHPo0xWfYCMEcpf2nwSoHigoCrt6IIykztWn6ZAPh94cN4Bh
zAPd1EKp4pFri3z7EXl3swmJR1Dv7WWf8LBQu310gxKcOPh8GJdWipYCwePfclLy
QpfsaxTKO1K/9+0EKsNCDUNq7PCcniuwLAj+l3Il1SK8lphWsuENkyYYxn+cdef5
fIWAEUllfGmSIl+pFCQukoZ3gpdZn/7P+hbTk1DnEF9IatQCBXLUsqAo80batoUe
SD3N6V00vSTNTRx03n+Omef32Hib8zxXdjthzbW9VIVHa84bE4VmKqPcvvU9d5+x
QI3rU/0SjyR5HZIwYul+dQVA+WCMHiLuAf/jKKd1QlWM/zMWa3zY8DdnL8rGM5wR
DLOGFrRDz3kd0oYlj0QXmQyurdua2OZgnmav3srciWDR3SU9gxOMTqMGmkfDUih7
ONDMgRrtgtV7LqGXkzWCxy6fByL7QPgTi+Xr9XVsQU0LLT8QKjXA+ResDHtrDd7U
+aE2rEMFJOOFI91bU47xOZsd4XyNsOGN0rmgYqiN5/qTbHsM1W6VUUU8R/FiUMHh
1+pgoRndjWmd+nnVfVmHWXcjdi+U7fWZIBEcEPT41/NwCHpBhIb87Ki9baGvbr3M
E2QCDTPFHHHWIPdTNphNm8nZSayg6QXe6PQ07Wd1hH1oELwhVixv4xwzBVizyvVA
F6C48kaeMueW8rjvyr4EJgLbrTqeZAZQ0Fft8A1dhHVOeRgsKlHnKDCOoaYeFqVV
C9QncGOvIaQzwXO/yrIEtEJinKzf+CIXB58WCsUwDoxSszo56fOpvA==
-----END RSA PRIVATE KEY-----
"""

def test_keychain_creation():
    _init_data()
    kc = vcs.KeyChain(macgyver, "foobar")
    kc.add_ssh_identity("SSH ID", identity)
    
    bigmac = model.get_project(macgyver, macgyver, "bigmac", create=True)
    
    kc.set_ssh_for_project(bigmac, "SSH ID")
    kc.save()
    kcfile = path(macgyver.get_location()) / ".bespin-keychain"
    assert kcfile.exists()
    
    # make sure the file is encrypted
    text = kcfile.bytes()
    assert "SSH ID" not in text
    assert "RSA PRIVATE KEY" not in text
    
    kc = vcs.KeyChain(macgyver, "foobar")
    keys = kc.ssh_key_names
    assert keys == ["SSH ID"]
    
    credentials = kc.get_credentials_for_project(bigmac)
    assert credentials['ssh_key'] == identity
    assert credentials['type'] == "ssh"
    
    kc.delete_ssh_identity("SSH ID")
    assert "SSH ID" not in kc.ssh_key_names
    
    credentials = kc.get_credentials_for_project(bigmac)
    assert credentials is None
    
    kc.set_credentials_for_project(bigmac, "macG", "coolpass")
    kc.save()
    
    kc = vcs.KeyChain(macgyver, "foobar")
    credentials = kc.get_credentials_for_project(bigmac)
    assert credentials['type'] == 'password'
    assert credentials['username'] == 'macG'
    assert credentials['password'] == 'coolpass'
    
    kc.delete_credentials_for_project(bigmac)
    kc.save()
    
    kc = vcs.KeyChain(macgyver, "foobar")
    credentials = kc.get_credentials_for_project(bigmac)
    assert credentials is None

def test_keychain_add_name_twice():
    _init_data()
    kc = vcs.KeyChain(macgyver, "foobar")
    kc.add_ssh_identity("SSH ID", identity)
    try:
        kc.add_ssh_identity("SSH ID", identity)
        assert False, "Expected ConflictError for existing identity"
    except model.ConflictError:
        pass
    
    kc.delete_ssh_identity("SSH ID")
    kc.add_ssh_identity("SSH ID", identity)
    
def test_keychain_refer_to_nonexistent_identity():
    _init_data()
    bigmac = model.get_project(macgyver, macgyver, 'bigmac', create=True)
    kc = vcs.KeyChain(macgyver, "foobar")
    try:
        kc.set_ssh_for_project(bigmac, "BAD ID")
        assert False, "Expected a not found error for bad SSH ID"
    except model.FileNotFound:
        pass
    
def test_vcs_auth_set_password_on_web():
    _init_data()
    bigmac = model.get_project(macgyver, macgyver, 'bigmac', create=True)
    resp = app.post("/keychain/setauth/bigmac/", dict(kcpass="foobar", 
                            type="password", username="macG", 
                            password="coolpass"))
    kc = vcs.KeyChain(macgyver, "foobar")
    credentials = kc.get_credentials_for_project(bigmac)
    assert credentials['type'] == 'password'
    assert credentials['username'] == 'macG'
    assert credentials['password'] == 'coolpass'
    
def test_vcs_auth_set_ssh_newkey_on_web():
    _init_data()
    bigmac = model.get_project(macgyver, macgyver, "bigmac", create=True)
    resp = app.post("/keychain/setauth/bigmac/", dict(kcpass="foobar",
                    type="ssh", name="SSH ID", ssh_key=identity))
    
    kc = vcs.KeyChain(macgyver, "foobar")
    assert kc.ssh_key_names == ["SSH ID"]
    
    credentials = kc.get_credentials_for_project(bigmac)
    assert credentials['type'] == 'ssh'
    assert credentials['ssh_key'] == identity
    
def test_vcs_auth_set_ssh_key_on_web():
    _init_data()
    bigmac = model.get_project(macgyver, macgyver, "bigmac", create=True)

    kc = vcs.KeyChain(macgyver, "foobar")
    kc.add_ssh_identity("SSH ID", identity)
    credentials = kc.get_credentials_for_project(bigmac)
    assert credentials is None
    kc.save()
    
    resp = app.post("/keychain/setauth/bigmac/", dict(kcpass="foobar",
                    type="ssh", name="SSH ID"))

    kc = vcs.KeyChain(macgyver, "foobar")
    credentials = kc.get_credentials_for_project(bigmac)
    assert credentials['type'] == 'ssh'
    assert credentials['ssh_key'] == identity
