Bespin Python Server
====================

This program provides the server side functionality for Bespin. Though there
is nothing Mac or Unix specific to the Bespin server, at the moment it
has only been tested on Unix-like platforms.

Understanding the Code
----------------------

The BespinServer is built entirely out of WSGI components (to see which 
packages are used, check out requirements.txt).

In development, the data is stored in an sqlite database (devdata.db).
SQLAlchemy (http://www.sqlalchemy.org) manages the persistence of the
data.

bespin/model.py contains the model objects and the "manager" objects that
know how to store and retrieve them from the database for use by the web
layer. These manager objects are inserted into the WSGI environment.

There is a very trivial "web framework" in bespin/framework.py. This provides
a simple wrapper for:

1. Handling authentication as needed (which is most URLs)
2. Providing Request and Response objects that are simpler to use than the
   standard WSGI environ, start_response parameters. These are just small
   subclasses of WebOb's Request and Response.
3. Providing a decorator that expresses which URL a given function responds
   to (wrapping the behavior of urlrelay).

Authentication is handled via Paste's AuthTKTMiddleware, which puts
an authentication token into a cookie.
   
bespin/controllers.py contains the functions that respond to the URLs. It
also contains the make_app function, which knows how to construct the WSGI
application that will appear on the web.

bespin/config.py knows how to configure the system based on "profiles"
such as "test", "dev" and "prod".

bespin/tests contains the unit tests.
