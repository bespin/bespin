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

from urlrelay import url
from webob import Request, Response

from bespin import model, config, API_VERSION

class BadRequest(Exception):
    pass

class BespinRequest(Request):
    """Custom request object for Bespin.
    
    Provides the user object and the username of the
    logged in user, among other features."""
    def __init__(self, environ):
        super(BespinRequest, self).__init__(environ)
        self.session = self.environ['bespin.dbsession']
        
        if 'bespin.user' in environ:
            self._user = environ['bespin.user']
        else:
            self._user = None
        self.username = environ.get('REMOTE_USER')
        self.user_manager = self.environ['user_manager']
        self.file_manager = self.environ['file_manager']
        self.kwargs = environ.get('wsgiorg.routing_args')[1]
        
    @property
    def user(self):
        if self._user:
            return self._user
        if self.username:
            self._user = self.user_manager.get_user(self.username)
            return self._user
        return None
        
class BespinResponse(Response):
    def __init__(self, environ, start_request, **kw):
        super(BespinResponse, self).__init__(**kw)
        self.environ = environ
        self.start_request = start_request
    
    def __call__(self):
        return super(BespinResponse, self).__call__(self.environ, self.start_request)
        
    def error(self, status, e):
        self.status = status
        self.body = str(e)
        self.environ['bespin.docommit'] = False

def _add_base_headers(response):
    response.headers['X-Bespin-API'] = API_VERSION
    response.headers['Cache-Control'] = "no-store, no-cache, must-revalidate, post-check=0, pre-check=0, private"
    response.headers['Pragma'] = "no-cache"

def expose(url_pattern, method=None, auth=True):
    """Expose this function to the world, matching the given URL pattern
    and, optionally, HTTP method. By default, the user is required to
    be authenticated. If auth is False, the user is not required to be
    authenticated."""
    def entangle(func):
        @url(url_pattern, method)
        def wrapped(environ, start_response):
            if auth and 'REMOTE_USER' not in environ:
                response = Response(status='401')
                _add_base_headers(response)
                return response(environ, start_response)
            request = BespinRequest(environ)
            response = BespinResponse(environ, start_response)
            _add_base_headers(response)
            try:
                return func(request, response)
            except model.NotAuthorized, e:
                response.error("401 Not Authorized", e)
            except model.FileNotFound, e:
                environ['bespin.good_url_but_not_found'] = True
                response.error("404 Not Found", e)
            except model.FileConflict, e:
                response.error("409 Conflict", e)
            except model.ConflictError, e:
                response.error("409 Conflict", e)
            except model.OverQuota, e:
                response.error("400 Bad Request", "Over quota")
            except model.FSException, e:
                response.error("400 Bad Request", e)
            except model.BadValue, e:
                response.error("400 Bad Request", e)
            except BadRequest, e:
                response.error("400 Bad Request", e)
            return response()
    return entangle
    