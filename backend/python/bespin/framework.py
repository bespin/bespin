#  ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
# 
# The contents of this file are subject to the Mozilla Public License  Version
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

from urlrelay import url
from webob import Request, Response
import logging

from bespin import filesystem, database, config
from bespin.__init__ import API_VERSION
from bespin.database import User

log = logging.getLogger("bespin.framework")

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
        self.kwargs = environ.get('wsgiorg.routing_args')[1]
        self.session_token = environ.get("HTTP_X_DOMAIN_TOKEN")

    @property
    def user(self):
        if self._user:
            return self._user
        if self.username:
            self._user = User.find_user(self.username)
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

def expose(url_pattern, method=None, auth=True, skip_token_check=False):
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

            config.c.stats.incr("requests_DATE")
            config.c.stats.incr("requests")

            request = BespinRequest(environ)
            response = BespinResponse(environ, start_response)
            skip_test = environ.get("BespinTestApp")

            if not skip_token_check and skip_test != "True":
                cookie_token = request.cookies.get("Domain-Token")
                header_token = environ.get("HTTP_X_DOMAIN_TOKEN")

                if cookie_token is None or header_token != cookie_token:
                    log.error("request.url=%s" % request.url)
                    log.error("cookies[Domain-Token]=%s" % cookie_token)
                    log.error("headers[X-Domain-Token]=%s" % header_token)
                    log.error("ERROR! The anti CSRF attack trip wire just went off. If you see this message and no-one is hacking you, please tell bespin-core@googlegroups.com")
                    config.c.stats.incr("csrf_fail_DATE")

            user = request.user
            _add_base_headers(response)
            try:
                return func(request, response)
            except filesystem.NotAuthorized, e:
                response.error("401 Not Authorized", e)
            except filesystem.FileNotFound, e:
                environ['bespin.good_url_but_not_found'] = True
                response.error("404 Not Found", e)
            except filesystem.FileConflict, e:
                response.error("409 Conflict", e)
            except database.ConflictError, e:
                response.error("409 Conflict", e)
            except filesystem.OverQuota, e:
                response.error("400 Bad Request", "Over quota")
            except filesystem.FSException, e:
                response.error("400 Bad Request", e)
            except filesystem.BadValue, e:
                response.error("400 Bad Request", e)
            except BadRequest, e:
                response.error("400 Bad Request", e)
            return response()
    return entangle

