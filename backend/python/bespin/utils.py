#  ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the License.
#
# The Original Code is Bespin.
#
# The Initial Developer of the Original Code is Mozilla.
# Portions created by the Initial Developer are Copyright (C) 2009
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#
# ***** END LICENSE BLOCK *****
#

import re
import logging
import smtplib
from email.mime.text import MIMEText

import pkg_resources

from bespin import config, jsontemplate

log = logging.getLogger("bespin.model")

class BadValue(Exception):
    pass

good_characters = r'\w-'
good_pattern = re.compile(r'^\w[%s]*$' % good_characters, re.UNICODE)

def _check_identifiers(kind, value):
    if not config.c.restrict_identifiers:
        return
    if not good_pattern.match(value):
        log.error("Invalid identifier kind='%s', value='%s'" % (kind, value))
        raise BadValue("%s must only contain letters, numbers and dashes and must start with a letter or number." % (kind))

def send_text_email(to_addr, subject, text, from_addr=None):
    """Send email to addresses given by to_addr (can be a string or a list),
    with the subject provided and the message text given.
    If not given, from_addr will be set to the configured email_from value.
    The message will be sent via the configured server at email_host, email_port.
    
    If the configured email_host is None or "", no email will be sent.
    """
    
    if not config.c.email_host:
        return
    
    if from_addr is None:
        from_addr = config.c.email_from
        
    if isinstance(to_addr, basestring):
        to_addr = [to_addr]
    msg = MIMEText(text)
    msg['Subject'] = subject
    msg['From'] = from_addr
    msg['To'] = ", ".join(to_addr)
    
    s = smtplib.SMTP()
    s.connect(config.c.email_host, config.c.email_port)
    s.sendmail(from_addr, to_addr, msg.as_string())
    s.quit()
    
def send_email_template(to_addr, subject, template_name, context, from_addr=None):
    """Send an email by applying context to the template in bespin/mailtemplates
    given by template_name and passing the resulting text to send_text_email."""
    template_filename = pkg_resources.resource_filename("bespin", 
                                        "mailtemplates/%s" % template_name)
    template_file = open(template_filename)
    
    try:
        template = jsontemplate.FromFile(template_file)
    finally:
        template_file.close()
        
    text = template.expand(context)
    send_text_email(to_addr, subject, text, from_addr)
    