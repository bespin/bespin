import time

from bespin import auth

def test_login_failure():
    tracker = auth.MemoryFailedLoginTracker(1, 1)
    fli = tracker.can_log_in("foo")
    assert fli.can_log_in
    tracker.login_failed(fli)
    fli = tracker.can_log_in("foo")
    assert not fli.can_log_in
    time.sleep(1.5)
    fli = tracker.can_log_in("foo")
    assert fli.can_log_in
    
def test_login_success():
    tracker = auth.MemoryFailedLoginTracker(10, 600)
    fli = tracker.can_log_in("foo")
    assert fli.can_log_in
    tracker.login_failed(fli)
    fli = tracker.can_log_in("foo")
    assert fli.can_log_in
    assert fli.failed_attempts == 1
    tracker.login_successful(fli)
    fli = tracker.can_log_in("foo")
    assert fli.can_log_in
    assert fli.failed_attempts == 0
    