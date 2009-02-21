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
import httplib2
from urlparse import urlparse
import logging

from urlrelay import URLRelay, url, register
from paste.auth import auth_tkt
import simplejson
import tempfile
from webob import Request, Response

from bespin.config import c
from bespin.framework import expose, BadRequest
from bespin import model

log = logging.getLogger("bespin.controllers")

@expose(r'^/register/new/(?P<username>.*)$', 'POST', auth=False)
def new_user(request, response):
    try:
        username = request.kwargs['username']
        email = request.POST['email']
        password = request.POST['password']
    except KeyError:
        raise BadRequest("username, email and password are required.")
    user = request.user_manager.create_user(username, password, email)
    
    file_manager = request.file_manager
    settings_project = file_manager.get_project(user, user, 
                        "BespinSettings", create=True)
    file_manager.install_template(user, settings_project,
                                          'usertemplate')
    response.content_type = "application/json"
    response.body = "{}"
    request.environ['paste.auth_tkt.set_user'](username)
    return response()

@expose(r'^/register/userinfo/$', 'GET')
def get_registered(request, response):
    response.content_type = "application/json"
    if request.user:
        quota, amount_used = request.user.quota_info()
    else:
        quota = None
        amount_used = None
    response.body=simplejson.dumps(
        dict(username=request.username,
        quota=quota, amountUsed=amount_used)
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
    response.body="{}"
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
    # make it so that the user obj appears dirty to SQLAlchemy
    user.settings = user.settings
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
        # get the user to appear dirty
        user.settings = user.settings
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
    result = fm.list_open(request.user)
    response.content_type = "application/json"
    response.body = simplejson.dumps(result)
    return response()

@expose(r'^/file/at/(?P<path>.*)$', 'PUT')
def putfile(request, response):
    fm = request.file_manager
    user = request.user
    
    project, path = _split_path(request)
    project = fm.get_project(user, user, project, create=True)
    
    fm.save_file(user, project, path,
                 request.body)
    return response()

@expose(r'^/file/at/(?P<path>.*)$', 'GET')
def getfile(request, response):
    fm = request.file_manager
    user = request.user
    
    project, path = _split_path(request)
    project = fm.get_project(user, user, project)
    
    mode = request.GET.get('mode', 'rw')
    contents = fm.get_file(user, project, path, mode)
    response.body = contents
    return response()
    
@expose(r'^/file/close/(?P<path>.*)$', 'POST')
def postfile(request, response):
    fm = request.file_manager
    user = request.user
    
    project, path = _split_path(request)
    project = fm.get_project(user, user, project)
    
    fm.close(user, project, path)
    return response()

@expose(r'^/file/at/(?P<path>.*)$', 'DELETE')
def deletefile(request, response):
    fm = request.file_manager
    user = request.user
    
    project, path = _split_path(request)
    project = fm.get_project(user, user, project)
    
    fm.delete(user, project, path)
    return response()

@expose(r'^/file/list/(?P<path>.*)$', 'GET')
def listfiles(request, response):
    fm = request.file_manager
    user = request.user
    
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
    
    if project:
        project = fm.get_project(user, user, project)
    
    files = fm.list_files(user, project, path)
    result = []
    for item in files:
        f = {'name' : item.short_name}
        _populate_stats(item, f)
        result.append(f)
        
    response.content_type = "application/json"
    response.body = simplejson.dumps(result)
    return response()
    
def _populate_stats(item, result):
    if isinstance(item, model.File):
        result['size'] = item.saved_size
        result['created'] = item.created.strftime("%Y%m%dT%H%M%S")
        result['modified'] = item.modified.strftime("%Y%m%dT%H%M%S")
        result['openedBy'] = [fs.user.username for fs in item.users]
    
@expose(r'^/file/stats/(?P<path>.+)$', 'GET')
def filestats(request, response):
    fm = request.file_manager
    user = request.user
    
    project, path = _split_path(request)
    project = fm.get_project(user, user, project)
    
    file_obj = fm.get_file_object(user, project, path)
    result = {}
    _populate_stats(file_obj, result)
    response.content_type = "application/json"
    response.body = simplejson.dumps(result)
    return response()
    
@expose(r'^/edit/at/(?P<path>.*)$', 'PUT')
def save_edit(request, response):
    fm = request.file_manager
    user = request.user
    
    project, path = _split_path(request)
    project = fm.get_project(user, user, project, create=True)
    
    fm.save_edit(user, project, path, 
                 request.body)
    return response()

def _get_edit_list(request, response, start_at=0):
    fm = request.file_manager
    user = request.user
    
    project, path = _split_path(request)
    project = fm.get_project(user, user, project)
    
    edits = fm.list_edits(user, project, path, start_at)
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
    request.file_manager.reset_edits(request.user)
    return response()
    
@expose(r'^/edit/reset/(?P<path>.+)$', 'POST')
def reset(request, response):
    fm = request.file_manager
    user = request.user
    
    project, path = _split_path(request)
    project = fm.get_project(user, user, project)
    
    fm.reset_edits(user, project, path)
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
                    request.user, project_name, filename,
                    input_file.file)
    return response()
    
def _perform_import(file_manager, user, project_name, filename, fileobj):
    if filename.endswith(".tgz") or filename.endswith(".tar.gz"):
        func = file_manager.import_tarball
    elif filename.endswith(".zip"):
        func = file_manager.import_zipfile
    else:
        raise BadRequest(
            "Import only supports .tar.gz, .tgz and .zip at this time.")
        
    project = file_manager.get_project(user, user, project_name, clean=True)
    
    func(user,
        project, filename, fileobj)
    return
    
@expose(r'^/project/fromurl/(?P<project_name>[^/]+)', "POST")
def import_from_url(request, response):
    project_name = request.kwargs['project_name']
    
    url = request.body
    try:
        resp = httplib2.Http().request(url, method="HEAD")
    except httplib2.HttpLib2Error, e:
        raise BadRequest(str(e))
        
    # chech the content length to see if the user has enough quota
    # available before we download the whole file
    content_length = resp[0].get("content-length")
    if content_length:
        content_length = int(content_length)
        if not request.user.check_save(content_length):
            raise model.OverQuota()
    
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
    _perform_import(request.file_manager, request.user,
                    project_name, filename, tempdatafile)
    tempdatafile.close()
    return response()

@expose(r'^/project/export/(?P<project_name>.*(\.zip|\.tgz))')
def export_project(request, response):
    fm = request.file_manager
    user = request.user
    
    project_name = request.kwargs['project_name']
    project_name, extension = os.path.splitext(project_name)
    if extension == ".zip":
        func = fm.export_zipfile
        response.content_type = "application/zip"
    else:
        response.content_type = "application/x-tar-gz"
        func = fm.export_tarball
    
    project = fm.get_project(user, user, project_name)
    
    output = func(user, project)
    def filegen():
        data = output.read(8192)
        while data:
            yield data
            data = output.read(8192)
        raise StopIteration
    response.app_iter = filegen()
    return response()
    
@expose(r'^/preview/at/(?P<path>.+)$')
def preview_file(request, response):
    fm = request.file_manager
    user = request.user
    
    project, path = _split_path(request)
    project = fm.get_project(user, user, project)
    
    file_obj = fm.get_file_object(user, project, path)
    response.body = str(file_obj.data)
    response.content_type = file_obj.mimetype
    return response()
    
@expose(r'^/project/rename/(?P<project_name>.+)/$', 'POST')
def rename_project(request, response):
    fm = request.file_manager
    user = request.user
    
    project_name = request.kwargs['project_name']
    project = fm.get_project(user, user, project_name)
    fm.rename(user, project, "", request.body)
    response.body = ""
    response.content_type = "text/plain"
    return response()
    
def db_middleware(app):
    def wrapped(environ, start_response):
        from bespin import model
        session = c.sessionmaker(bind=c.dbengine)
        environ['bespin.dbsession'] = session
        environ['bespin.docommit'] = True
        environ['user_manager'] = model.UserManager(session)
        environ['file_manager'] = model.FileManager(session)
        environ['db'] = model.DB(environ['user_manager'], environ['file_manager'])
        try:
            result = app(environ, start_response)
            if environ['bespin.docommit']:
                session.commit()
            else:
                session.rollback()
        except:
            session.rollback()
            log.exception("Error raised during request: %s", environ)
            raise
        return result
    return wrapped

def pathpopper_middleware(app, num_to_pop=1):
    def new_app(environ, start_response):
        req = Request(environ)
        for i in range(0, num_to_pop):
            req.path_info_pop()
        return app(environ, start_response)
    return new_app

def default_to_static(dynamic_app, static_app):
    def new_app(environ, start_response):
        def wrapped_sr(status, headers, exc_info=None):
            if "bespin.good_url_but_not_found" not in environ \
                and status.startswith("404"):
                return static_app(environ, start_response)
            return start_response(status, headers, exc_info)
        return dynamic_app(environ, wrapped_sr)
    return new_app

def make_app():
    from webob import Response
    import static
    static_app = static.Cling(c.static_dir)
    
    docs_app = pathpopper_middleware(static.Cling(c.docs_dir))
    code_app = pathpopper_middleware(static.Cling(c.static_dir + "/js"), 2)
    
    register("^/docs/code/", code_app)
    register("^/docs/", docs_app)
    
    app = URLRelay()
    app = auth_tkt.AuthTKTMiddleware(app, c.secret, secure=c.secure_cookie, 
                include_ip=False, httponly=True,
                current_domain_cookie=True, wildcard_cookie=True)
    app = db_middleware(app)
    
    app = default_to_static(app, static_app)
    
    return app
