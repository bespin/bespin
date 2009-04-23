from datetime import date

from bespin import stats

def test_stats_operations():
    ms = stats.MemoryStats()
    result = ms.incr("foo")
    assert result == 1
    result = ms.decr("foo")
    assert result == 0
    
    result = ms.incr("foo", 100)
    assert result == 100
    
    result = ms.incr("foo_DATE", 100)
    
    assert "foo_" + date.today().strftime("%Y%m%d") in ms.storage
    