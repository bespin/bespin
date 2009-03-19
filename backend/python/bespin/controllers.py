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
from bespin import model, vcs
#from bespin.mobwrite.mobwrite_daemon import RequestHandler
import urllib

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
    
    settings_project = model.get_project(user, user,
                        "BespinSettings", create=True)
    settings_project.install_template('usertemplate')
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
    user = request.user
    result = user.files
    response.content_type = "application/json"
    response.body = simplejson.dumps(result)
    return response()

@expose(r'^/file/at/(?P<path>.*)$', 'PUT')
def putfile(request, response):
    user = request.user
    
    project, path = _split_path(request)
    project = model.get_project(user, user, project, create=True)
    
    if path:
        project.save_file(path, request.body)
    return response()

@expose(r'^/file/at/(?P<path>.*)$', 'GET')
def getfile(request, response):
    user = request.user
    
    project, path = _split_path(request)
    project = model.get_project(user, user, project)
    
    mode = request.GET.get('mode', 'rw')
    contents = project.get_file(path, mode)
    response.body = contents
    return response()
    
@expose(r'^/file/close/(?P<path>.*)$', 'POST')
def postfile(request, response):
    user = request.user
    
    project, path = _split_path(request)
    project = model.get_project(user, user, project)
    
    project.close(path)
    return response()

@expose(r'^/file/at/(?P<path>.*)$', 'DELETE')
def deletefile(request, response):
    user = request.user
    
    project, path = _split_path(request)
    project = model.get_project(user, user, project)
    
    project.delete(path)
    return response()

@expose(r'^/file/list/(?P<path>.*)$', 'GET')
def listfiles(request, response):
    user = request.user
    
    path = request.kwargs['path']
    if not path:
        files = user.projects
    else:
        try:
            project, path = _split_path(request)
        except BadRequest:
            project = path
            path = ''
    
        if project:
            project = model.get_project(user, user, project)
    
        files = project.list_files(path)
        
    result = []
    for item in files:
        f = {'name' : item.short_name}
        _populate_stats(item, f)
        result.append(f)
        
    response.content_type = "application/json"
    response.body = simplejson.dumps(result)
    return response()
    
@expose(r'^/project/template/(?P<project_name>.*)/$', 'POST')
def install_template(request, response):
    user = request.user
    project_name = request.kwargs['project_name']
    template_name = request.body
    if "/" in template_name or "." in template_name:
        raise BadRequest("Template names cannot include '/' or '.'")
    project = model.get_project(user, user, project_name, create=True)
    project.install_template(template_name)
    response.content_type = "text/plain"
    response.body = ""
    return response()
    
@expose(r'^/file/search/(?P<project_name>.*)$', 'GET')
def file_search(request, response):
    user = request.user
    query = request.GET.get("q", "")
    limit = request.GET.get("limit", 20)
    try:
        limit = int(limit)
    except ValueError:
        limit = 20
    project_name = request.kwargs['project_name']
    
    project = model.get_project(user, user, project_name)
    result = project.search_files(query, limit)
    
    response.content_type = "application/json"
    response.body = simplejson.dumps(result)
    return response()
    
def _populate_stats(item, result):
    if isinstance(item, model.File):
        result['size'] = item.saved_size
        result['created'] = item.created.strftime("%Y%m%dT%H%M%S")
        result['modified'] = item.modified.strftime("%Y%m%dT%H%M%S")
        result['openedBy'] = [username for username in item.users]
    
@expose(r'^/file/stats/(?P<path>.+)$', 'GET')
def filestats(request, response):
    user = request.user
    
    project, path = _split_path(request)
    project = model.get_project(user, user, project)
    
    file_obj = project.get_file_object(path)
    result = {}
    _populate_stats(file_obj, result)
    response.content_type = "application/json"
    response.body = simplejson.dumps(result)
    return response()
    
# Edits may be changing with collab. Commented out for now
# DELETE once we know these are done...

# @expose(r'^/edit/at/(?P<path>.*)$', 'PUT')
# def save_edit(request, response):
#     user = request.user
#     
#     project, path = _split_path(request)
#     project = model.get_project(user, user, project, create=True)
#     
#     fm.save_edit(user, project, path, 
#                  request.body)
#     return response()
# 
# def _get_edit_list(request, response, start_at=0):
#     fm = request.file_manager
#     user = request.user
#     
#     project, path = _split_path(request)
#     project = fm.get_project(user, project)
#     
#     edits = fm.list_edits(user, project, path, start_at)
#     response.content_type = "application/json"
#     response.body = simplejson.dumps(edits)
#     return response()
# 
# @expose(r'^/edit/list/(?P<path>.*)$', 'GET')
# def list_edits(request, response):
#     return _get_edit_list(request, response)
# 
# @expose(r'^/edit/recent/(?P<start_at>\d+)/(?P<path>.*)$', 'GET')
# def list_recent(request, response):
#     start_at = int(request.kwargs['start_at'])
#     return _get_edit_list(request, response, start_at)
#     
# @expose(r'^/edit/reset/$', 'POST')
# def reset_all(request, response):
#     request.file_manager.reset_edits(request.user)
#     return response()
#     
# @expose(r'^/edit/reset/(?P<path>.+)$', 'POST')
# def reset(request, response):
#     fm = request.file_manager
#     user = request.user
#     
#     project, path = _split_path(request)
#     project = fm.get_project(user, project)
#     
#     fm.reset_edits(user, project, path)
#     return response()

@expose(r'^/(?P<filename>editor|dashboard)\.html', 'GET', auth=False)
def static_with_login(request, response):
    """Ensure that the user is logged in. Redirect them to the front
    page if they're not. If they are logged in, go ahead and serve
    up the static file."""
    if not 'REMOTE_USER' in request.environ:
        response.location = "/"
        response.status = "302 Not logged in"
        response.body = ""
    else:
        response.status = "200 OK"
        response.content_type = "text/html"
        response.body = open("%s/%s.html" % (c.static_dir, 
                request.kwargs['filename'])).read()
    return response()

@expose(r'^/project/import/(?P<project_name>[^/]+)', "POST")
def import_project(request, response):
    project_name = request.kwargs['project_name']
    input_file = request.POST['filedata']
    filename = input_file.filename
    _perform_import(request.user, project_name, filename,
                    input_file.file)
    return response()
    
def _perform_import(user, project_name, filename, fileobj):
    project = model.get_project(user, user, project_name, clean=True)
    if filename.endswith(".tgz") or filename.endswith(".tar.gz"):
        func = project.import_tarball
    elif filename.endswith(".zip"):
        func = project.import_zipfile
    else:
        raise BadRequest(
            "Import only supports .tar.gz, .tgz and .zip at this time.")
        
    
    func(filename, fileobj)
    return

def validate_url(url):
    if not url.startswith("http://") and not url.startswith("https://"):
        raise BadRequest("Invalid url: " + url)
    return url
    
@expose(r'^/project/fromurl/(?P<project_name>[^/]+)', "POST")
def import_from_url(request, response):
    project_name = request.kwargs['project_name']
    
    url = validate_url(request.body)
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
    _perform_import(request.user, project_name, filename, tempdatafile)
    tempdatafile.close()
    return response()

@expose(r'^/project/export/(?P<project_name>.*(\.zip|\.tgz))')
def export_project(request, response):
    user = request.user
    
    project_name = request.kwargs['project_name']
    project_name, extension = os.path.splitext(project_name)

    project = model.get_project(user, user, project_name)
    
    if extension == ".zip":
        func = project.export_zipfile
        response.content_type = "application/zip"
    else:
        response.content_type = "application/x-tar-gz"
        func = project.export_tarball
    
    output = func()
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
    user = request.user
    
    project, path = _split_path(request)
    project = model.get_project(user, user, project)
    
    file_obj = project.get_file_object(path)
    response.body = str(file_obj.data)
    response.content_type = file_obj.mimetype
    return response()
    
@expose(r'^/project/rename/(?P<project_name>.+)/$', 'POST')
def rename_project(request, response):
    user = request.user
    
    project_name = request.kwargs['project_name']
    project = model.get_project(user, user, project_name)
    project.rename(request.body)
    response.body = ""
    response.content_type = "text/plain"
    return response()

@expose(r'^/network/followers/', 'GET')
def follow(request, response):
    return _users_followed_response(request.user_manager, request.user, response)

@expose(r'^/network/follow/', 'POST')
def follow(request, response):
    users = _lookup_usernames(request.user_manager, simplejson.loads(request.body))
    for other_user in users:
        request.user_manager.follow(request.user, other_user)
    return _users_followed_response(request.user_manager, request.user, response)

@expose(r'^/network/unfollow/', 'POST')
def unfollow(request, response):
    users = _lookup_usernames(request.user_manager, simplejson.loads(request.body))
    for other_user in users:
        request.user_manager.unfollow(request.user, other_user)
    return _users_followed_response(request.user_manager, request.user, response)

@expose(r'^/group/list/all', 'GET')
def groupListAll(request, response):
    groups = request.user_manager.get_groups(request.user)
    return _respond_json(response, groups)

@expose(r'^/group/list/(?P<group>.+)/$', 'GET')
def groupList(request, response):
    group = request.kwargs['group']
    members = request.user_manager.get_group_members(request.user, group)
    return _respond_json(response, members)

@expose(r'^/group/remove/all/(?P<group>.+)/$', 'POST')
def groupRemoveAll(request, response):
    group = request.kwargs['group']
    request.user_manager.remove_all_group_members(request.user, group)
    members = request.user_manager.get_group_members(request.user, group)
    return _respond_json(response, members)

@expose(r'^/group/remove/(?P<group>.+)/$', 'POST')
def groupRemove(request, response):
    group = request.kwargs['group']
    users = _lookup_usernames(request.user_manager, simplejson.loads(request.body))
    for other_user in users:
        request.user_manager.remove_group_members(request.user, group, other_user)
    members = request.user_manager.get_group_members(request.user, group)
    return _respond_json(response, members)

@expose(r'^/group/add/(?P<group>.+)/$', 'POST')
def groupAdd(request, response):
    group = request.kwargs['group']
    users = _lookup_usernames(request.user_manager, simplejson.loads(request.body))
    for other_user in users:
        request.user_manager.add_group_members(request.user, group, other_user)
    members = request.user_manager.get_group_members(request.user, group)
    return _respond_json(response, members)

def _respond_json(response, groups):
    response.body = simplejson.dumps(groups)
    response.content_type = "text/plain"
    return response()

def _lookup_usernames(user_manager, usernames):
    def lookup_username(username):
        user = user_manager.get_user(username)
        if user == None:
            # TODO: XSS injection hole here, we should have some policy
            raise BadRequest("Username not found: %s" % username)
        return user
    return map(lookup_username, usernames)

def _users_followed_response(user_manager, user, response):
    list = user_manager.users_i_follow(user)
    list = [connection.followed.username for connection in list]
    response.body = simplejson.dumps(list)
    response.content_type = "text/plain"

#@expose(r'^/mobwrite/$', 'POST')
#def mobwrite(request, response):
#    handler = RequestHandler()
#    question = urllib.unquote(request.body)
#    if (question.find("q=") != 0):
#        raise BadRequest("Missing q=") 
#    question = question[2:]
#    answer = handler.parseRequest(question)
#    response.body = answer + "\n\n"
#    response.content_type = "text/plain"
#    return response()

test_users = [ "ev", "tom", "mattb", "zuck" ]

@expose(r'^/test/setup/$', 'POST')
def mobwrite(request, response):
    user_manager = request.user_manager
    for name in test_users:
        user = user_manager.get_user(name)
        if (user == None):
            user = user_manager.create_user(name, name, name)
    response.body = ""
    response.content_type = "text/plain"
    return response()

@expose(r'^/test/cleanup/$', 'POST')
def mobwrite(request, response):
    response.body = ""
    response.content_type = "text/plain"
    return response()
    
@expose(r'^/vcs/(?P<project_name>.*)/', 'POST')
def vcs_command(request, response):
    user = request.user
    project_name = request.kwargs['project_name']
    request_info = simplejson.loads(request.body)
    args = request_info['command']
    
    # special support for clone/checkout
    if args[0] == "clone" \
       or (len(args) > 2 and " ".join(args[0:2]) in
       ["hg clone", "bzr clone", "git clone", "svn checkout"]):
        args.append(project_name)
        output = vcs.clone(user, args)
    
    response.content_type = "application/json"
    response.body = simplejson.dumps({'output' : output})
    return response()

def db_middleware(app):
    def wrapped(environ, start_response):
        from bespin import model
        session = c.sessionmaker(bind=c.dbengine)
        environ['bespin.dbsession'] = session
        environ['bespin.docommit'] = True
        environ['user_manager'] = model.UserManager(session)
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

def make_app():
    from webob import Response
    import static
    static_app = static.Cling(c.static_dir)
    
    docs_app = pathpopper_middleware(static.Cling(c.docs_dir))
    code_app = pathpopper_middleware(static.Cling(c.static_dir + "/js"), 2)
    
    register("^/docs/code/", code_app)
    register("^/docs/", docs_app)
    
    app = URLRelay(default=static_app)
    app = auth_tkt.AuthTKTMiddleware(app, c.secret, secure=c.secure_cookie, 
                include_ip=False, httponly=True,
                current_domain_cookie=True, wildcard_cookie=True)
    app = db_middleware(app)
    
    if c.log_requests_to_stdout:
        from paste.translogger import TransLogger
        app = TransLogger(app)
        
    return app
