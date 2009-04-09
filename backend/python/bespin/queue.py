"""Functions for managing asynchronous operations."""
import sqlite3
import simplejson
import time
import logging
import sys

from bespin import config

try:
    import beanstalkc
except ImportError:
    pass

log = logging.getLogger("bespin.queue")

class QueueItem(object):
    def __init__(self, id, queue, message):
        self.id = id
        self.queue = queue
        self.message = message

class BeanstalkQueue(object):
    """Manages Bespin jobs within a beanstalkd server.
    
    http://xph.us/software/beanstalkd/
    
    The client library used is beanstalkc:
    
    http://github.com/earl/beanstalkc/tree/master
    """
    
    def __init__(self, host, port):
        if host is None or port is None:
            self.conn = beanstalkc.Connection()
        else:
            self.conn = beanstalkc.Connection(host=host, port=port)
                                        
    def enqueue(self, name, message):
        c = self.conn
        c.using(name)
        id = c.put(simplejson.dumps(message))
        return id
    
    def read_queue(self, name):
        c = self.conn
        c.using(name)
        
        while True:
            item = c.reserve()
            if item is not None:
                item = simplejson.loads(item)
                yield item
            
    def close(self):
        self.conn.close()
        
def _resolve_function(namestring):
    modulename, funcname = namestring.split(":")
    module = __import__(modulename, fromlist=[funcname])
    return getattr(module, funcname)

def run_queue_item(qi):
    execute = qi.message.pop('execute')
    execute = _resolve_function(execute)
    execute(qi)

def enqueue(queue_name, message):
    if config.c.queue:
        id = config.c.queue.enqueue(queue_name, message)
        return id
    else:
        qi = QueueItem(None, queue_name, message)
        run_queue_item(qi)
    
def process_queue(args=None):
    if args is None:
        args = sys.argv[1:]
        
    if args:
        config.set_profile(args.pop(0))
    else:
        config.set_profile("dev")
        config.async_jobs=True
    
    if args:
        config.load_config(args.pop(0))
    
    config.activate_profile()
    
    bq = config.c.queue
    for qi in bq.read_queue("vcs"):
        log.info("Processing job %s", qi.id)
        log.debug("Message: %s", qi.message)
        run_queue_item(qi)
    