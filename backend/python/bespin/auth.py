"""Failed login tracking.

Keep track of the number of failed attempts to log in per user over a given time
period. If there are too many failed login attempts during that period, the user
will be locked out.
"""

import time

class FailedLoginInfo(object):
    def __init__(self, username, can_log_in, failed_attempts):
        self.username = username
        self.can_log_in = can_log_in
        self.failed_attempts = failed_attempts

class DoNothingFailedLoginTracker(object):
    def can_log_in(self, username):
        """Returns FailedLoginInfo. Check the return result.can_log_in to
        verify that the user is allowed to log in."""
        return FailedLoginInfo(username, True, 0)
        
    def login_failed(self, fli):
        """Pass in the FailedLoginInfo from can_log_in and a failed login
        attempt will be tracked."""
        pass
        
    def login_successful(self, fli):
        """Pass in the FailedLoginInfo from can_log_in and the successful
        login will be tracked."""
        pass
    
class MemoryFailedLoginTracker(object):
    """Stores the information in memory. This is really only for development/testing
    purposes. You would not use this in production. The failed logins are not
    automatically expired."""
    
    def __init__(self, number_of_attempts, lockout_period):
        self.number_of_attempts = number_of_attempts
        self.lockout_period = lockout_period
        self.store = {}
        
    def can_log_in(self, username):
        now = time.time()
        current = self.store.get(username, [0, now])
        if now > current[1]:
            # reset if we've passed the time out
            current = [0, 0]
            del self.store[username]
            
        if current[0] >= self.number_of_attempts:
            return FailedLoginInfo(username, False, current[0])
        return FailedLoginInfo(username, True, current[0])
        
    def login_failed(self, fli):
        current = self.store.setdefault(fli.username, [0, 0])
        current[0] += 1
        current[1] = time.time() + self.lockout_period
        
    def login_successful(self, fli):
        try:
            del self.store[fli.username]
        except KeyError:
            pass
        
        