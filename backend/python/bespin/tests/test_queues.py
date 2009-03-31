from path import path

from bespin import config
from bespin import queue

queue_db = (path(__file__).dirname() / "queue.db").abspath()

def setup_module(module):
    if queue_db.exists():
        print "Deleting old queue DB"
        queue_db.unlink()
    config.set_profile("test")
    config.c.async_jobs = True
    config.c.queue_path = queue_db
    config.activate_profile()

def test_using_stupid_queue():
    sq = queue.StupidQueue()
    assert queue_db.exists()
    id = sq.enqueue("vcs", dict(command=["clone", 
                "http://hg.mozilla.org/labs/bespin"],
                user="1234-5678-9abcdef",
                working_dir="blah/blah"))
    assert id == 1

    id = sq.enqueue("vcs", dict(command=["diff"],
                user="10",
                working_dir="other/dir"))
    assert id == 2

    id = sq.enqueue("vcs", dict(command=["log"],
                user="10",
                working_dir="other/dir"))
    assert id == 3
    
    i = sq.read_queue("vcs")
    item = i.next()
    assert item.queue == "vcs"
    assert item.id == 1
    assert item.message == dict(command=["clone", 
                "http://hg.mozilla.org/labs/bespin"],
                user="1234-5678-9abcdef",
                working_dir="blah/blah")
                
    item = i.next()
    assert item.queue == "vcs"
    assert item.id == 2
    assert item.message == dict(command=["diff"],
                user="10",
                working_dir="other/dir")
    sq.shutdown()
    try:
        item = i.next()
        assert False, "Expected to StopIteration here"
    except StopIteration:
        pass
    
    i = sq.read_queue("vcs")
    item = i.next()
    assert item.queue == "vcs"
    assert item.id == 3
    assert item.message == dict(command=["log"],
                user="10",
                working_dir="other/dir")
    
def job_handler(qi):
    assert qi.id == job_handler.id
    assert qi.queue == job_handler.queue
    assert qi.message == job_handler.message
    job_handler.called = True

def test_sync_queueing():
    config.c.async_jobs = False
    
    job_handler.message = dict(answer=42, 
        question="what do you get if you multiply six by nine?")
    job_handler.queue = "vcs"
    job_handler.called = False
    job_handler.id = None
        
    id = queue.enqueue("vcs", 
        "bespin.tests.test_queues:job_handler",
        job_handler.message)
    assert id is None
    assert job_handler.called
    