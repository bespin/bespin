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
from datetime import date

from bespin import stats

def test_stats_operations():
    ms = stats.MemoryStats()
    result = ms.incr("foo")
    assert result == 1
    result = ms.decr("foo")
    assert result == 0
    
    result = ms.incr("foo", 100)
    assert result == 100
    
    result = ms.incr("foo_DATE", 100)
    
    datekey = "foo_" + date.today().strftime("%Y%m%d")
    assert datekey in ms.storage
    
    result = ms.multiget(['foo', datekey])
    assert result == {'foo':100, datekey:100}
    