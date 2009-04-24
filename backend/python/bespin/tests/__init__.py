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

from webtest import TestApp

class BespinTestApp(TestApp):
    def _make_environ(self, extra_environ=None):
        environ = super(BespinTestApp, self)._make_environ(extra_environ)
        environ["HTTP_DOMAIN_TOKEN"] = "anti-csrf"
        environ["HTTP_COOKIE"] = "Domain-Token=anti-csrf"
        environ["BespinTestApp"] = "True"
        return environ
