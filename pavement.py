#  ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
# 
# The contents of this file are subject to the Mozilla Public License  
# Version
# 1.1 (the "License"); you may not use this file except in compliance  
# with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
# 
# Software distributed under the License is distributed on an "AS IS"  
# basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the  
# License
# for the specific language governing rights and limitations under the
# License.
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

# Top level pavement for putting together the Bespin project.
import sys
import tarfile

from paver.defaults import *

HEADER = """ ***** BEGIN LICENSE BLOCK *****
Version: MPL 1.1

The contents of this file are subject to the Mozilla Public License  
Version 1.1 (the "License"); you may not use this file except in 
compliance  with the License. You may obtain a copy of the License at
http://www.mozilla.org/MPL/

Software distributed under the License is distributed on an "AS IS"  
basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. 
See the License for the specific language governing rights and
limitations under the License.

The Original Code is Bespin.

The Initial Developer of the Original Code is Mozilla.
Portions created by the Initial Developer are Copyright (C) 2009
the Initial Developer. All Rights Reserved.

Contributor(s):
  Bespin Team (bespin@mozilla.com)

***** END LICENSE BLOCK *****
"""

options(
    version=Bunch(
        number="0.1.1",
        name="Naughty Nimbus",
        api="1"
    ),
    build_top=path("build"),
    build_dir=lambda: options.build_top / "BespinServer",
    compress_js=Bunch(
        compressor_version = "2.4.2",
        zip_name = lambda: "yuicompressor-%s.zip" % options.compressor_version,
        url = lambda: "http://www.julienlecomte.net/yuicompressor/%s" % \
                options.zip_name,
        beautiful_soup_url = "http://www.crummy.com/software/BeautifulSoup/download/BeautifulSoup.tar.gz"
    ),
    license=Bunch(
        extensions = set([
            ("py", "#"), ("js", "//")
        ]),
        exclude=set([
            './backend/python/lib',
            './frontend/js/external',
            './backend/python/bin',
            './backend/python/bootstrap.py'
        ])
    )
)

def _get_js_file_list(html_file):
    from BeautifulSoup import BeautifulSoup
    html = html_file.text()
    soup = BeautifulSoup(html)
    tags = soup.findAll("script")
    result = []
    for tag in tags:
        result.append(tag['src'])
    return result

def _install_compressed(front_end_target, yui_dir, html_file, output_file):
    # concatenate the files
    file_list = _get_js_file_list(html_file)
    output_filename = front_end_target / "js" / output_file
    compressed_filename = path(output_filename.replace("_uncompressed", ""))
    output_file = open(output_filename, "w")
    for f in file_list:
        js_file = front_end_target / f
        output_file.write(js_file.bytes())
        output_file.write("\n")
    output_file.close()
    
    info("Running YUI Compressor")
    jars = (yui_dir / "lib").glob("*.jar")
    cp = ":".join(jars)
    sh("env CLASSPATH=%s java -jar %s -o %s %s" % (
        cp,
        yui_dir / "build" / ("yuicompressor-%s.jar" % options.compressor_version),
        compressed_filename,
        output_filename
        ))
    
    html_lines = html_file.lines()
    
    # strip out the MPL
    if html_lines[0].startswith("<!--"):
        end_marker = None
        for i in range(0, len(html_lines)):
            if "-->" in html_lines[i]:
                end_marker = i
                break
        del html_lines[0:end_marker+1]
    
    start_marker = None
    end_marker = None
    for i in range(0, len(html_lines)):
        if "<!-- begin script tags -->" in html_lines[i]:
            start_marker = i
        elif "<!-- end script tags -->" in html_lines[i]:
            end_marker = i
    del html_lines[start_marker:end_marker+1]
    html_lines.insert(start_marker, '<script type="text/javascript" src="js/%s"></script>'
                                    % compressed_filename.basename())
    html_file.write_bytes("".join(html_lines))

@task
def copy_front_end():
    build_dir = options.build_dir
    build_dir.mkdir()
    front_end_target = build_dir / "frontend"
    if front_end_target.exists():
        front_end_target.rmtree()
    front_end_source = path("frontend")
    front_end_source.copytree(front_end_target)
    
def update_python_version():
    version_file = path("backend/python/bespin/__init__.py")
    in_version_block = False
    lines = version_file.readlines()
    replaced_lines = []
    for i in range(0, len(lines)):
        line = lines[i]
        if "BEGIN VERSION BLOCK" in line:
            in_version_block = True
            continue
        if "END VERSION BLOCK" in line:
            break
        if not in_version_block:
            continue
        if line.startswith("VERSION ="):
            lines[i] = "VERSION = '%s'\n" % (options.version.number)
        elif line.startswith("VERSION_NAME ="):
            lines[i] = 'VERSION_NAME = "%s"\n' % (options.version.name)
        elif line.startswith('API_VERSION'):
            lines[i] = "API_VERSION = '%s'" % (options.version.api)
        else:
            raise BuildFailure("Invalid Python version number line: %s" % line)
        replaced_lines.append(lines)
    version_file.writelines(lines)
    return replaced_lines
    
def restore_python_version(replaced_lines):
    version_file = path("backend/python/bespin/__init__.py")
    lines = version_file.readlines()
    version_block_start = None
    version_block_end = None
    for i in range(0, len(lines)):
        line = lines[i]
        if "BEGIN VERSION BLOCK" in line:
            version_block_start = i
        if "END VERSION BLOCK" in line:
            version_block_end = i
            break
    lines[version_block_start+1:version_block_end] = replaced_lines
    version_file.writelines(lines)

@task
@needs(['copy_front_end'])
def compress_js():
    """Compress the JavaScript using the YUI compressor."""
    current_dir = path.getcwd()
    build_dir = options.build_dir
    front_end_target = build_dir / "frontend"
    
    externals_dir = path("ext")
    externals_dir.mkdir()
    yui_dir = externals_dir / ("yuicompressor-%s" % options.compressor_version)
    if not yui_dir.exists():
        zip_file = externals_dir / options.zip_name
        externals_dir.chdir()
        if not zip_file.exists():
            info("Downloading %s", options.url)
            sh("curl -O %s" % options.url)
        sh("unzip %s" % options.zip_name)
        current_dir.chdir()
    bs_dir = externals_dir.glob("BeautifulSoup-*")
    if not bs_dir:
        bs_file = externals_dir / "BeautifulSoup.tar.gz"
        externals_dir.chdir()
        if not bs_file.exists():
            info("Downloading %s", options.beautiful_soup_url)
            sh("curl -O %s" % options.beautiful_soup_url)
        sh("tar xzf BeautifulSoup.tar.gz")
        current_dir.chdir()
        bs_dir = externals_dir.glob("BeautifulSoup-*")
    bs_dir = bs_dir[0]
    sys.path.append(bs_dir)
    
    editor_filename = front_end_target / "editor.html"
    _install_compressed(front_end_target, yui_dir, editor_filename, "editor_all_uncompressed.js")
    
    dashboard_filename = front_end_target / "dashboard.html"
    _install_compressed(front_end_target, yui_dir, dashboard_filename, "dashboard_all_uncompressed.js")
    
    index_filename = front_end_target / "index.html"
    _install_compressed(front_end_target, yui_dir, index_filename, "index_all_uncompressed.js")
    
@task
def prod_server():
    """Creates the production server code."""
    current_directory = path.getcwd()
    replaced_lines = dry("Updating Python version number", update_python_version)
    path("backend/python").chdir()
    sh("bin/paver production")
    dry("Restoring Python version number", restore_python_version, replaced_lines)
    current_directory.chdir()
    
@task
@needs(['prod_server'])
def dist():
    """Generate a tarball that is ready for deployment to the server."""
    options.build_dir.rmtree()
    backend = path("backend/python/production")
    backend.copytree(options.build_dir)
    copy_front_end()
    compress_js()
    docs = path("docs")
    docs.copytree(options.build_dir / "docs")
    
    current_directory = path.getcwd()
    
    options.build_top.chdir()
    tf = tarfile.open("BespinServer.tar.gz", mode="w:gz")
    tf.add("BespinServer")
    tf.close()
    current_directory.chdir()
    
    info("Output file is in build/BespinServer.tar.gz")

def _apply_header_if_necessary(f, header, first_line, last_line):
    data = f.bytes()
    if data.startswith(header):
        debug("File is already tagged")
        return
    debug("Tagging %s", f)
    if data.startswith(first_line):
        pos = data.find(last_line) + len(last_line)
        data = data[pos:]
    data = header + data
    f.write_bytes(data)

@task
def license():
    """Tags the appropriate files with the license text."""
    cwd = path(".")
    info("Tagging license text")
    for extension, comment_marker in options.extensions:
        hlines = [comment_marker + " " + line for line in HEADER.split("\n")]
        header = "\n".join(hlines) + "\n\n"
        first_line = hlines[0]
        last_line = hlines[-1]
        for f in cwd.walkfiles("*.%s" % extension):
            exclude = False
            for pattern in options.exclude:
                if f.startswith(pattern):
                    exclude=True
                    break
            if exclude:
                continue
            debug("Checking %s", f)
            _apply_header_if_necessary(f, header, first_line, last_line)
    