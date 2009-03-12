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

#from webtest import TestApp
#import simplejson

from bespin import config, model
from bespin.model import User, Connection, UserManager, FileManager

def setup_module(module):
    config.set_profile("test")
    config.activate_profile()

def _clear_db():
    model.Base.metadata.drop_all(bind=config.c.dbengine)
    model.Base.metadata.create_all(bind=config.c.dbengine)

def _get_user_manager(clear=False):
    if clear:
        _clear_db()
    s = config.c.sessionmaker(bind=config.c.dbengine)
    user_manager = UserManager(s)
    file_manager = FileManager(s)
    db = model.DB(user_manager, file_manager)
    return s, user_manager

# Follower tests
def test_follow():
    s, user_manager = _get_user_manager(True)
    num_users = s.query(User).count()
    assert num_users == 0
    ev = user_manager.create_user("ev", "ev", "ev")
    tom = user_manager.create_user("tom", "tom", "tom")
    mattb = user_manager.create_user("mattb", "mattb", "mattb")
    zuck = user_manager.create_user("zuck", "zuck", "zuck")
    joe = user_manager.create_user("joe", "joe", "joe")

    # To start with no-one follows anyone else
    assert len(user_manager.users_i_follow(joe)) == 0
    assert len(user_manager.users_i_follow(zuck)) == 0
    assert len(user_manager.users_i_follow(mattb)) == 0
    assert len(user_manager.users_i_follow(tom)) == 0
    assert len(user_manager.users_i_follow(ev)) == 0
    assert len(user_manager.users_following_me(joe)) == 0
    assert len(user_manager.users_following_me(zuck)) == 0
    assert len(user_manager.users_following_me(mattb)) == 0
    assert len(user_manager.users_following_me(tom)) == 0
    assert len(user_manager.users_following_me(ev)) == 0

    # Add a single follow
    user_manager.follow(zuck, joe)
    assert len(user_manager.users_i_follow(joe)) == 0
    assert len(user_manager.users_i_follow(zuck)) == 1
    assert len(user_manager.users_i_follow(mattb)) == 0
    assert len(user_manager.users_i_follow(tom)) == 0
    assert len(user_manager.users_i_follow(ev)) == 0
    assert len(user_manager.users_following_me(joe)) == 1
    assert len(user_manager.users_following_me(zuck)) == 0
    assert len(user_manager.users_following_me(mattb)) == 0
    assert len(user_manager.users_following_me(tom)) == 0
    assert len(user_manager.users_following_me(ev)) == 0

    # Everyone loves joe
    user_manager.follow(mattb, joe)
    user_manager.follow(ev, joe)
    user_manager.follow(tom, joe)
    assert len(user_manager.users_i_follow(joe)) == 0
    assert len(user_manager.users_i_follow(zuck)) == 1
    assert len(user_manager.users_i_follow(mattb)) == 1
    assert len(user_manager.users_i_follow(tom)) == 1
    assert len(user_manager.users_i_follow(ev)) == 1
    assert len(user_manager.users_following_me(joe)) == 4
    assert len(user_manager.users_following_me(zuck)) == 0
    assert len(user_manager.users_following_me(mattb)) == 0
    assert len(user_manager.users_following_me(tom)) == 0
    assert len(user_manager.users_following_me(ev)) == 0

    # There is a limit to how much love though
    s.commit()
    try:
        user_manager.follow(zuck, joe)
        assert False, "Missing ConflictError"
    except model.ConflictError:
        s.rollback()
    assert len(user_manager.users_i_follow(joe)) == 0
    assert len(user_manager.users_i_follow(zuck)) == 1
    assert len(user_manager.users_i_follow(mattb)) == 1
    assert len(user_manager.users_i_follow(tom)) == 1
    assert len(user_manager.users_i_follow(ev)) == 1
    assert len(user_manager.users_following_me(joe)) == 4
    assert len(user_manager.users_following_me(zuck)) == 0
    assert len(user_manager.users_following_me(mattb)) == 0
    assert len(user_manager.users_following_me(tom)) == 0
    assert len(user_manager.users_following_me(ev)) == 0

    # Tom is a narcissist
    s.commit()
    try:
        user_manager.follow(tom, tom)
        assert False, "Missing ConflictError"
    except model.ConflictError:
        s.rollback()
    assert len(user_manager.users_i_follow(joe)) == 0
    assert len(user_manager.users_i_follow(zuck)) == 1
    assert len(user_manager.users_i_follow(mattb)) == 1
    assert len(user_manager.users_i_follow(tom)) == 1
    assert len(user_manager.users_i_follow(ev)) == 1
    assert len(user_manager.users_following_me(joe)) == 4
    assert len(user_manager.users_following_me(zuck)) == 0
    assert len(user_manager.users_following_me(mattb)) == 0
    assert len(user_manager.users_following_me(tom)) == 0
    assert len(user_manager.users_following_me(ev)) == 0

    # Make this a bit less unrequited
    user_manager.follow(joe, zuck)
    user_manager.follow(joe, tom)
    user_manager.follow(joe, mattb)
    user_manager.follow(joe, ev)
    assert len(user_manager.users_i_follow(joe)) == 4
    assert len(user_manager.users_i_follow(zuck)) == 1
    assert len(user_manager.users_i_follow(mattb)) == 1
    assert len(user_manager.users_i_follow(tom)) == 1
    assert len(user_manager.users_i_follow(ev)) == 1
    assert len(user_manager.users_following_me(joe)) == 4
    assert len(user_manager.users_following_me(zuck)) == 1
    assert len(user_manager.users_following_me(mattb)) == 1
    assert len(user_manager.users_following_me(tom)) == 1
    assert len(user_manager.users_following_me(ev)) == 1

    # A love in
    user_manager.follow(zuck, tom)
    user_manager.follow(zuck, mattb)
    user_manager.follow(zuck, ev)
    user_manager.follow(tom, zuck)
    user_manager.follow(tom, mattb)
    user_manager.follow(tom, ev)
    user_manager.follow(mattb, zuck)
    user_manager.follow(mattb, tom)
    user_manager.follow(mattb, ev)
    user_manager.follow(ev, zuck)
    user_manager.follow(ev, tom)
    user_manager.follow(ev, mattb)
    assert len(user_manager.users_i_follow(joe)) == 4
    assert len(user_manager.users_i_follow(zuck)) == 4
    assert len(user_manager.users_i_follow(mattb)) == 4
    assert len(user_manager.users_i_follow(tom)) == 4
    assert len(user_manager.users_i_follow(ev)) == 4
    assert len(user_manager.users_following_me(joe)) == 4
    assert len(user_manager.users_following_me(zuck)) == 4
    assert len(user_manager.users_following_me(mattb)) == 4
    assert len(user_manager.users_following_me(tom)) == 4
    assert len(user_manager.users_following_me(ev)) == 4

    # The joe hate begins
    user_manager.unfollow(zuck, joe)
    user_manager.unfollow(tom, joe)
    assert len(user_manager.users_i_follow(joe)) == 4
    assert len(user_manager.users_i_follow(zuck)) == 3
    assert len(user_manager.users_i_follow(mattb)) == 4
    assert len(user_manager.users_i_follow(tom)) == 3
    assert len(user_manager.users_i_follow(ev)) == 4
    assert len(user_manager.users_following_me(joe)) == 2
    assert len(user_manager.users_following_me(zuck)) == 4
    assert len(user_manager.users_following_me(mattb)) == 4
    assert len(user_manager.users_following_me(tom)) == 4
    assert len(user_manager.users_following_me(ev)) == 4

    # The joe hate continues
    user_manager.unfollow(mattb, joe)
    user_manager.unfollow(ev, joe)
    assert len(user_manager.users_i_follow(joe)) == 4
    assert len(user_manager.users_i_follow(zuck)) == 3
    assert len(user_manager.users_i_follow(mattb)) == 3
    assert len(user_manager.users_i_follow(tom)) == 3
    assert len(user_manager.users_i_follow(ev)) == 3
    assert len(user_manager.users_following_me(joe)) == 0
    assert len(user_manager.users_following_me(zuck)) == 4
    assert len(user_manager.users_following_me(mattb)) == 4
    assert len(user_manager.users_following_me(tom)) == 4
    assert len(user_manager.users_following_me(ev)) == 4

    # Joe: well be like that then
    user_manager.unfollow(joe, zuck)
    user_manager.unfollow(joe, tom)
    user_manager.unfollow(joe, mattb)
    user_manager.unfollow(joe, ev)
    assert len(user_manager.users_i_follow(joe)) == 0
    assert len(user_manager.users_i_follow(zuck)) == 3
    assert len(user_manager.users_i_follow(mattb)) == 3
    assert len(user_manager.users_i_follow(tom)) == 3
    assert len(user_manager.users_i_follow(ev)) == 3
    assert len(user_manager.users_following_me(joe)) == 0
    assert len(user_manager.users_following_me(zuck)) == 3
    assert len(user_manager.users_following_me(mattb)) == 3
    assert len(user_manager.users_following_me(tom)) == 3
    assert len(user_manager.users_following_me(ev)) == 3

    # And we all throw our toys out of the pram
    user_manager.unfollow(zuck, tom)
    user_manager.unfollow(zuck, mattb)
    user_manager.unfollow(zuck, ev)
    user_manager.unfollow(tom, zuck)
    user_manager.unfollow(tom, mattb)
    user_manager.unfollow(tom, ev)
    user_manager.unfollow(mattb, zuck)
    user_manager.unfollow(mattb, tom)
    user_manager.unfollow(mattb, ev)
    user_manager.unfollow(ev, zuck)
    user_manager.unfollow(ev, tom)
    user_manager.unfollow(ev, mattb)
    assert len(user_manager.users_i_follow(joe)) == 0
    assert len(user_manager.users_i_follow(zuck)) == 0
    assert len(user_manager.users_i_follow(mattb)) == 0
    assert len(user_manager.users_i_follow(tom)) == 0
    assert len(user_manager.users_i_follow(ev)) == 0
    assert len(user_manager.users_following_me(joe)) == 0
    assert len(user_manager.users_following_me(zuck)) == 0
    assert len(user_manager.users_following_me(mattb)) == 0
    assert len(user_manager.users_following_me(tom)) == 0
    assert len(user_manager.users_following_me(ev)) == 0

