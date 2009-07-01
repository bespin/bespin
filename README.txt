Welcome to Bespin!
------------------

Bespin is a Mozilla Labs experiment on how to build an extensible Web code 
editor using HTML 5 technology.

Project home page: http://labs.mozilla.com/projects/bespin/
Live system: https://bespin.mozilla.com/

Thanks for downloading the code to the Bespin project. You can easily get 
Bespin's Python server running on your local Mac or Linux machine (see note 
about Windows below).

Getting Started
---------------

*** NOTE FOR LINUX USERS: If you are running on a Linux system, you will 
likely need a "python-dev" (on Ubuntu, possibly python-devel elsewhere) 
package installed and either the libc-dev or libc6-dev package, if you 
do not already have them.

*** NOTE FOR MAC USERS: If you put your Bespin checkout in a directory
that has a space in the directory name, the bootstrap script will fail
with an error "no such file or directory" because there will be
scripts generated with an invalid shebang (#!) line.

Run::

  python bootstrap.py --no-site-packages
  
to get the environment set up. This is built around virtualenv. All of the
required packages will automatically be installed. Once this is set up,
you can run::

  source bin/activate
  
to enter the virtualenv. Alternatively, you can just prefix the commands you
run with "bin/". If you wish to restore your command line environment,
you can type "deactivate".

The first time around, you'll need to download Dojo and create the database::

  paver dojo create_db

You can start up the development server (runs on localhost:8080) by running::

  paver start

You can run the unit tests by running::

  nosetests backend/python/bespin

Updating the Required Files
---------------------------

If the "requirements.txt" file changes, you can re-install the
required packages by running::

  paver required
  
You can also force upgrade all of the packages like so::

  pip install -U -r requirements.txt

More Documentation
------------------

Documentation for Bespin's code and APIs are actually part of every
instance of the Bespin server. To view the docs on your local instance, just
browse to http://127.0.0.1:8080/docs/.

Contributing to Bespin
----------------------

For details see:
  https://wiki.mozilla.org/Labs/Bespin/Contributing

The source repository is in Mercurial at:
  http://hg.mozilla.org/labs/bespin/

Note about running on Windows
-----------------------------

The current, up-to-date Bespin backend is written in Python. Because
Python is cross-platform, it should be possible (and likely not too
difficult) to make the backend work on Windows once Python 2.5 is
installed. However, this has not been tested and there are likely two
issues:

1. some libraries used by Bespin try to compile C code (*)
2. some paths may not be correct on Windows systems

Microsoft offers free command line compilers that work well with
Python.