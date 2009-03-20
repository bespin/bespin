from uvc import main
from uvc.main import is_new_project_command

def clone(user, args):
    """Clones or checks out the repository using the command provided."""
    command = main.convert(args)
    output = main.run_command(command, user.get_location())
    return str(output)
    
def run_command(user, project, args):
    working_dir = project.location
    
    if args and args[0] in main.dialects:
        dialect = None
    elif not is_new_project_command(args):
        dialect = main.infer_dialect(working_dir)
    else:
        dialect = None
        
    command = main.convert(args, dialect)
    output = main.run_command(command, working_dir)
    return str(output)