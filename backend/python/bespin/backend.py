import urllib

from shove import FileBase, BaseStore
import shove
import jsonpickle

class JSONBase(FileBase, BaseStore):
    def __init__(self, engine, **kw):
        engine = urllib.url2pathname(engine.split('://')[1])
        super(JSONBase, self).__init__(engine, **kw)
        
    def dumps(self, value):
        return jsonpickle.encode(value)
    
    def loads(self, value):
        return jsonpickle.decode(value)
    
class JSONFiles(JSONBase):
    """Used for the file store, this will store any key that *doesn't* end 
    with / directly and jsonpickle any key that does end with /.
    """
    def __getitem__(self, key):
        try:
            item = open(self._key_to_file(key), 'rb')
            data = item.read()
            item.close()
            if key.endswith("/"):
                return self.loads(data)
            else:
                return data
        except:
            raise KeyError('%s' % key)
    
    def __setitem__(self, key, value):
        try:
            item = open(self._key_to_file(key), 'wb')
            if key.endswith("/"):
                item.write(self.dumps(value))
            else:
                item.write(value)
            item.close()
        except (IOError, OSError):
            raise KeyError('%s' % key)
            

shove.stores['jsonbase'] = 'bespin.backend:JSONBase'
shove.stores['jsonfiles'] = 'bespin.backend:JSONFiles'