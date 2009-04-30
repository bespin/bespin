#  ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
# 
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
# 
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
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

import simplejson
from bespin import config, controllers, model
from bespin.model import get_project, File, Project, User, Connection, UserManager

from nose.tools import assert_equals
from __init__ import BespinTestApp

session = None
user_manager = None
mattb = None
zuck = None
tom = None
ev = None
joe = None
app = None
group = None

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
    session = config.c.session_factory()
    num_users = session.query(User).count()
    assert_equals(num_users, 0)
    session.commit()

    global user_manager
    user_manager = UserManager()

    global mattb, zuck, tom, ev, joe
    mattb = user_manager.create_user("mattb", "mattb", "mattb")
    zuck = user_manager.create_user("zuck", "zuck", "zuck")
    tom = user_manager.create_user("tom", "tom", "tom")
    ev = user_manager.create_user("ev", "ev", "ev")
    joe = user_manager.create_user("joe", "joe", "joe")
    group = joe.add_group("group")
    user_manager.add_group_member(group, mattb)
    user_manager.add_group_member(group, zuck)
    user_manager.add_group_member(group, tom)
    user_manager.add_group_member(group, ev)

    global app
    app = controllers.make_app()
    app = BespinTestApp(app)
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

    assert_equals(len(user_manager.get_groups(joe)), 1)

    homies = joe.get_group("homies", create_on_not_found=True)
    assert_equals(_group_names(user_manager.get_groups(joe)), set([ "homies", "group" ]))
    assert_equals(_group_names(user_manager.get_groups(joe, mattb)), set([ "group" ]))

    user_manager.add_group_member(homies, mattb)
    assert_equals(_group_names(user_manager.get_groups(joe, mattb)), set([ "homies", "group" ]))
    assert_equals(_group_member_names(user_manager.get_group_members(homies)), set([ "mattb" ]))

    user_manager.add_group_member(homies, zuck)
    user_manager.add_group_member(homies, tom)
    user_manager.add_group_member(homies, ev)
    assert_equals(_group_member_names(user_manager.get_group_members(homies)), set([ "mattb", "zuck", "tom", "ev" ]))

    deleted = user_manager.remove_group_member(homies, tom)
    assert deleted > 0
    assert_equals(_group_member_names(user_manager.get_group_members(homies)), set([ "mattb", "zuck", "ev" ]))

    deleted = user_manager.remove_group_member(homies, tom)
    assert_equals(deleted, 0)
    assert_equals(_group_member_names(user_manager.get_group_members(homies)), set([ "mattb", "zuck", "ev" ]))

    deleted = user_manager.remove_all_group_members(homies)
    assert deleted > 0
    assert_equals(user_manager.get_group_members(homies), [])

    deleted = user_manager.remove_all_group_members(homies)
    assert_equals(deleted, 0)
    assert_equals(user_manager.get_group_members(homies), [])

    user_manager.add_group_member(homies, mattb)
    user_manager.add_group_member(homies, zuck)
    user_manager.add_group_member(homies, tom)
    user_manager.add_group_member(homies, ev)

    session.commit()
    try:
        user_manager.add_group_member(homies, joe)
        assert False, "Missing ConflictError"
    except model.ConflictError:
        session.rollback()

    deleted = user_manager.remove_group(homies)
    assert deleted > 0
    assert_equals(_group_names(user_manager.get_groups(joe)), set([ "group" ]))

# Group tests
def _test_groups_with_app():
    _reset()

    assert_equals(len(user_manager.get_groups(joe)), 1)

    app.get("/group/list/homies/", status=409)
    app.post("/group/add/homies/", '["mattb"]')

    homies = joe.get_group("homies", raise_on_not_found=True)

    assert_equals(_group_names(user_manager.get_groups(joe)), set([ "homies", "group" ]))
    assert_equals(_group_names(user_manager.get_groups(joe, mattb)), set([ "homies" ]))
    assert_equals(_group_member_names(user_manager.get_group_members(homies)), set([ "mattb" ]))

    app.post("/group/add/homies/", '["zuck", "tom", "ev"]')
    assert_equals(_group_member_names(user_manager.get_group_members(homies)), set([ "mattb", "zuck", "tom", "ev" ]))

    response = app.post("/group/remove/homies/", '["tom"]')
    assert int(response.body) >= 1
    assert_equals(_group_member_names(user_manager.get_group_members(homies)), set([ "mattb", "zuck", "ev" ]))

    response = app.post("/group/remove/homies/", '["tom"]')
    assert_equals(response.body, "0")
    assert_equals(_group_member_names(user_manager.get_group_members(homies)), set([ "mattb", "zuck", "ev" ]))

    response = app.post("/group/remove/all/homies/")
    assert int(response.body) >= 1
    assert_equals(user_manager.get_group_members(homies), [])

    app.post("/group/remove/all/homies/", status=409)

    app.post("/group/add/homies/", '["mattb", "zuck", "tom", "ev"]')
    response = app.post("/group/remove/all/homies/")
    assert int(response.body) >= 1
    assert_equals(user_manager.get_group_members(homies), [])
    assert_equals(_group_names(user_manager.get_groups(joe)), set([ "group" ]))

# Sharing tests
def test_sharing():
    _reset()

    assert_equals(len(joe.projects), 1) # We start with a SampleProject
    joes_project = get_project(joe, joe, "joes_project", create=True)
    assert_equals(len(joe.projects), 2)
    assert_equals(user_manager.get_sharing(joe), [])

    user_manager.add_sharing(joe, joes_project, ev, False, False)
    sharing = user_manager.get_sharing(joe)
    assert_equals(sharing, [{'loadany':False, 'edit':False, 'type':'user', 'project':'joes_project', 'owner':'joe', 'recipient':'ev'}])

    # Joe has shared a project with ev but without anyone following him nothing changes
    assert_equals(len(ev.projects), 1)
    assert_equals(len(tom.projects), 1)
    assert_equals(len(user_manager.get_user_projects(ev, True)), 1)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 1)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 1)

    ev.follow(joe)

    # user.projects reports projects that the user owns, so this should not change
    assert_equals(len(ev.projects), 1)
    assert_equals(len(tom.projects), 1)

    assert_equals(len(user_manager.get_user_projects(ev, True)), 2)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 1)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 1)

    # Joe's homies are mattb and zuck
    homies = joe.get_group("homies", create_on_not_found=True)
    user_manager.add_group_member(homies, mattb)
    user_manager.add_group_member(homies, zuck)
    user_manager.add_sharing(joe, joes_project, homies, False, False)

    # But mattb and zuck don't care they're not following joe
    assert_equals(len(user_manager.get_user_projects(ev, True)), 2)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 1)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 1)

    mattb.follow(joe)
    zuck.follow(joe)
    assert_equals(len(user_manager.get_user_projects(ev, True)), 2)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 2)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 2)

    # So now joe shares it with everyone
    user_manager.add_sharing(joe, joes_project, 'everyone', False, False)

    # Once again, tom doesn't care, because he's not following joe
    assert_equals(len(user_manager.get_user_projects(ev, True)), 2)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 2)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 2)

    tom.follow(joe)
    assert_equals(len(user_manager.get_user_projects(ev, True)), 2)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 2)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 2)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 2)

    # Check that we can undo in a different order
    user_manager.remove_sharing(joe, joes_project, 'everyone')
    assert_equals(len(user_manager.get_user_projects(ev, True)), 2)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 2)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 2)

    user_manager.remove_sharing(joe, joes_project, ev)
    assert_equals(len(user_manager.get_user_projects(ev, True)), 1)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 2)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 2)

    user_manager.remove_sharing(joe, joes_project, homies)
    assert_equals(len(user_manager.get_user_projects(ev, True)), 1)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 1)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 1)

    # Share again to check fast removal
    user_manager.add_sharing(joe, joes_project, ev, False, False)
    user_manager.add_sharing(joe, joes_project, homies, False, False)
    user_manager.add_sharing(joe, joes_project, 'everyone', False, False)

    user_manager.remove_sharing(joe, joes_project)
    assert_equals(user_manager.get_sharing(joe), [])

    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(ev, True)), 1)

    joes_project.delete()

# Sharing tests
def test_sharing_with_app():
    _reset()

    response = app.get("/file/list/")
    assert_equals(len(simplejson.loads(response.body)), 1)

    ##app.post("/group/add/homies/", '["mattb"]')

    joes_project = get_project(joe, joe, "joes_project", create=True)
    response = app.get("/file/list/")
    assert_equals(len(simplejson.loads(response.body)), 2)

    response = app.get("/share/list/all/")
    assert_equals(len(simplejson.loads(response.body)), 0)

    response = app.post("/share/add/joes_project/ev/", '["edit"]')
    assert_equals(response.body, "")

    response = app.get("/share/list/all/")
    shares = simplejson.loads(response.body)
    assert_equals(shares, [{'loadany':False, 'edit':True, 'type':'user', 'project':'joes_project', 'owner':'joe', 'recipient':'ev'}])

    # Joe has shared a project with ev but without anyone following him nothing changes
    assert_equals(len(ev.projects), 1)
    assert_equals(len(tom.projects), 1)
    assert_equals(len(user_manager.get_user_projects(ev, True)), 1)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 1)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 1)

    ev.follow(joe)

    # user.projects reports projects that the user owns, so this should not change
    assert_equals(len(ev.projects), 1)
    assert_equals(len(tom.projects), 1)

    assert_equals(len(user_manager.get_user_projects(ev, True)), 2)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 1)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 1)

    # Joe's homies are mattb and zuck
    homies = joe.get_group("homies", create_on_not_found=True)
    user_manager.add_group_member(homies, mattb)
    user_manager.add_group_member(homies, zuck)
    user_manager.add_sharing(joe, joes_project, homies, False, False)

    # But mattb and zuck don't care they're not following joe
    assert_equals(len(user_manager.get_user_projects(ev, True)), 2)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 1)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 1)

    mattb.follow(joe)
    zuck.follow(joe)
    assert_equals(len(user_manager.get_user_projects(ev, True)), 2)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 2)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 2)

    # So now joe shares it with everyone
    user_manager.add_sharing(joe, joes_project, 'everyone', False, False)

    # Once again, tom doesn't care, because he's not following joe
    assert_equals(len(user_manager.get_user_projects(ev, True)), 2)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 2)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 2)

    tom.follow(joe)
    assert_equals(len(user_manager.get_user_projects(ev, True)), 2)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 2)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 2)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 2)

    # Check that we can undo in a different order
    user_manager.remove_sharing(joe, joes_project, 'everyone')
    assert_equals(len(user_manager.get_user_projects(ev, True)), 2)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 2)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 2)

    user_manager.remove_sharing(joe, joes_project, ev)
    assert_equals(len(user_manager.get_user_projects(ev, True)), 1)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 2)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 2)

    user_manager.remove_sharing(joe, joes_project, homies)
    assert_equals(len(user_manager.get_user_projects(ev, True)), 1)
    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(zuck, True)), 1)
    assert_equals(len(user_manager.get_user_projects(mattb, True)), 1)

    # Share again to check fast removal
    user_manager.add_sharing(joe, joes_project, ev, False, False)
    user_manager.add_sharing(joe, joes_project, homies, False, False)
    user_manager.add_sharing(joe, joes_project, 'everyone', False, False)

    user_manager.remove_sharing(joe, joes_project)
    assert_equals(user_manager.get_sharing(joe), [])

    assert_equals(len(user_manager.get_user_projects(tom, True)), 1)
    assert_equals(len(user_manager.get_user_projects(ev, True)), 1)

    joes_project.delete()

# Follower tests
def test_follow():
    _reset()

    # To start with no-one follows anyone else
    assert_equals(len(joe.users_i_follow()), 0)
    assert_equals(len(mattb.users_i_follow()), 0)
    assert_equals(len(zuck.users_i_follow()), 0)
    assert_equals(len(tom.users_i_follow()), 0)
    assert_equals(len(ev.users_i_follow()), 0)
    assert_equals(len(joe.users_following_me()), 0)
    assert_equals(len(mattb.users_following_me()), 0)
    assert_equals(len(zuck.users_following_me()), 0)
    assert_equals(len(tom.users_following_me()), 0)
    assert_equals(len(ev.users_following_me()), 0)

    # Add a single follow
    zuck.follow(joe)
    assert_equals(len(joe.users_i_follow()), 0)
    assert_equals(len(mattb.users_i_follow()), 0)
    assert_equals(_followed_names(zuck.users_i_follow()), set([ "joe" ]))
    assert_equals(len(tom.users_i_follow()), 0)
    assert_equals(len(ev.users_i_follow()), 0)
    assert_equals(_following_names(joe.users_following_me()), set([ "zuck" ]))
    assert_equals(len(mattb.users_following_me()), 0)
    assert_equals(len(zuck.users_following_me()), 0)
    assert_equals(len(tom.users_following_me()), 0)
    assert_equals(len(ev.users_following_me()), 0)

    # Everyone loves joe
    mattb.follow(joe)
    ev.follow(joe)
    tom.follow(joe)
    assert_equals(len(joe.users_i_follow()), 0)
    assert_equals(_followed_names(mattb.users_i_follow()), set([ "joe" ]))
    assert_equals(_followed_names(zuck.users_i_follow()), set([ "joe" ]))
    assert_equals(_followed_names(tom.users_i_follow()), set([ "joe" ]))
    assert_equals(_followed_names(ev.users_i_follow()), set([ "joe" ]))
    assert_equals(_following_names(joe.users_following_me()), set([ "zuck", "mattb", "tom", "ev" ]))
    assert_equals(len(zuck.users_following_me()), 0)
    assert_equals(len(mattb.users_following_me()), 0)
    assert_equals(len(tom.users_following_me()), 0)
    assert_equals(len(ev.users_following_me()), 0)

    # There is a limit to how much love though
    session.commit()
    try:
        zuck.follow(joe)
        assert False, "Missing ConflictError"
    except model.ConflictError:
        session.rollback()
    assert_equals(len(joe.users_i_follow()), 0)
    assert_equals(_followed_names(mattb.users_i_follow()), set([ "joe" ]))
    assert_equals(_followed_names(zuck.users_i_follow()), set([ "joe" ]))
    assert_equals(_followed_names(tom.users_i_follow()), set([ "joe" ]))
    assert_equals(_followed_names(ev.users_i_follow()), set([ "joe" ]))
    assert_equals(_following_names(joe.users_following_me()), set([ "zuck", "mattb", "tom", "ev" ]))
    assert_equals(len(mattb.users_following_me()), 0)
    assert_equals(len(zuck.users_following_me()), 0)
    assert_equals(len(tom.users_following_me()), 0)
    assert_equals(len(ev.users_following_me()), 0)

    # Tom is a narcissist
    session.commit()
    try:
        tom.follow(tom)
        assert False, "Missing ConflictError"
    except model.ConflictError:
        session.rollback()
    assert_equals(len(joe.users_i_follow()), 0)
    assert_equals(_followed_names(mattb.users_i_follow()), set([ "joe" ]))
    assert_equals(_followed_names(zuck.users_i_follow()), set([ "joe" ]))
    assert_equals(_followed_names(tom.users_i_follow()), set([ "joe" ]))
    assert_equals(_followed_names(ev.users_i_follow()), set([ "joe" ]))
    assert_equals(_following_names(joe.users_following_me()), set([ "zuck", "mattb", "tom", "ev" ]))
    assert_equals(len(mattb.users_following_me()), 0)
    assert_equals(len(zuck.users_following_me()), 0)
    assert_equals(len(tom.users_following_me()), 0)
    assert_equals(len(ev.users_following_me()), 0)

    # Make this a bit less unrequited
    joe.follow(zuck)
    joe.follow(tom)
    joe.follow(mattb)
    joe.follow(ev)
    assert_equals(len(joe.users_i_follow()), 4)
    assert_equals(_followed_names(mattb.users_i_follow()), set([ "joe" ]))
    assert_equals(_followed_names(zuck.users_i_follow()), set([ "joe" ]))
    assert_equals(_followed_names(tom.users_i_follow()), set([ "joe" ]))
    assert_equals(_followed_names(ev.users_i_follow()), set([ "joe" ]))
    assert_equals(_following_names(joe.users_following_me()), set([ "zuck", "mattb", "tom", "ev" ]))
    assert_equals(_following_names(mattb.users_following_me()), set([ "joe" ]))
    assert_equals(_following_names(zuck.users_following_me()), set([ "joe" ]))
    assert_equals(_following_names(tom.users_following_me()), set([ "joe" ]))
    assert_equals(_following_names(ev.users_following_me()), set([ "joe" ]))

    # A love in
    zuck.follow(tom)
    zuck.follow(mattb)
    zuck.follow(ev)
    tom.follow(zuck)
    tom.follow(mattb)
    tom.follow(ev)
    mattb.follow(zuck)
    mattb.follow(tom)
    mattb.follow(ev)
    ev.follow(zuck)
    ev.follow(tom)
    ev.follow(mattb)
    assert_equals(_followed_names(joe.users_i_follow()), set([ "mattb", "zuck", "tom", "ev" ]))
    assert_equals(_followed_names(mattb.users_i_follow()), set([ "zuck", "tom", "ev", "joe" ]))
    assert_equals(_followed_names(zuck.users_i_follow()), set([ "mattb", "tom", "ev", "joe" ]))
    assert_equals(_followed_names(tom.users_i_follow()), set([ "mattb", "zuck", "ev", "joe" ]))
    assert_equals(_followed_names(ev.users_i_follow()), set([ "mattb", "zuck", "tom", "joe" ]))
    assert_equals(_following_names(joe.users_following_me()), set([ "zuck", "mattb", "tom", "ev" ]))
    assert_equals(_following_names(mattb.users_following_me()), set([ "zuck", "tom", "ev", "joe" ]))
    assert_equals(_following_names(zuck.users_following_me()), set([ "mattb", "tom", "ev", "joe" ]))
    assert_equals(_following_names(tom.users_following_me()), set([ "mattb", "zuck", "ev", "joe" ]))
    assert_equals(_following_names(ev.users_following_me()), set([ "mattb", "zuck", "tom", "joe" ]))

    # The joe hate begins
    zuck.unfollow(joe)
    tom.unfollow(joe)
    assert_equals(_followed_names(joe.users_i_follow()), set([ "mattb", "zuck", "tom", "ev" ]))
    assert_equals(_followed_names(mattb.users_i_follow()), set([ "zuck", "tom", "ev", "joe" ]))
    assert_equals(_followed_names(zuck.users_i_follow()), set([ "mattb", "tom", "ev" ]))
    assert_equals(_followed_names(tom.users_i_follow()), set([ "mattb", "zuck", "ev" ]))
    assert_equals(_followed_names(ev.users_i_follow()), set([ "mattb", "zuck", "tom", "joe" ]))
    assert_equals(_following_names(joe.users_following_me()), set([ "mattb", "ev" ]))
    assert_equals(_following_names(mattb.users_following_me()), set([ "zuck", "tom", "ev", "joe" ]))
    assert_equals(_following_names(zuck.users_following_me()), set([ "mattb", "tom", "ev", "joe" ]))
    assert_equals(_following_names(tom.users_following_me()), set([ "mattb", "zuck", "ev", "joe" ]))
    assert_equals(_following_names(ev.users_following_me()), set([ "mattb", "zuck", "tom", "joe" ]))

    # The joe hate continues
    mattb.unfollow(joe)
    ev.unfollow(joe)
    assert_equals(_followed_names(joe.users_i_follow()), set([ "mattb", "zuck", "tom", "ev" ]))
    assert_equals(_followed_names(mattb.users_i_follow()), set([ "zuck", "tom", "ev" ]))
    assert_equals(_followed_names(zuck.users_i_follow()), set([ "mattb", "tom", "ev" ]))
    assert_equals(_followed_names(tom.users_i_follow()), set([ "mattb", "zuck", "ev" ]))
    assert_equals(_followed_names(ev.users_i_follow()), set([ "mattb", "zuck", "tom" ]))
    assert_equals(_following_names(joe.users_following_me()), set([]))
    assert_equals(_following_names(mattb.users_following_me()), set([ "zuck", "tom", "ev", "joe" ]))
    assert_equals(_following_names(zuck.users_following_me()), set([ "mattb", "tom", "ev", "joe" ]))
    assert_equals(_following_names(tom.users_following_me()), set([ "mattb", "zuck", "ev", "joe" ]))
    assert_equals(_following_names(ev.users_following_me()), set([ "mattb", "zuck", "tom", "joe" ]))

    # Joe: well be like that then
    joe.unfollow(zuck)
    joe.unfollow(tom)
    joe.unfollow(mattb)
    joe.unfollow(ev)
    assert_equals(_followed_names(joe.users_i_follow()), set([]))
    assert_equals(_followed_names(mattb.users_i_follow()), set([ "zuck", "tom", "ev" ]))
    assert_equals(_followed_names(zuck.users_i_follow()), set([ "mattb", "tom", "ev" ]))
    assert_equals(_followed_names(tom.users_i_follow()), set([ "mattb", "zuck", "ev" ]))
    assert_equals(_followed_names(ev.users_i_follow()), set([ "mattb", "zuck", "tom" ]))
    assert_equals(_following_names(joe.users_following_me()), set([]))
    assert_equals(_following_names(mattb.users_following_me()), set([ "zuck", "tom", "ev" ]))
    assert_equals(_following_names(zuck.users_following_me()), set([ "mattb", "tom", "ev" ]))
    assert_equals(_following_names(tom.users_following_me()), set([ "mattb", "zuck", "ev" ]))
    assert_equals(_following_names(ev.users_following_me()), set([ "mattb", "zuck", "tom" ]))

    # And we all throw our toys out of the pram
    zuck.unfollow(tom)
    zuck.unfollow(mattb)
    zuck.unfollow(ev)
    tom.unfollow(zuck)
    tom.unfollow(mattb)
    tom.unfollow(ev)
    mattb.unfollow(zuck)
    mattb.unfollow(tom)
    mattb.unfollow(ev)
    ev.unfollow(zuck)
    ev.unfollow(tom)
    ev.unfollow(mattb)
    assert_equals(len(joe.users_i_follow()), 0)
    assert_equals(len(zuck.users_i_follow()), 0)
    assert_equals(len(mattb.users_i_follow()), 0)
    assert_equals(len(tom.users_i_follow()), 0)
    assert_equals(len(ev.users_i_follow()), 0)
    assert_equals(len(joe.users_following_me()), 0)
    assert_equals(len(zuck.users_following_me()), 0)
    assert_equals(len(mattb.users_following_me()), 0)
    assert_equals(len(tom.users_following_me()), 0)
    assert_equals(len(ev.users_following_me()), 0)

    # But there is a limit to how much you can hate
    session.commit()
    try:
        zuck.unfollow(tom)
        assert False, "Missing ConflictError"
    except model.ConflictError:
        session.rollback()
