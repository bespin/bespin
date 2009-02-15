Welcome to Bespin!
------------------

Bespin is a Mozilla Labs experiment on how to build an extensible Web code 
editor using HTML 5 technology.

Project home page: http://labs.mozilla.com/projects/bespin/
Live system: https://bespin.mozilla.com/


Thanks for downloading the code to the Bespin project. You can easily get 
Bespin running on your local Mac or Linux machine (see note about Windows 
below).

To run Bespin locally, go to backend/python and take a look at the 
README.txt file there.

Contributing to Bespin
----------------------

Bespin is using the Mercurial distributed version control system. The public 
repository is:

http://hg.mozilla.org/labs/bespin/

Since Mercurial is a distributed version control system, you've got three 
options for getting code changes to us:

1. have a public hg repository of your own that you can point us to
2. create a patch for your changes
3. create a "bundle" for your changes (a bundle is a mercurial-specific 
   format that includes every commit, rather than just a snapshot of 
   the difference)

You can submit the enhancements as an attachment in Bugzilla:

https://bugzilla.mozilla.org/enter_bug.cgi?product=Mozilla%20Labs&component=Bespin

(This is the "Report a bug" link on the project homepage, so you don't need to remember
that URL.)


Note about running on Windows
-----------------------------

The current, up-to-date Bespin backend is written in Python. Because Python is cross-platform, it should be possible (and likely not too difficult) to make the backend work on Windows once Python 2.5 is installed. However, this has not been tested and there are likely two issues:

1. some libraries used by Bespin try to compile C code
2. some paths may not be correct on Windows systems

