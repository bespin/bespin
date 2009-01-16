from urlrelay import URLRelay, url
import simplejson

from bespin.config import c
from bespin.auth import make_auth_middleware
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
    response.content_type = "application/json"
    response.body = simplejson.dumps(dict(project=user.private_project))
    request.environ['REMOTE_USER'] = username
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
    request.environ['bespin.logout'] = True
    response.status='401 Unauthorized'
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
    app = make_auth_middleware(app)
    app = db_middleware(app)
    
    app = Cascade([app, static_app])
    
    return app
