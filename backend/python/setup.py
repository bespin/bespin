# Don't run this. This is just for pip.

from paver import tasks
tasks.environment = tasks.Environment()
import pavement
from setuptools import setup

kw = pavement.options.setup

setup(**kw)