import simplejson

from bespin import config, controllers, database

from bespin.tests import BespinTestApp

def setup_module(module):
    config.set_profile("test")
    config.activate_profile()

def _clear_db():
    database.Base.metadata.drop_all(bind=config.c.dbengine)
    database.Base.metadata.create_all(bind=config.c.dbengine)
    fsroot = config.c.fsroot
    if fsroot.exists() and fsroot.basename() == "testfiles":
        fsroot.rmtree()
    fsroot.makedirs()

def test_server_capabilities():
    _clear_db()
    app = controllers.make_app()
    app = BespinTestApp(app)
    resp = app.post('/register/new/BillBixby', dict(email="bill@bixby.com",
                                                    password="notangry"))
    resp = app.get("/capabilities/")
    assert resp.content_type == "application/json"
    data = simplejson.loads(resp.body)
    print data
    assert data == dict(
        capabilities=["vcs"],
        dojoModulePath={},
        javaScriptPlugins=[]
    )
    
def test_userinfo_also_returns_capabilities():
    _clear_db()
    app = controllers.make_app()
    app = BespinTestApp(app)
    resp = app.post('/register/new/BillBixby', dict(email="bill@bixby.com",
                                                    password="notangry"))
    resp = app.get('/register/userinfo/')
    data = simplejson.loads(resp.body)
    print data
    assert 'serverCapabilities' in data
    