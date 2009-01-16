# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
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
#     Bespin Team (bespin@mozilla.com)
#
# ***** END LICENSE BLOCK *****

from urlrelay import url
from webob import Request, Response

from bespin import model

class BadRequest(Exception):
    pass

class BespinRequest(Request):
    """Custom request object for Bespin.
    
    Provides the user object and the username of the
    logged in user, among other features."""
    def __init__(self, environ):
        super(BespinRequest, self).__init__(environ)
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
        
    def save_user(self):
        """Saves the current user object."""
        user = self.user
        self.user_manager.save_user(self.username, user)
        
class BespinResponse(Response):
    def __init__(self, environ, start_request, **kw):
        super(BespinResponse, self).__init__(**kw)
        self.environ = environ
        self.start_request = start_request
    
    def __call__(self):
        return super(BespinResponse, self).__call__(self.environ, self.start_request)

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
                return response(environ, start_response)
            request = BespinRequest(environ)
            response = BespinResponse(environ, start_response)
            try:
                return func(request, response)
            except model.NotAuthorized, e:
                response.status = "401 Not Authorized"
                response.body = str(e)
            except model.FileNotFound, e:
                response.status = "404 Not Found"
                response.body = str(e)
            except model.FileConflict, e:
                response.status = "409 Conflict"
                response.body = str(e)
            except model.ConflictError, e:
                response.status = "409 Conflict"
                response.body = str(e)
            except model.FSException, e:
                response.status = "400 Bad Request"
                response.body = str(e)
            except BadRequest, e:
                response.status = "400 Bad Request"
                response.body = str(e)
            return response()
    return entangle

