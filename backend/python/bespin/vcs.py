from uvc import main

def clone(user, args):
    """Clones or checks out the repository using the command provided."""
    command = main.convert(args)
    output = main.run_command(command, user.get_location())
    return str(output)
    
def run_command(user, args):
    pass