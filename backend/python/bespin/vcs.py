from uvc import main
from uvc.main import is_new_project_command

def clone(user, args):
    """Clones or checks out the repository using the command provided."""
    working_dir = user.get_location()
    context = main.SecureContext(working_dir)
    command = main.convert(context, args)
    output = main.run_command(command, context)
    return str(output)
    
def run_command(user, project, args):
    working_dir = project.location
    
    context = main.SecureContext(working_dir)
    
    if args and args[0] in main.dialects:
        dialect = None
    elif not is_new_project_command(args):
        dialect = main.infer_dialect(working_dir)
    else:
        dialect = None
        
    command = main.convert(context, args, dialect)
    output = main.run_command(command, context)
    return str(output)