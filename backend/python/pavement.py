import paver.virtual

options(
    setup=Bunch(
        name="BespinServer",
        version="0.1",
        packages=['bespin']
    ),
    virtualenv=Bunch(
        packages_to_install=['pip'],
        paver_command_line="required"
    )
)

@task
def required():
    """Install the required packages.
    
    Installs the requirements set in requirements.txt."""
    sh("bin/pip install -r requirements.txt")
    call_task('develop')
    # clean up after urlrelay's installation
    path("README").unlink()
    path("include").rmtree()

@task
def start():
    """Starts the BespinServer on localhost port 8080 for development."""
    # Spawning is not quite working yet
    sh("bin/spawn -f bespin.config.dev_spawning_factory -s 1 -t 4 -i 127.0.0.1 -p 8080 bespin.config.dev_factory")
    # from bespin import config, controllers
    # from wsgiref.simple_server import make_server
    # 
    # config.set_profile('dev')
    # config.activate_profile()
    # make_server('localhost', 8080, controllers.make_app()).serve_forever()
    pass
    
@task
def clean_data():
    """Deletes the development data"""
    data_path = path("devdata")
    data_path.rmtree()
    data_path.mkdir()
    