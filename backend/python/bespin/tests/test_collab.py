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
from bespin import config, controllers
from bespin.filesystem import get_project
from bespin.database import User, Base, ConflictError

from nose.tools import assert_equals
from __init__ import BespinTestApp

session = None
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
    Base.metadata.drop_all(bind=config.c.dbengine)
    Base.metadata.create_all(bind=config.c.dbengine)
    fsroot = config.c.fsroot
    if fsroot.exists() and fsroot.basename() == "testfiles":
        fsroot.rmtree()
    fsroot.makedirs()

    global session
    session = config.c.session_factory()
    num_users = session.query(User).count()
    assert_equals(num_users, 0)
    session.commit()

    global mattb, zuck, tom, ev, joe
    mattb = User.create_user("mattb", "mattb", "mattb")
    zuck = User.create_user("zuck", "zuck", "zuck")
    tom = User.create_user("tom", "tom", "tom")
    ev = User.create_user("ev", "ev", "ev")
    joe = User.create_user("joe", "joe", "joe")
    group = joe.add_group("group")
    group.add_member(mattb)
    group.add_member(zuck)
    group.add_member(tom)
    group.add_member(ev)

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

    assert_equals(len(joe.get_groups()), 1)

    homies = joe.get_group("homies", create_on_not_found=True)
    assert_equals(_group_names(joe.get_groups()), set([ "homies", "group" ]))
    assert_equals(_group_names(joe.get_groups(mattb)), set([ "group" ]))

    homies.add_member(mattb)
    assert_equals(_group_names(joe.get_groups(mattb)), set([ "homies", "group" ]))
    assert_equals(_group_member_names(homies.get_members()), set([ "mattb" ]))

    homies.add_member(zuck)
    homies.add_member(tom)
    homies.add_member(ev)
    assert_equals(_group_member_names(homies.get_members()), set([ "mattb", "zuck", "tom", "ev" ]))

    deleted = homies.remove_member(tom)
    assert deleted > 0
    assert_equals(_group_member_names(homies.get_members()), set([ "mattb", "zuck", "ev" ]))

    deleted = homies.remove_member(tom)
    assert_equals(deleted, 0)
    assert_equals(_group_member_names(homies.get_members()), set([ "mattb", "zuck", "ev" ]))

    deleted = homies.remove_all_members()
    assert deleted > 0
    assert_equals(homies.get_members(), [])

    deleted = homies.remove_all_members()
    assert_equals(deleted, 0)
    assert_equals(homies.get_members(), [])

    homies.add_member(mattb)
    homies.add_member(zuck)
    homies.add_member(tom)
    homies.add_member(ev)

    session.commit()
    try:
        homies.add_member(joe)
        assert False, "Missing ConflictError"
    except ConflictError:
        session.rollback()

    deleted = homies.remove()
    assert deleted > 0
    assert_equals(_group_names(joe.get_groups()), set([ "group" ]))

# Group tests
def _test_groups_with_app():
    _reset()

    assert_equals(len(joe.get_groups()), 1)

    app.get("/group/list/homies/", status=409)
    app.post("/group/add/homies/", '["mattb"]')

    homies = joe.get_group("homies", raise_on_not_found=True)

    assert_equals(_group_names(joe.get_groups()), set([ "homies", "group" ]))
    assert_equals(_group_names(joe.get_groups(mattb)), set([ "homies" ]))
    assert_equals(_group_member_names(homies.get_members()), set([ "mattb" ]))

    app.post("/group/add/homies/", '["zuck", "tom", "ev"]')
    assert_equals(_group_member_names(homies.get_members()), set([ "mattb", "zuck", "tom", "ev" ]))

    response = app.post("/group/remove/homies/", '["tom"]')
    assert int(response.body) >= 1
    assert_equals(_group_member_names(homies.get_members()), set([ "mattb", "zuck", "ev" ]))

    response = app.post("/group/remove/homies/", '["tom"]')
    assert_equals(response.body, "0")
    assert_equals(_group_member_names(homies.get_members()), set([ "mattb", "zuck", "ev" ]))

    response = app.post("/group/remove/all/homies/")
    assert int(response.body) >= 1
    assert_equals(homies.get_members(), [])

    app.post("/group/remove/all/homies/", status=409)

    app.post("/group/add/homies/", '["mattb", "zuck", "tom", "ev"]')
    response = app.post("/group/remove/all/homies/")
    assert int(response.body) >= 1
    assert_equals(homies.get_members(), [])
    assert_equals(_group_names(joe.get_groups()), set([ "group" ]))

# Sharing tests
def test_sharing():
    _reset()

    assert_equals(len(joe.projects), 1) # We start with a SampleProject
    joes_project = get_project(joe, joe, "joes_project", create=True)
    assert_equals(len(joe.projects), 2)
    assert_equals(joe.get_sharing(), [])

    joe.add_sharing(joes_project, ev, False, False)
    sharing = joe.get_sharing()
    assert_equals(sharing, [{'loadany':False, 'edit':False, 'type':'user', 'project':'joes_project', 'owner':'joe', 'recipient':'ev'}])

    # Joe has shared a project with ev but without anyone following him nothing changes
    assert_equals(len(ev.projects), 1)
    assert_equals(len(tom.projects), 1)
    assert_equals(len(ev.get_all_projects(True)), 1)
    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(zuck.get_all_projects(True)), 1)
    assert_equals(len(mattb.get_all_projects(True)), 1)

    ev.follow(joe)

    # user.projects reports projects that the user owns, so this should not change
    assert_equals(len(ev.projects), 1)
    assert_equals(len(tom.projects), 1)

    assert_equals(len(ev.get_all_projects(True)), 2)
    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(zuck.get_all_projects(True)), 1)
    assert_equals(len(mattb.get_all_projects(True)), 1)

    # Joe's homies are mattb and zuck
    homies = joe.get_group("homies", create_on_not_found=True)
    homies.add_member(mattb)
    homies.add_member(zuck)
    joe.add_sharing(joes_project, homies, False, False)

    # But mattb and zuck don't care they're not following joe
    assert_equals(len(ev.get_all_projects(True)), 2)
    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(zuck.get_all_projects(True)), 1)
    assert_equals(len(mattb.get_all_projects(True)), 1)

    mattb.follow(joe)
    zuck.follow(joe)
    assert_equals(len(ev.get_all_projects(True)), 2)
    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(zuck.get_all_projects(True)), 2)
    assert_equals(len(mattb.get_all_projects(True)), 2)

    # So now joe shares it with everyone
    joe.add_sharing(joes_project, 'everyone', False, False)

    # Once again, tom doesn't care, because he's not following joe
    assert_equals(len(ev.get_all_projects(True)), 2)
    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(zuck.get_all_projects(True)), 2)
    assert_equals(len(mattb.get_all_projects(True)), 2)

    tom.follow(joe)
    assert_equals(len(ev.get_all_projects(True)), 2)
    assert_equals(len(tom.get_all_projects(True)), 2)
    assert_equals(len(zuck.get_all_projects(True)), 2)
    assert_equals(len(mattb.get_all_projects(True)), 2)

    # Check that we can undo in a different order
    joe.remove_sharing(joes_project, 'everyone')
    assert_equals(len(ev.get_all_projects(True)), 2)
    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(zuck.get_all_projects(True)), 2)
    assert_equals(len(mattb.get_all_projects(True)), 2)

    joe.remove_sharing(joes_project, ev)
    assert_equals(len(ev.get_all_projects(True)), 1)
    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(zuck.get_all_projects(True)), 2)
    assert_equals(len(mattb.get_all_projects(True)), 2)

    joe.remove_sharing(joes_project, homies)
    assert_equals(len(ev.get_all_projects(True)), 1)
    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(zuck.get_all_projects(True)), 1)
    assert_equals(len(mattb.get_all_projects(True)), 1)

    # Share again to check fast removal
    joe.add_sharing(joes_project, ev, False, False)
    joe.add_sharing(joes_project, homies, False, False)
    joe.add_sharing(joes_project, 'everyone', False, False)

    joe.remove_sharing(joes_project)
    assert_equals(joe.get_sharing(), [])

    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(ev.get_all_projects(True)), 1)

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
    assert_equals(len(ev.get_all_projects(True)), 1)
    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(zuck.get_all_projects(True)), 1)
    assert_equals(len(mattb.get_all_projects(True)), 1)

    ev.follow(joe)

    # user.projects reports projects that the user owns, so this should not change
    assert_equals(len(ev.projects), 1)
    assert_equals(len(tom.projects), 1)

    assert_equals(len(ev.get_all_projects(True)), 2)
    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(zuck.get_all_projects(True)), 1)
    assert_equals(len(mattb.get_all_projects(True)), 1)

    # Joe's homies are mattb and zuck
    homies = joe.get_group("homies", create_on_not_found=True)
    homies.add_member(mattb)
    homies.add_member(zuck)
    joe.add_sharing(joes_project, homies, False, False)

    # But mattb and zuck don't care they're not following joe
    assert_equals(len(ev.get_all_projects(True)), 2)
    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(zuck.get_all_projects(True)), 1)
    assert_equals(len(mattb.get_all_projects(True)), 1)

    mattb.follow(joe)
    zuck.follow(joe)
    assert_equals(len(ev.get_all_projects(True)), 2)
    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(zuck.get_all_projects(True)), 2)
    assert_equals(len(mattb.get_all_projects(True)), 2)

    # So now joe shares it with everyone
    joe.add_sharing(joes_project, 'everyone', False, False)

    # Once again, tom doesn't care, because he's not following joe
    assert_equals(len(ev.get_all_projects(True)), 2)
    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(zuck.get_all_projects(True)), 2)
    assert_equals(len(mattb.get_all_projects(True)), 2)

    tom.follow(joe)
    assert_equals(len(ev.get_all_projects(True)), 2)
    assert_equals(len(tom.get_all_projects(True)), 2)
    assert_equals(len(zuck.get_all_projects(True)), 2)
    assert_equals(len(mattb.get_all_projects(True)), 2)

    # Check that we can undo in a different order
    joe.remove_sharing(joes_project, 'everyone')
    assert_equals(len(ev.get_all_projects(True)), 2)
    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(zuck.get_all_projects(True)), 2)
    assert_equals(len(mattb.get_all_projects(True)), 2)

    joe.remove_sharing(joes_project, ev)
    assert_equals(len(ev.get_all_projects(True)), 1)
    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(zuck.get_all_projects(True)), 2)
    assert_equals(len(mattb.get_all_projects(True)), 2)

    joe.remove_sharing(joes_project, homies)
    assert_equals(len(ev.get_all_projects(True)), 1)
    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(zuck.get_all_projects(True)), 1)
    assert_equals(len(mattb.get_all_projects(True)), 1)

    # Share again to check fast removal
    joe.add_sharing(joes_project, ev, False, False)
    joe.add_sharing(joes_project, homies, False, False)
    joe.add_sharing(joes_project, 'everyone', False, False)

    joe.remove_sharing(joes_project)
    assert_equals(joe.get_sharing(), [])

    assert_equals(len(tom.get_all_projects(True)), 1)
    assert_equals(len(ev.get_all_projects(True)), 1)

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
    except ConflictError:
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
    except ConflictError:
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
    except ConflictError:
        session.rollback()
