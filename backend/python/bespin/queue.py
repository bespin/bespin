"""Functions for managing asynchronous operations."""
import sqlite3
import simplejson
import time
import logging

from bespin import config

log = logging.getLogger("bespin.queue")

class QueueItem(object):
    def __init__(self, id, queue, message):
        self.id = id
        self.queue = queue
        self.message = message

class StupidQueue(object):
    """This is just for testing and should be replaced with something
    real."""
    
    _shutdown = False
    
    def __init__(self):
        queue_path = config.c.get('queue_path')
        assert queue_path
        do_create = not queue_path.exists()
        self.conn = sqlite3.connect(queue_path)
        if do_create:
            self._create_db()
        
    def _create_db(self):
        self.conn.execute("""CREATE TABLE queue
(
    id INTEGER PRIMARY KEY,
    name TEXT,
    message TEXT
)""")

    def enqueue(self, name, message):
        cursor = self.conn.execute("""INSERT INTO queue (name, message) VALUES (?, ?)""",
                (name, simplejson.dumps(message)))
        id = cursor.lastrowid
        cursor.close()
        self.conn.commit()
        return id
        
    def _get_item(self, name):
        cursor = self.conn.execute("""SELECT id, name, message 
FROM queue WHERE name=? ORDER BY id LIMIT 1""", (name,))
        rows = cursor.fetchall()
        cursor.close()
        if rows:
            data = simplejson.loads(rows[0][2])
            id = rows[0][0]
            cursor = self.conn.execute("""DELETE FROM queue WHERE id=?""", (id,))
            cursor.close()
            self.conn.commit()
            return QueueItem(id, name, data)
        else:
            return None
    
    def read_queue(self, name):
        self._shutdown = False
        
        while not self._shutdown:
            # note: this is totally not multi-consumer safe, which is why
            # this is a StupidQueue.
            item = self._get_item(name)
            if item is not None:
                yield item
            else:
                time.sleep(0.5)
            
    def shutdown(self):
        self._shutdown = True
    
    def close(self):
        self.conn.close()
        
def _resolve_function(namestring):
    modulename, funcname = namestring.split(":")
    module = __import__(modulename, fromlist=[funcname])
    return getattr(module, funcname)

def run_queue_item(qi):
    execute = qi.message['execute']
    execute = _resolve_function(execute)
    execute(qi)

def enqueue(queue_name, message):
    if config.c.async_jobs:
        sq = StupidQueue()
        id = sq.enqueue(queue_name, message)
        sq.close()
        return id
    else:
        qi = QueueItem(None, queue_name, message)
        run_queue_item(qi)
    
def process_queue():
    print "Processing VCS queue"
    sq = StupidQueue()
    for qi in sq.read_queue("vcs"):
        log.info("Processing job %s", qi.id)
        log.debug("Message: %s", qi.message)
        run_queue_item(qi)
    