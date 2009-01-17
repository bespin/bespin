import re

from repoze.who.middleware import PluggableAuthenticationMiddleware
from repoze.who.plugins.auth_tkt import AuthTktCookiePlugin
from repoze.who.classifiers import default_request_classifier
from repoze.who.classifiers import default_challenge_decider
from webob import Request, Response

from bespin.config import c

_login_path = re.compile(r'^/register/login/(?P<login_username>.*)')
_new_path = re.compile(r'^/register/new/(?P<username>.*)$')

class UserManagerPlugin(object):
    """repoze.who Authenticator plugin that uses the UserManager 
    in the environ."""
    
    def authenticate(self, environ, identity):
        try:
            username = identity['username']
            password = identity.get('password')
            user_manager = environ['user_manager']
        except KeyError:
            return None
        
        user = user_manager.get_user(username)
        if not user:
            if 'bespin.signup_in_progress' in environ:
                return username
        if user and ('bespin.got_ticket' in environ or user.password == password):
            environ['bespin.user'] = user
            return username
        else:
            return None

class UrlIdentifierPlugin(AuthTktCookiePlugin):
    """Identifies a user based on the URL."""
    
    def identify(self, environ):
        """Checks the cookie first, then checks to see if we got a username
        via the URL."""
        result = super(UrlIdentifierPlugin, self).identify(environ)
        if result:
            environ['bespin.got_ticket'] = True
        else:
            path_match = _login_path.match(environ['PATH_INFO'])
            if path_match:
                request = Request(environ)
                username = path_match.group(1)
                password = request.POST.get('password')
                return dict(username=username, password=password)
            path_match = _new_path.match(environ['PATH_INFO'])
            if path_match:
                username = path_match.group(1)
                environ['bespin.signup_in_progress'] = True
                return dict(username=username, password="")
            return None
        return result
        
class Challenger401(object):
    """Just returns a 401 status."""
    
    def challenge(self, environ, status, app_headers, forget_headers):
        if 'bespin.logout' in environ:
            response = Response(status="200 OK", body="Logged out",
                headers=forget_headers)
            response.content_type='text/plain'
        else:
            response = Response(status = '401 Authentication Required',
                            body='')
        return response

_identifiers = [('url', UrlIdentifierPlugin(c.secret))]
_authenticators = [('um', UserManagerPlugin())]
_challengers = [('c401', Challenger401())]
_mdproviders = []

def make_auth_middleware(app):
    app = PluggableAuthenticationMiddleware(
        app,
        _identifiers,
        _authenticators,
        _challengers,
        _mdproviders,
        default_request_classifier,
        default_challenge_decider
    )
    return app
    