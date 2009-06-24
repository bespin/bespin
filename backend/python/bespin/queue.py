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
# for the specific language governing rights and limitations under the License.
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
    next_jobid = 0

    def __init__(self, id, queue, message, execute, error_handler=None,
                job=None, use_db=True):
        if id == None:
            self.id = QueueItem.next_jobid
            QueueItem.next_jobid = QueueItem.next_jobid + 1
        else:
            self.id = id
        self.queue = queue
        self.message = message
        self.execute = execute
        self.error_handler = error_handler
        self.job = job
        self.use_db = use_db
        self.session = None

    def run(self):
        execute = self.execute
        execute = _resolve_function(execute)

        use_db = self.use_db
        if use_db:
            session = config.c.session_factory()
            self.session = session
        try:
            execute(self)
            if use_db:
                session.commit()
        except Exception, e:
            if use_db:
                session.rollback()
                session.close()

                # get a fresh session for the error handler to use
                session = config.c.session_factory()
                self.session = session

            try:
                self.error(e)
                if use_db:
                    session.commit()
            except:
                if use_db:
                    session.rollback()
                log.exception("Error in error handler for message %s. Original error was %s", self.message, e)
        finally:
            if use_db:
                session.close()
        return self.id

    def error(self, e):
        error_handler = self.error_handler
        error_handler = _resolve_function(error_handler)
        error_handler(self, e)

    def done(self):
        if self.job:
            self.job.delete()

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

    def enqueue(self, name, message, execute, error_handler, use_db):
        message['__execute'] = execute
        message['__error_handler'] = error_handler
        message['__use_db'] = use_db
        c = self.conn
        c.use(name)
        id = c.put(simplejson.dumps(message))
        return id

    def read_queue(self, name):
        c = self.conn
        log.debug("Starting to read %s on %s", name, c)
        c.watch(name)

        while True:
            log.debug("Reserving next job")
            item = c.reserve()
            if item is not None:
                log.debug("Job received (%s)", item.jid)
                message = simplejson.loads(item.body)
                execute = message.pop('__execute')
                error_handler = message.pop('__error_handler')
                use_db = message.pop('__use_db')
                qi = QueueItem(item.jid, name, message,
                                execute, error_handler=error_handler,
                                job=item, use_db=use_db)
                yield qi

    def close(self):
        self.conn.close()

def _resolve_function(namestring):
    modulename, funcname = namestring.split(":")
    module = __import__(modulename, fromlist=[funcname])
    return getattr(module, funcname)

def enqueue(queue_name, message, execute, error_handler=None, use_db=True):
    if config.c.queue:
        id = config.c.queue.enqueue(queue_name, message, execute,
                                    error_handler, use_db)
        log.debug("Running job asynchronously (%s)", id)
        return id
    else:
        qi = QueueItem(None, queue_name, message, execute,
                        error_handler=error_handler, use_db=use_db)
        log.debug("Running job synchronously (%s)", qi.id)
        return qi.run()

def process_queue(args=None):
    log.info("Bespin queue worker")
    if args is None:
        args = sys.argv[1:]

    if args:
        config.set_profile(args.pop(0))
    else:
        config.set_profile("dev")
        config.c.async_jobs=True

    if args:
        config.load_config(args.pop(0))

    config.activate_profile()

    bq = config.c.queue
    log.debug("Queue: %s", bq)
    for qi in bq.read_queue("vcs"):
        log.info("Processing job %s", qi.id)
        log.debug("Message: %s", qi.message)
        qi.run()
        qi.done()

