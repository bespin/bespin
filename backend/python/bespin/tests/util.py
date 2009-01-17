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
