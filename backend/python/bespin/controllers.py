#  ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
# 
# The contents of this file are subject to the Mozilla Public License  
# Version
# 1.1 (the "License"); you may not use this file except in compliance  
# with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
# 
# Software distributed under the License is distributed on an "AS IS"  
# basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the  
# License
# for the specific language governing rights and limitations under the
# License.
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

import os
import urllib2
from urlparse import urlparse
from urlrelay import URLRelay, url
from paste.auth import auth_tkt
import simplejson
import tempfile

from bespin.config import c
from bespin.framework import expose, BadRequest

@expose(r'^/register/new/(?P<username>.*)$', 'POST', auth=False)
def new_user(request, response):
    try:
        username = request.kwargs['username']
        email = request.POST['email']
        password = request.POST['password']
    except KeyError:
        raise BadRequest("username, email and password are required.")
    user = request.user_manager.create_user(username, password, email)
    request.file_manager.install_template(username, user.private_project,
                                          'usertemplate')
    response.content_type = "application/json"
    response.body = simplejson.dumps(dict(project=user.private_project))
    request.environ['paste.auth_tkt.set_user'](username)
    return response()

@expose(r'^/register/userinfo/$', 'GET')
def get_registered(request, response):
    response.content_type = "application/json"
    if request.user:
        private_project = request.user.private_project
    else:
        private_project = None
    response.body=simplejson.dumps(
        dict(username=request.username,
        project=private_project)
    )
    return response()

@expose(r'^/register/login/(?P<login_username>.+)', 'POST', auth=False)
def login(request, response):
    username = request.kwargs['login_username']
    password = request.POST.get('password')
    user = request.user_manager.get_user(username)
    if not user or (user and user.password != password):
        response.status = "401 Not Authorized"
        response.body = "Invalid login"
        return response()
    
    request.environ['paste.auth_tkt.set_user'](username)
    
    response.content_type = "application/json"
    if request.user:
        private_project = request.user.private_project
    else:
        private_project = None
    response.body=simplejson.dumps(
        dict(project=private_project)
    )
    return response()

@expose(r'^/register/logout/$')
def logout(request, response):
    request.environ['paste.auth_tkt.logout_user']()
    response.status = "200 OK"
    response.body = "Logged out"
    return response()

@expose(r'^/settings/$', 'POST')
def save_settings(request, response):
    """Saves one or more settings for the currently logged in user."""
    user = request.user
    user.settings.update(request.POST)
    request.save_user()
    return response()

@expose(r'^/settings/(?P<setting_name>.*)$', 'GET')
def get_settings(request, response):
    """Retrieves one setting or all (depending on URL)."""
    kwargs = request.kwargs
    user = request.user
    response.content_type='application/json'
    setting_name = kwargs['setting_name']
    if setting_name:
        try:
            response.body=simplejson.dumps(user.settings[setting_name])
        except KeyError:
            response.status = '404 Not Found'
            response.body = '%s not found' % setting_name
            response.content_type="text/plain"
    else:
        response.body=simplejson.dumps(user.settings)
    return response()

@expose(r'^/settings/(?P<setting_name>.+)$', 'DELETE')
def delete_setting(request, response):
    user = request.user
    kwargs = request.kwargs
    setting_name = kwargs['setting_name']
    try:
        del user.settings[setting_name]
        request.save_user()
    except KeyError:
        response.status = "404 Not Found"
    return response()
    
def _split_path(request):
    path = request.kwargs['path']
    result = path.split('/', 1)
    if len(result) < 2:
        raise BadRequest("Project and path are both required.")
    return result
    
@expose(r'^/file/listopen/$', 'GET')
def listopen(request, response):
    fm = request.file_manager
    result = fm.list_open(request.username)
    response.content_type = "application/json"
    response.body = simplejson.dumps(result)
    return response()

@expose(r'^/file/at/(?P<path>.*)$', 'PUT')
def putfile(request, response):
    fm = request.file_manager
    project, path = _split_path(request)
    fm.save_file(request.username, project, path,
                 request.body)
    return response()

@expose(r'^/file/at/(?P<path>.*)$', 'GET')
def getfile(request, response):
    fm = request.file_manager
    project, path = _split_path(request)
    mode = request.GET.get('mode', 'rw')
    contents = fm.get_file(request.username, project, path, mode)
    response.body = contents
    return response()
    
@expose(r'^/file/close/(?P<path>.*)$', 'POST')
def postfile(request, response):
    fm = request.file_manager
    project, path = _split_path(request)
    fm.close(request.username, project, path)
    return response()

@expose(r'^/file/at/(?P<path>.*)$', 'DELETE')
def deletefile(request, response):
    fm = request.file_manager
    project, path = _split_path(request)
    fm.delete(request.username, project, path)
    return response()

@expose(r'^/file/list/(?P<path>.*)$', 'GET')
def listfiles(request, response):
    fm = request.file_manager
    path = request.kwargs['path']
    if not path:
        project = ''
        path = ''
    else:
        try:
            project, path = _split_path(request)
        except BadRequest:
            project = path
            path = ''
        
    result = fm.list_files(request.username, project, path)
    response.content_type = "application/json"
    response.body = simplejson.dumps(result)
    return response()
    
@expose(r'^/edit/at/(?P<path>.*)$', 'PUT')
def save_edit(request, response):
    fm = request.file_manager
    project, path = _split_path(request)
    fm.save_edit(request.username, project, path, 
                 request.body)
    return response()

def _get_edit_list(request, response, start_at=0):
    fm = request.file_manager
    project, path = _split_path(request)
    edits = fm.list_edits(request.username, project, path, start_at)
    response.content_type = "application/json"
    response.body = simplejson.dumps(edits)
    return response()

@expose(r'^/edit/list/(?P<path>.*)$', 'GET')
def list_edits(request, response):
    return _get_edit_list(request, response)

@expose(r'^/edit/recent/(?P<start_at>\d+)/(?P<path>.*)$', 'GET')
def list_recent(request, response):
    start_at = int(request.kwargs['start_at'])
    return _get_edit_list(request, response, start_at)
    
@expose(r'^/edit/reset/$', 'POST')
def reset_all(request, response):
    request.file_manager.reset_edits(request.username)
    return response()
    
@expose(r'^/edit/reset/(?P<path>.+)$', 'POST')
def reset(request, response):
    fm = request.file_manager
    project, path = _split_path(request)
    fm.reset_edits(request.username, project, path)
    return response()

@expose(r'^/(editor|dashboard)\.html', 'GET', auth=False)
def static_with_login(request, response):
    if not 'REMOTE_USER' in request.environ:
        response.location = "/"
        response.status = "302 Not logged in"
    else:
        response.status = "404 Not found"
    response.body = ""
    return response()

@expose(r'^/project/import/(?P<project_name>[^/]+)', "POST")
def import_project(request, response):
    project_name = request.kwargs['project_name']
    input_file = request.POST['filedata']
    filename = input_file.filename
    _perform_import(request.file_manager, 
                    request.username, project_name, filename,
                    input_file.file)
    return response()
    
def _perform_import(file_manager, username, project_name, filename, fileobj):
    if filename.endswith(".tgz") or filename.endswith(".tar.gz"):
        func = file_manager.import_tarball
    elif filename.endswith(".zip"):
        func = file_manager.import_zipfile
    else:
        raise BadRequest(
            "Import only supports .tar.gz, .tgz and .zip at this time.")
        
    func(username,
        project_name, filename, fileobj)
    return
    
@expose(r'^/project/fromurl/(?P<project_name>[^/]+)', "POST")
def import_from_url(request, response):
    project_name = request.kwargs['project_name']
    url = request.body
    try:
        datafile = urllib2.urlopen(url)
    except urllib2.URLError, e:
        raise BadRequest(str(e))
    tempdatafile = tempfile.NamedTemporaryFile()
    tempdatafile.write(datafile.read())
    datafile.close()
    tempdatafile.seek(0)
    url_parts = urlparse(url)
    filename = os.path.basename(url_parts[2])
    _perform_import(request.file_manager, request.username,
                    project_name, filename, tempdatafile)
    tempdatafile.close()
    return response()

@expose(r'^/project/export/(?P<project_name>.*(\.zip|\.tgz))')
def export_project(request, response):
    project_name = request.kwargs['project_name']
    project_name, extension = os.path.splitext(project_name)
    if extension == ".zip":
        func = request.file_manager.export_zipfile
        response.content_type = "application/zip"
    else:
        response.content_type = "application/x-tar-gz"
        func = request.file_manager.export_tarball
    output = func(request.username, 
                                                 project_name)
    def filegen():
        data = output.read(8192)
        while data:
            yield data
            data = output.read(8192)
        raise StopIteration
    response.app_iter = filegen()
    return response()
    
def db_middleware(app):
    def wrapped(environ, start_response):
        environ['user_manager'] = c.user_manager
        environ['file_manager'] = c.file_manager
        result = app(environ, start_response)
        c.user_manager.commit()
        c.file_manager.commit()
        return result
    return wrapped

def make_app():
    from webob import Response
    import static
    static_app = static.Cling(c.static_dir)
    
    from paste.cascade import Cascade
    app = URLRelay()
    app = auth_tkt.AuthTKTMiddleware(app, c.secret, include_ip=False)
    app = db_middleware(app)
    
    app = Cascade([app, static_app])
    
    return app
