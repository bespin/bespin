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

from webtest import TestApp
import simplejson
from bespin import config, controllers, model
from bespin.model import get_project, File, Project, User, Connection, UserManager

session = None
user_manager = None
mattb = None
zuck = None
tom = None
ev = None
joe = None
app = None

def setup_module(module):
    config.set_profile("test")
    config.activate_profile()
    _reset()

def _reset():
    model.Base.metadata.drop_all(bind=config.c.dbengine)
    model.Base.metadata.create_all(bind=config.c.dbengine)
    fsroot = config.c.fsroot
    if fsroot.exists() and fsroot.basename() == "testfiles":
        fsroot.rmtree()
    fsroot.makedirs()

    global session
    session = config.c.sessionmaker(bind=config.c.dbengine)
    num_users = session.query(User).count()
    assert num_users == 0
    session.commit()

    global user_manager
    user_manager = UserManager(session)

    global mattb, zuck, tom, ev, joe
    mattb = user_manager.create_user("mattb", "mattb", "mattb")
    zuck = user_manager.create_user("zuck", "zuck", "zuck")
    tom = user_manager.create_user("tom", "tom", "tom")
    ev = user_manager.create_user("ev", "ev", "ev")
    joe = user_manager.create_user("joe", "joe", "joe")

    global app
    app = controllers.make_app()
    app = TestApp(app)
    app.post("/register/login/joe", dict(password="joe"))

def _followed_names(connections):
    return set([connection.followed.username for connection in connections])

def _following_names(connections):
    return set([connection.following.username for connection in connections])

def _group_names(groups):
    return set([group.name for group in groups])

def _group_member_names(group_memberships):
    return set([group_membership.user.username for group_membership in group_memberships])

# Group tests
def test_groups():
    _reset()

    assert len(user_manager.get_groups(joe)) == 0

    homies = user_manager.get_group(joe, "homies", create_on_not_found=True)
    assert _group_names(user_manager.get_groups(joe)) == set([ "homies" ])
    assert user_manager.get_groups(joe, mattb) == []

    user_manager.add_group_member(homies, mattb)
    assert _group_names(user_manager.get_groups(joe, mattb)) == set([ "homies" ])
    assert _group_member_names(user_manager.get_group_members(homies)) == set([ "mattb" ])

    user_manager.add_group_member(homies, zuck)
    user_manager.add_group_member(homies, tom)
    user_manager.add_group_member(homies, ev)
    assert _group_member_names(user_manager.get_group_members(homies)) == set([ "mattb", "zuck", "tom", "ev" ])

    deleted = user_manager.remove_group_member(homies, tom)
    assert deleted > 0
    assert _group_member_names(user_manager.get_group_members(homies)) == set([ "mattb", "zuck", "ev" ])

    deleted = user_manager.remove_group_member(homies, tom)
    assert deleted == 0
    assert _group_member_names(user_manager.get_group_members(homies)) == set([ "mattb", "zuck", "ev" ])

    deleted = user_manager.remove_all_group_members(homies)
    assert deleted > 0
    assert user_manager.get_group_members(homies) == []

    deleted = user_manager.remove_all_group_members(homies)
    assert deleted == 0
    assert user_manager.get_group_members(homies) == []

    user_manager.add_group_member(homies, mattb)
    user_manager.add_group_member(homies, zuck)
    user_manager.add_group_member(homies, tom)
    user_manager.add_group_member(homies, ev)

    deleted = user_manager.remove_group(homies)
    assert deleted > 0
    assert user_manager.get_groups(joe) == []

# Group tests
def test_groups_with_app():
    _reset()

    assert len(user_manager.get_groups(joe)) == 0

    app.get("/group/list/homies/", status=400)
    app.post("/group/add/homies/", '["mattb"]')

    homies = user_manager.get_group(joe, "homies", raise_on_not_found=True)

    assert _group_names(user_manager.get_groups(joe)) == set([ "homies" ])
    assert _group_names(user_manager.get_groups(joe, mattb)) == set([ "homies" ])
    assert _group_member_names(user_manager.get_group_members(homies)) == set([ "mattb" ])

    app.post("/group/add/homies/", '["zuck", "tom", "ev"]')
    assert _group_member_names(user_manager.get_group_members(homies)) == set([ "mattb", "zuck", "tom", "ev" ])

    response = app.post("/group/remove/homies/", '["tom"]')
    assert int(response.body) >= 1
    assert _group_member_names(user_manager.get_group_members(homies)) == set([ "mattb", "zuck", "ev" ])

    response = app.post("/group/remove/homies/", '["tom"]')
    assert response.body == "0"
    assert _group_member_names(user_manager.get_group_members(homies)) == set([ "mattb", "zuck", "ev" ])

    response = app.post("/group/remove/all/homies/")
    assert int(response.body) >= 1
    assert user_manager.get_group_members(homies) == []

    app.post("/group/remove/all/homies/", status=400)

    app.post("/group/add/homies/", '["mattb", "zuck", "tom", "ev"]')
    response = app.post("/group/remove/all/homies/")
    assert int(response.body) >= 1
    assert user_manager.get_group_members(homies) == []
    assert user_manager.get_groups(joe) == []

# Sharing tests
def test_sharing():
    _reset()

    assert len(joe.projects) == 1 # We start with a SampleProject
    joes_project = get_project(joe, joe, "joes_project", create=True)
    assert len(joe.projects) == 2
    assert user_manager.get_sharing(joe) == []

    user_manager.add_sharing(joe, joes_project, ev, False, False)
    sharing = user_manager.get_sharing(joe)
    assert sharing == [{'loadany':False, 'edit':False, 'type':'user', 'project':'joes_project', 'owner':'joe', 'recipient':'ev'}]

    # Joe has shared a project with ev but without anyone following him nothing changes
    assert len(ev.projects) == 1
    assert len(tom.projects) == 1
    assert len(user_manager.get_user_projects(ev, True)) == 1
    assert len(user_manager.get_user_projects(tom, True)) == 1
    assert len(user_manager.get_user_projects(zuck, True)) == 1
    assert len(user_manager.get_user_projects(mattb, True)) == 1

    user_manager.follow(ev, joe)

    # user.projects reports projects that the user owns, so this should not change
    assert len(ev.projects) == 1
    assert len(tom.projects) == 1

    assert len(user_manager.get_user_projects(ev, True)) == 2
    assert len(user_manager.get_user_projects(tom, True)) == 1
    assert len(user_manager.get_user_projects(zuck, True)) == 1
    assert len(user_manager.get_user_projects(mattb, True)) == 1

    # Joe's homies are mattb and zuck
    homies = user_manager.get_group(joe, "homies", create_on_not_found=True)
    user_manager.add_group_member(homies, mattb)
    user_manager.add_group_member(homies, zuck)
    user_manager.add_sharing(joe, joes_project, homies, False, False)

    # But mattb and zuck don't care they're not following joe
    assert len(user_manager.get_user_projects(ev, True)) == 2
    assert len(user_manager.get_user_projects(tom, True)) == 1
    assert len(user_manager.get_user_projects(zuck, True)) == 1
    assert len(user_manager.get_user_projects(mattb, True)) == 1

    user_manager.follow(mattb, joe)
    user_manager.follow(zuck, joe)
    assert len(user_manager.get_user_projects(ev, True)) == 2
    assert len(user_manager.get_user_projects(tom, True)) == 1
    assert len(user_manager.get_user_projects(zuck, True)) == 2
    assert len(user_manager.get_user_projects(mattb, True)) == 2

    # So now joe shares it with everyone
    user_manager.add_sharing(joe, joes_project, 'everyone', False, False)

    # Once again, tom doesn't care, because he's not following joe
    assert len(user_manager.get_user_projects(ev, True)) == 2
    assert len(user_manager.get_user_projects(tom, True)) == 1
    assert len(user_manager.get_user_projects(zuck, True)) == 2
    assert len(user_manager.get_user_projects(mattb, True)) == 2

    user_manager.follow(tom, joe)
    assert len(user_manager.get_user_projects(ev, True)) == 2
    assert len(user_manager.get_user_projects(tom, True)) == 2
    assert len(user_manager.get_user_projects(zuck, True)) == 2
    assert len(user_manager.get_user_projects(mattb, True)) == 2

    # Check that we can undo in a different order
    user_manager.remove_sharing(joe, joes_project, 'everyone')
    assert len(user_manager.get_user_projects(ev, True)) == 2
    assert len(user_manager.get_user_projects(tom, True)) == 1
    assert len(user_manager.get_user_projects(zuck, True)) == 2
    assert len(user_manager.get_user_projects(mattb, True)) == 2

    user_manager.remove_sharing(joe, joes_project, ev)
    assert len(user_manager.get_user_projects(ev, True)) == 1
    assert len(user_manager.get_user_projects(tom, True)) == 1
    assert len(user_manager.get_user_projects(zuck, True)) == 2
    assert len(user_manager.get_user_projects(mattb, True)) == 2

    user_manager.remove_sharing(joe, joes_project, homies)
    assert len(user_manager.get_user_projects(ev, True)) == 1
    assert len(user_manager.get_user_projects(tom, True)) == 1
    assert len(user_manager.get_user_projects(zuck, True)) == 1
    assert len(user_manager.get_user_projects(mattb, True)) == 1

    # Share again to check fast removal
    user_manager.add_sharing(joe, joes_project, ev, False, False)
    user_manager.add_sharing(joe, joes_project, homies, False, False)
    user_manager.add_sharing(joe, joes_project, 'everyone', False, False)

    user_manager.remove_sharing(joe, joes_project)
    assert user_manager.get_sharing(joe) == []

    assert len(user_manager.get_user_projects(tom, True)) == 1
    assert len(user_manager.get_user_projects(ev, True)) == 1

    joes_project.delete()

# Follower tests
def test_follow():
    _reset()

    # To start with no-one follows anyone else
    assert len(user_manager.users_i_follow(joe)) == 0
    assert len(user_manager.users_i_follow(mattb)) == 0
    assert len(user_manager.users_i_follow(zuck)) == 0
    assert len(user_manager.users_i_follow(tom)) == 0
    assert len(user_manager.users_i_follow(ev)) == 0
    assert len(user_manager.users_following_me(joe)) == 0
    assert len(user_manager.users_following_me(mattb)) == 0
    assert len(user_manager.users_following_me(zuck)) == 0
    assert len(user_manager.users_following_me(tom)) == 0
    assert len(user_manager.users_following_me(ev)) == 0

    # Add a single follow
    user_manager.follow(zuck, joe)
    assert len(user_manager.users_i_follow(joe)) == 0
    assert len(user_manager.users_i_follow(mattb)) == 0
    assert _followed_names(user_manager.users_i_follow(zuck)) == set([ "joe" ])
    assert len(user_manager.users_i_follow(tom)) == 0
    assert len(user_manager.users_i_follow(ev)) == 0
    assert _following_names(user_manager.users_following_me(joe)) == set([ "zuck" ])
    assert len(user_manager.users_following_me(mattb)) == 0
    assert len(user_manager.users_following_me(zuck)) == 0
    assert len(user_manager.users_following_me(tom)) == 0
    assert len(user_manager.users_following_me(ev)) == 0

    # Everyone loves joe
    user_manager.follow(mattb, joe)
    user_manager.follow(ev, joe)
    user_manager.follow(tom, joe)
    assert len(user_manager.users_i_follow(joe)) == 0
    assert _followed_names(user_manager.users_i_follow(mattb)) == set([ "joe" ])
    assert _followed_names(user_manager.users_i_follow(zuck)) == set([ "joe" ])
    assert _followed_names(user_manager.users_i_follow(tom)) == set([ "joe" ])
    assert _followed_names(user_manager.users_i_follow(ev)) == set([ "joe" ])
    assert _following_names(user_manager.users_following_me(joe)) == set([ "zuck", "mattb", "tom", "ev" ])
    assert len(user_manager.users_following_me(zuck)) == 0
    assert len(user_manager.users_following_me(mattb)) == 0
    assert len(user_manager.users_following_me(tom)) == 0
    assert len(user_manager.users_following_me(ev)) == 0

    # There is a limit to how much love though
    session.commit()
    try:
        user_manager.follow(zuck, joe)
        assert False, "Missing ConflictError"
    except model.ConflictError:
        session.rollback()
    assert len(user_manager.users_i_follow(joe)) == 0
    assert _followed_names(user_manager.users_i_follow(mattb)) == set([ "joe" ])
    assert _followed_names(user_manager.users_i_follow(zuck)) == set([ "joe" ])
    assert _followed_names(user_manager.users_i_follow(tom)) == set([ "joe" ])
    assert _followed_names(user_manager.users_i_follow(ev)) == set([ "joe" ])
    assert _following_names(user_manager.users_following_me(joe)) == set([ "zuck", "mattb", "tom", "ev" ])
    assert len(user_manager.users_following_me(mattb)) == 0
    assert len(user_manager.users_following_me(zuck)) == 0
    assert len(user_manager.users_following_me(tom)) == 0
    assert len(user_manager.users_following_me(ev)) == 0

    # Tom is a narcissist
    session.commit()
    try:
        user_manager.follow(tom, tom)
        assert False, "Missing ConflictError"
    except model.ConflictError:
        session.rollback()
    assert len(user_manager.users_i_follow(joe)) == 0
    assert _followed_names(user_manager.users_i_follow(mattb)) == set([ "joe" ])
    assert _followed_names(user_manager.users_i_follow(zuck)) == set([ "joe" ])
    assert _followed_names(user_manager.users_i_follow(tom)) == set([ "joe" ])
    assert _followed_names(user_manager.users_i_follow(ev)) == set([ "joe" ])
    assert _following_names(user_manager.users_following_me(joe)) == set([ "zuck", "mattb", "tom", "ev" ])
    assert len(user_manager.users_following_me(mattb)) == 0
    assert len(user_manager.users_following_me(zuck)) == 0
    assert len(user_manager.users_following_me(tom)) == 0
    assert len(user_manager.users_following_me(ev)) == 0

    # Make this a bit less unrequited
    user_manager.follow(joe, zuck)
    user_manager.follow(joe, tom)
    user_manager.follow(joe, mattb)
    user_manager.follow(joe, ev)
    assert len(user_manager.users_i_follow(joe)) == 4
    assert _followed_names(user_manager.users_i_follow(mattb)) == set([ "joe" ])
    assert _followed_names(user_manager.users_i_follow(zuck)) == set([ "joe" ])
    assert _followed_names(user_manager.users_i_follow(tom)) == set([ "joe" ])
    assert _followed_names(user_manager.users_i_follow(ev)) == set([ "joe" ])
    assert _following_names(user_manager.users_following_me(joe)) == set([ "zuck", "mattb", "tom", "ev" ])
    assert _following_names(user_manager.users_following_me(mattb)) == set([ "joe" ])
    assert _following_names(user_manager.users_following_me(zuck)) == set([ "joe" ])
    assert _following_names(user_manager.users_following_me(tom)) == set([ "joe" ])
    assert _following_names(user_manager.users_following_me(ev)) == set([ "joe" ])

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
    assert _followed_names(user_manager.users_i_follow(joe)) == set([ "mattb", "zuck", "tom", "ev" ])
    assert _followed_names(user_manager.users_i_follow(mattb)) == set([ "zuck", "tom", "ev", "joe" ])
    assert _followed_names(user_manager.users_i_follow(zuck)) == set([ "mattb", "tom", "ev", "joe" ])
    assert _followed_names(user_manager.users_i_follow(tom)) == set([ "mattb", "zuck", "ev", "joe" ])
    assert _followed_names(user_manager.users_i_follow(ev)) == set([ "mattb", "zuck", "tom", "joe" ])
    assert _following_names(user_manager.users_following_me(joe)) == set([ "zuck", "mattb", "tom", "ev" ])
    assert _following_names(user_manager.users_following_me(mattb)) == set([ "zuck", "tom", "ev", "joe" ])
    assert _following_names(user_manager.users_following_me(zuck)) == set([ "mattb", "tom", "ev", "joe" ])
    assert _following_names(user_manager.users_following_me(tom)) == set([ "mattb", "zuck", "ev", "joe" ])
    assert _following_names(user_manager.users_following_me(ev)) == set([ "mattb", "zuck", "tom", "joe" ])

    # The joe hate begins
    user_manager.unfollow(zuck, joe)
    user_manager.unfollow(tom, joe)
    assert _followed_names(user_manager.users_i_follow(joe)) == set([ "mattb", "zuck", "tom", "ev" ])
    assert _followed_names(user_manager.users_i_follow(mattb)) == set([ "zuck", "tom", "ev", "joe" ])
    assert _followed_names(user_manager.users_i_follow(zuck)) == set([ "mattb", "tom", "ev" ])
    assert _followed_names(user_manager.users_i_follow(tom)) == set([ "mattb", "zuck", "ev" ])
    assert _followed_names(user_manager.users_i_follow(ev)) == set([ "mattb", "zuck", "tom", "joe" ])
    assert _following_names(user_manager.users_following_me(joe)) == set([ "mattb", "ev" ])
    assert _following_names(user_manager.users_following_me(mattb)) == set([ "zuck", "tom", "ev", "joe" ])
    assert _following_names(user_manager.users_following_me(zuck)) == set([ "mattb", "tom", "ev", "joe" ])
    assert _following_names(user_manager.users_following_me(tom)) == set([ "mattb", "zuck", "ev", "joe" ])
    assert _following_names(user_manager.users_following_me(ev)) == set([ "mattb", "zuck", "tom", "joe" ])

    # The joe hate continues
    user_manager.unfollow(mattb, joe)
    user_manager.unfollow(ev, joe)
    assert _followed_names(user_manager.users_i_follow(joe)) == set([ "mattb", "zuck", "tom", "ev" ])
    assert _followed_names(user_manager.users_i_follow(mattb)) == set([ "zuck", "tom", "ev" ])
    assert _followed_names(user_manager.users_i_follow(zuck)) == set([ "mattb", "tom", "ev" ])
    assert _followed_names(user_manager.users_i_follow(tom)) == set([ "mattb", "zuck", "ev" ])
    assert _followed_names(user_manager.users_i_follow(ev)) == set([ "mattb", "zuck", "tom" ])
    assert _following_names(user_manager.users_following_me(joe)) == set([])
    assert _following_names(user_manager.users_following_me(mattb)) == set([ "zuck", "tom", "ev", "joe" ])
    assert _following_names(user_manager.users_following_me(zuck)) == set([ "mattb", "tom", "ev", "joe" ])
    assert _following_names(user_manager.users_following_me(tom)) == set([ "mattb", "zuck", "ev", "joe" ])
    assert _following_names(user_manager.users_following_me(ev)) == set([ "mattb", "zuck", "tom", "joe" ])

    # Joe: well be like that then
    user_manager.unfollow(joe, zuck)
    user_manager.unfollow(joe, tom)
    user_manager.unfollow(joe, mattb)
    user_manager.unfollow(joe, ev)
    assert _followed_names(user_manager.users_i_follow(joe)) == set([])
    assert _followed_names(user_manager.users_i_follow(mattb)) == set([ "zuck", "tom", "ev" ])
    assert _followed_names(user_manager.users_i_follow(zuck)) == set([ "mattb", "tom", "ev" ])
    assert _followed_names(user_manager.users_i_follow(tom)) == set([ "mattb", "zuck", "ev" ])
    assert _followed_names(user_manager.users_i_follow(ev)) == set([ "mattb", "zuck", "tom" ])
    assert _following_names(user_manager.users_following_me(joe)) == set([])
    assert _following_names(user_manager.users_following_me(mattb)) == set([ "zuck", "tom", "ev" ])
    assert _following_names(user_manager.users_following_me(zuck)) == set([ "mattb", "tom", "ev" ])
    assert _following_names(user_manager.users_following_me(tom)) == set([ "mattb", "zuck", "ev" ])
    assert _following_names(user_manager.users_following_me(ev)) == set([ "mattb", "zuck", "tom" ])

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

    # But there is a limit to how much you can hate
    session.commit()
    try:
        user_manager.unfollow(zuck, tom)
        assert False, "Missing ConflictError"
    except model.ConflictError:
        session.rollback()
