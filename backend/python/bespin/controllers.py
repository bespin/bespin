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
from datetime import date

from urlrelay import URLRelay, url, register
from paste.auth import auth_tkt
import simplejson
import tempfile
from webob import Request, Response

from bespin.config import c
from bespin.framework import expose, BadRequest
from bespin import model, vcs
from bespin.model import NotAuthorized
from bespin.mobwrite.mobwrite_daemon import MobwriteWorker
from bespin.mobwrite.mobwrite_daemon import Persister
import socket
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
    parts = result[0].partition('+')
    if parts[1] == '':
        result.insert(0, request.user)
    else:
        result.insert(0, request.user_manager.get_user(parts[0]))
        result[1] = parts[2]
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

    owner, project, path = _split_path(request)
    project = model.get_project(user, owner, project, create=True, user_manager=request.user_manager)

    if path:
        project.save_file(path, request.body)
    return response()

@expose(r'^/file/at/(?P<path>.*)$', 'GET')
def getfile(request, response):
    user = request.user

    owner, project, path = _split_path(request)
    project = model.get_project(user, owner, project, user_manager=request.user_manager)

    mode = request.GET.get('mode', 'rw')
    contents = project.get_file(path, mode)
    response.body = contents
    return response()

@expose(r'^/file/close/(?P<path>.*)$', 'POST')
def postfile(request, response):
    user = request.user

    owner, project, path = _split_path(request)
    project = model.get_project(user, owner, project, user_manager=request.user_manager)

    project.close(path)
    return response()

@expose(r'^/file/at/(?P<path>.*)$', 'DELETE')
def deletefile(request, response):
    user = request.user

    owner, project, path = _split_path(request)
    project = model.get_project(user, owner, project, user_manager=request.user_manager)

    project.delete(path)
    return response()

@expose(r'^/file/list/(?P<path>.*)$', 'GET')
def listfiles(request, response):
    user = request.user
    path = request.kwargs['path']
    result = []

    if not path:
        projects = request.user_manager.get_user_projects(user, True)
        for project in projects:
            if project.owner == user:
                result.append({ 'name':project.short_name })
            else:
                result.append({ 'name':project.owner.username + "+" + project.short_name })
    else:
        try:
            owner, project, path = _split_path(request)
        except BadRequest:
            project = path
            path = ''

        if project:
            project = model.get_project(user, owner, project, user_manager=request.user_manager)

        files = project.list_files(path)

        for item in files:
            reply = { 'name':item.short_name }
            _populate_stats(item, reply)
            result.append(reply)

    return _respond_json(response, result)

@expose(r'^/project/template/(?P<project_name>.*)/$', 'POST')
def install_template(request, response):
    user = request.user
    project_name = request.kwargs['project_name']
    template_name = request.body
    project = model.get_project(user, user, project_name, create=True)
    project.install_template(template_name)
    response.content_type = "text/plain"
    response.body = ""
    return response()

@expose(r'^/file/list_all/(?P<project_name>.*)/$', 'GET')
def file_list_all(request, response):
    user = request.user
    project_name = request.kwargs['project_name']
    project = model.get_project(user, user, project_name)
    metadata = project.metadata

    files = metadata.get_file_list()
    metadata.close()
    
    return _respond_json(response, files)

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
    return _respond_json(response, result)

def _populate_stats(item, result):
    if isinstance(item, model.File):
        result['size'] = item.saved_size
        result['created'] = item.created.strftime("%Y%m%dT%H%M%S")
        result['modified'] = item.modified.strftime("%Y%m%dT%H%M%S")
        result['openedBy'] = [username for username in item.users]
    
@expose(r'^/file/stats/(?P<path>.+)$', 'GET')
def filestats(request, response):
    user = request.user

    owner, project, path = _split_path(request)
    project = model.get_project(user, owner, project, user_manager=request.user_manager)

    file_obj = project.get_file_object(path)
    result = {}
    _populate_stats(file_obj, result)
    return _respond_json(response, result)

# Edits may be changing with collab. Commented out for now
# DELETE once we know these are done...

# @expose(r'^/edit/at/(?P<path>.*)$', 'PUT')
# def save_edit(request, response):
#     user = request.user
#
#     owner, project, path = _split_path(request)
#     project = model.get_project(user, owner, project, create=True, user_manager=request.user_manager)
#
#     fm.save_edit(user, project, path, request.body)
#     return response()
#
# def _get_edit_list(request, response, start_at=0):
#     fm = request.file_manager
#     user = request.user
#
#     owner, project, path = _split_path(request)
#     project = fm.get_project(user, owner, project, user_manager=request.user_manager)
#
#     edits = fm.list_edits(user, project, path, start_at)
#     return _respond_json(response, edits)
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
#     owner, project, path = _split_path(request)
#     project = fm.get_project(user, owner, project, user_manager=request.user_manager)
#     
#     fm.reset_edits(user, project, path)
#     return response()

@expose(r'^/(?P<filename>editor|dashboard)\.html', 'GET', auth=False, skip_token_check=True)
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
        
    # check the content length to see if the user has enough quota
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
    
    owner, project, path = _split_path(request)
    project = model.get_project(user, owner, project, user_manager=request.user_manager)
    
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
def group_list_all(request, response):
    groups = request.user_manager.get_groups(request.user)
    groups = [ group.name for group in groups ]
    return _respond_json(response, groups)

@expose(r'^/group/list/(?P<group>[^/]+)/$', 'GET')
def group_list(request, response):
    group_name = request.kwargs['group']
    group = request.user_manager.get_group(request.user, group_name, raise_on_not_found=True)
    members = request.user_manager.get_group_members(group)
    members = [ member.user.username for member in members ]
    return _respond_json(response, members)

@expose(r'^/group/remove/all/(?P<group>[^/]+)/$', 'POST')
def group_remove_all(request, response):
    group_name = request.kwargs['group']
    group = request.user_manager.get_group(request.user, group_name, raise_on_not_found=True)
    rows = 0
    rows += request.user_manager.remove_all_group_members(group)
    rows += request.user_manager.remove_group(group)
    return _respond_json(response, rows)

@expose(r'^/group/remove/(?P<group>[^/]+)/$', 'POST')
def group_remove(request, response):
    group_name = request.kwargs['group']
    group = request.user_manager.get_group(request.user, group_name, raise_on_not_found=True)
    users = _lookup_usernames(request.user_manager, simplejson.loads(request.body))
    rows = 0
    for other_user in users:
        rows += request.user_manager.remove_group_member(group, other_user)
    members = request.user_manager.get_group_members(group)
    if len(members) == 0:
        rows += request.user_manager.remove_group(group)
    return _respond_json(response, rows)

@expose(r'^/group/add/(?P<group>[^/]+)/$', 'POST')
def group_add(request, response):
    group_name = request.kwargs['group']
    group = request.user_manager.get_group(request.user, group_name, create_on_not_found=True)
    users = _lookup_usernames(request.user_manager, simplejson.loads(request.body))
    for other_user in users:
        request.user_manager.add_group_member(group, other_user)
    return _respond_blank(response)

def _respond_blank(response):
    response.body = ""
    response.content_type = "text/plain"
    return response()

def _respond_json(response, data):
    response.body = simplejson.dumps(data)
    response.content_type = "application/json"
    return response()

def _lookup_usernames(user_manager, usernames):
    def lookup_username(username):
        user = user_manager.get_user(username)
        if user == None:
            raise BadRequest("Username not found: %s" % username)
        return user
    return map(lookup_username, usernames)

def _users_followed_response(user_manager, user, response):
    list = user_manager.users_i_follow(user)
    list = [connection.followed.username for connection in list]
    response.body = simplejson.dumps(list)
    response.content_type = "text/plain"
    return response()

@expose(r'^/share/list/all/$', 'GET')
def share_list_all(request, response):
    "List all project shares"
    data = request.user_manager.get_sharing(request.user)
    return _respond_json(response, data)

@expose(r'^/share/list/(?P<project>[^/]+)/$', 'GET')
def share_list_project(request, response):
    "List sharing for a given project"
    project = model.get_project(request.user, request.user, request.kwargs['project'])
    data = request.user_manager.get_sharing(request.user, project)
    return _respond_json(response, data)

@expose(r'^/share/list/(?P<project>[^/]+)/(?P<member>[^/]+)/$', 'GET')
def share_list_project_member(request, response):
    "List sharing for a given project and member"
    project = model.get_project(request.user, request.user, request.kwargs['project'])
    member = request.user_manager.find_member(request.user, request.kwargs['member'])
    data = request.user_manager.get_sharing(request.user, project, member)
    return _respond_json(response, data)

@expose(r'^/share/remove/(?P<project>[^/]+)/all/$', 'POST')
def share_remove_all(request, response):
    "Remove all sharing from a project"
    project = model.get_project(request.user, request.user, request.kwargs['project'])
    data = request.user_manager.remove_sharing(request.user, project)
    return _respond_json(response, data)

@expose(r'^/share/remove/(?P<project>[^/]+)/(?P<member>[^/]+)/$', 'POST')
def share_remove(request, response):
    "Remove project sharing from a given member"
    project = model.get_project(request.user, request.user, request.kwargs['project'])
    member = request.user_manager.find_member(request.user, request.kwargs['member'])
    data = request.user_manager.remove_sharing(request.user, project, member)
    return _respond_json(response, data)

@expose(r'^/share/add/(?P<project>[^/]+)/(?P<member>[^/]+)/$', 'POST')
def share_add(request, response):
    "Add a member to the sharing list for a project"
    project = model.get_project(request.user, request.user, request.kwargs['project'])
    member = request.user_manager.find_member(request.user, request.kwargs['member'])
    options = simplejson.loads(request.body)
    request.user_manager.add_sharing(request.user, project, member, options)
    return _respond_blank(response)

@expose(r'^/viewme/list/all/$', 'GET')
def viewme_list_all(request, response):
    "List all the members with view settings on me"
    data = request.user_manager.get_viewme(request.user)
    return _respond_json(response, data)

@expose(r'^/viewme/list/(?P<member>[^/]+)/$', 'GET')
def viewme_list(request, response):
    "List the view settings for a given member"
    member = request.user_manager.find_member(request.user, request.kwargs['member'])
    data = request.user_manager.get_viewme(request.user, member)
    return _respond_json(response, data)

@expose(r'^/viewme/set/(?P<member>[^/]+)/(?P<value>[^/]+)/$', 'POST')
def viewme_set(request, response):
    "Alter the view setting for a given member"
    member = request.user_manager.find_member(request.user, request.kwargs['member'])
    value = request.kwargs['value']
    data = request.user_manager.set_viewme(request.user, member, value)
    return _respond_json(response, data)

class InProcessMobwriteWorker(MobwriteWorker):
    "Talk to an in-process mobwrite"

    def __init__(self, user_manager):
        persister = Persister()
        MobwriteWorker.__init__(self, persister)

    def processRequest(self, question):
        "Since we are a MobWriteWorker we just call directly into mobwrite code"
        answer = self.parseRequest(question)
        from bespin.mobwrite.mobwrite_daemon import maybe_cleanup
        maybe_cleanup()
        return answer

class MobwriteWorkerProxy():
    "Talk to mobwrite using port 3017"

    def processRequest(self, question):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(("localhost", 3017))
        s.send(question)
        answer = ''
        while True:
            line = s.recv(1024)
            if not line:
                break
            answer += line
        s.close()
        return answer

@expose(r'^/mobwrite/$', 'POST')
def mobwrite(request, response):
    """Handle a request for mobwrite synchronization.

    We talk to mobwrite either in-process for development or using a socket
    which would be more common in live."""
    question = urllib.unquote(request.body)
    # Hmmm do we need to handle 'p' requests? q.py does.
    mode = None
    if question.find("p=") == 0:
        mode = "script"
    elif question.find("q=") == 0:
        mode = "text"
    else:
        raise BadRequest("Missing q= or p=")
    question = question[2:]

    question = "H:" + str(request.user.username) + "\n" + question

    # TODO: select the implementation based on a runtime flag
    worker = InProcessMobwriteWorker(request.user_manager)
    #worker = MobwriteWorkerProxy()
    answer = worker.processRequest(question)

    if mode == "text":
        response.body = answer + "\n\n"
        response.content_type = "text/plain"
    else:
        answer = answer.replace("\\", "\\\\").replace("\"", "\\\"")
        answer = answer.replace("\n", "\\n").replace("\r", "\\r")
        answer = "mobwrite.callback(\"%s\");" % answer
        response.body = answer
        response.content_type = "application/javascript"
    return response()


test_users = [ "ev", "tom", "mattb", "zuck" ]

@expose(r'^/test/setup/$', 'POST')
def test_setup(request, response):
    user_manager = request.user_manager
    for name in test_users:
        user = user_manager.get_user(name)
        if (user == None):
            user = user_manager.create_user(name, name, name)
    response.body = ""
    response.content_type = "text/plain"
    return response()

@expose(r'^/test/cleanup/$', 'POST')
def test_cleanup(request, response):
    response.body = ""
    response.content_type = "text/plain"
    return response()
    
@expose(r'^/vcs/clone/$', 'POST')
def vcs_clone(request, response):
    user = request.user
    source = request.POST.get("source")
    taskname = "Clone/checkout"
    if source:
         taskname += " from %s" % (source)
    jobid = vcs.clone(user, **dict(request.POST))
    response.content_type = "application/json"
    response.body = simplejson.dumps(dict(jobid=jobid, taskname=taskname))
    return response()
    
@expose(r'^/vcs/command/(?P<project_name>.*)/$', 'POST')
def vcs_command(request, response):
    user = request.user
    project_name = request.kwargs['project_name']
    request_info = simplejson.loads(request.body)
    args = request_info['command']
    kcpass = request_info.get('kcpass')
    
    try:
        taskname = "vcs %s command" % (args[0])
    except IndexError:
        taskname = "vcs command"
    
    # special support for clone/checkout
    if vcs.is_new_project_command(args):
        raise BadRequest("Use /vcs/clone/ to create a new project")
    else:
        project = model.get_project(user, user, project_name)
        jobid = vcs.run_command(user, project, args, kcpass)
    
    response.content_type = "application/json"
    response.body = simplejson.dumps(dict(jobid=jobid, taskname=taskname))
    return response()

@expose(r'^/vcs/remoteauth/(?P<project_name>.*)/$', 'GET')
def vcs_remoteauth(request, response):
    user = request.user
    project_name = request.kwargs['project_name']
    
    project = model.get_project(user, user, project_name)
    metadata = project.metadata
    value = metadata.get(vcs.AUTH_PROPERTY, "")
    
    response.content_type = "text/plain"
    response.body = value.encode("utf8")
    return response()

@expose(r'^/vcs/setauth/(?P<project_name>.*)/$', 'POST')
def keychain_setauth(request, response):
    user = request.user
    project_name = request.kwargs['project_name']
    project = model.get_project(user, user, project_name)
    
    try:
        kcpass = request.POST['kcpass']
        atype = request.POST['type']
        remote_auth = request.POST['remoteauth']
    except KeyError:
        raise BadRequest("Request must include kcpass, type and remoteauth.")
        
    if remote_auth != vcs.AUTH_WRITE and remote_auth != vcs.AUTH_BOTH:
        raise BadRequest("Remote auth type must be %s or %s" % 
                        (vcs.AUTH_WRITE, vcs.AUTH_BOTH))
    keychain = vcs.KeyChain(user, kcpass)
    
    body = ""
    
    if atype == "password":
        try:
            username = request.POST['username']
            password = request.POST['password']
        except KeyError:
            raise BadRequest("Request must include username and password")
        
        keychain.set_credentials_for_project(project, remote_auth, username, 
                                             password)
    elif atype == "ssh":
        # set the project to use the SSH key and return the public key
        body = keychain.set_ssh_for_project(project, remote_auth)[0]
    else:
        raise BadRequest("auth type must be ssh or password")
        
    response.content_type = "application/json"
    response.body = body
    return response()
    
@expose("^/vcs/getkey/$", 'POST')
def get_ssh_key(request, response):
    user = request.user
    try:
        kcpass = request.POST['kcpass']
    except KeyError:
        kcpass = None
        
    if kcpass is None:
        pubkey = vcs.KeyChain.get_ssh_public_key(user)
    else:
        keychain = vcs.KeyChain(user, kcpass)
        pubkey = keychain.get_ssh_key()[0]
        
    response.content_type = "application/x-ssh-key"
    response.body = pubkey
    return response()

@expose("^/messages/$", 'POST')
def messages(request, response):
    user = request.user
    user_manager = request.user_manager
    messages = user_manager.pop_messages(user)
    body = u"[" + ",".join(messages) + \
            "]"
    
    response.content_type = "application/json"
    response.body = body.encode("utf8")
    return response()
    
@expose('^/stats/$', 'GET')
def stats(request, response):
    username = request.username
    if username not in c.stats_users:
        raise NotAuthorized("Not allowed to access stats")
    today = date.today().strftime("%Y%m%d")
    keys = ["exceptions_" + today,
           'requests_' + today,
           'users',
           'files',
           'projects',
           'vcs_' + today]
    more_keys = [k.replace("_DATE", "_" + today) for k in c.stats_display]
    keys.extend(more_keys)
    result = c.stats.multiget(keys)
    response.content_type = "application/json"
    response.body = simplejson.dumps(result)
    return response()

def db_middleware(app):
    def wrapped(environ, start_response):
        from bespin import model
        from sqlalchemy.orm import scoped_session
        session = c.session_factory()
        environ['bespin.dbsession'] = session
        environ['bespin.docommit'] = True
        environ['user_manager'] = model.UserManager(session)
        try:
            # If you need to work out what <script> tags to insert into a
            # page to get Dojo to behave properly, then uncomment these 3
            # path_info = environ["PATH_INFO"]
            # if path_info.endswith(".js"):
            #     print "<script type='text/javascript' src='%s'></script>" % path_info

            result = app(environ, start_response)
            if result == None:
                log.error("WSGI response == None")
            if environ['bespin.docommit']:
                session.commit()
            else:
                session.rollback()
        except:
            session.rollback()
            c.stats.incr("exceptions_DATE")
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
