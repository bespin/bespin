"""Methods for tracking statistics."""

from datetime import date
import logging

log = logging.getLogger("bespin.stats")

class DoNothingStats(object):
    def incr(self, key, by=1):
        return 0
        
    def decr(self, key, by=1):
        return 0
    
    def multiget(self, keys):
        return dict()
        
    def disconnect(self):
        pass

def _get_key(key):
    if "_DATE" in key:
        return key.replace("DATE", date.today().strftime("%Y%m%d"))
    return key

class MemoryStats(object):
    def __init__(self):
        self.storage = {}
        
    def incr(self, key, by=1):
        key = _get_key(key)
        current = self.storage.setdefault(key, 0)
        newval = current + by
        self.storage[key] = newval
        return newval
        
    def decr(self, key, by=1):
        return self.incr(key, -1*by)
    
    def multiget(self, keys):
        return dict((key, self.storage.get(key)) for key in keys)
        
    def disconnect(self):
        pass
        
class RedisStats(object):
    def __init__(self, redis):
        self.redis = redis
        
    def incr(self, key, by=1):
        key = _get_key(key)
        try:
            return self.redis.incr(key, by)
        except:
            log.exception("Problem incrementing stat %s", key)
    
    def decr(self, key, by=1):
        key = _get_key(key)
        try:
            return self.redis.decr(key, by)
        except:
            log.exception("Problem decrementing stat %s", key)
        
    def multiget(self, keys):
        return dict(zip(keys, self.redis.mget(*keys)))
    
    def disconnect(self):
        self.redis.disconnect()
        