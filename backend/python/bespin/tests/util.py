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

import shove

from bespin import config

class TestStore(shove.SimpleBase, shove.BaseStore):
    def __init__(self, engine, **kw):
        config.c.saved_keys.clear()
        super(TestStore, self).__init__(engine, **kw)
        
    def __setitem__(self, key, value):
        super(TestStore, self).__setitem__(key, value)
        config.c.saved_keys.add(key)
        
shove.stores['bespin_test'] = 'bespin.tests.util:TestStore'
