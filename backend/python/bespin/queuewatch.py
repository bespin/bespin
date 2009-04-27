from datetime import date
import sys

import beanstalkc
import redis

def command():
    if len(sys.argv) < 5:
        print "Usage: beanstalk host, beanstalk port, redis host, redis port"
        sys.exit(1)
    bhost, bport, rhost, rport = sys.argv[1:]
    bport = int(bport)
    rport = int(rport)
    beanstalk = beanstalkc.Connection(host=bhost, port=bport)
    redis_conn = redis.Redis(rhost, rport)
    try:
        queue_size = beanstalk.stats_tube('vcs')['current-jobs-ready']
    except beanstalkc.CommandFailed:
        queue_size = 0
    
    today = date.today().strftime("%Y%m%d")
    redis_conn.push("queue_" + today, queue_size, tail=False)
    