# Top level pavement for putting together the Bespin project.
import sys

from paver.defaults import *

HEADER = """ ***** BEGIN LICENSE BLOCK *****
Version: MPL 1.1

The contents of this file are subject to the Mozilla Public License  
Version
1.1 (the "License"); you may not use this file except in compliance  
with
the License. You may obtain a copy of the License at
http://www.mozilla.org/MPL/

Software distributed under the License is distributed on an "AS IS"  
basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the  
License
for the specific language governing rights and limitations under the
License.

The Original Code is Bespin.

The Initial Developer of the Original Code is Mozilla.
Portions created by the Initial Developer are Copyright (C) 2009
the Initial Developer. All Rights Reserved.

Contributor(s):

***** END LICENSE BLOCK *****
"""

options(
    build_dir=path("build"),
    compress_js=Bunch(
        compressor_version = "2.4.2",
        zip_name = lambda: "yuicompressor-%s.zip" % options.compressor_version,
        url = lambda: "http://www.julienlecomte.net/yuicompressor/%s" % \
                zip_name,
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

@task
def compress_js():
    """Compress the JavaScript using the YUI compressor."""
    current_dir = path.getcwd()
    build_dir = options.build_dir
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
    
    build_dir.mkdir()
    front_end_target = build_dir / "frontend"
    if front_end_target.exists():
        front_end_target.rmtree()
    front_end_source = path("frontend")
    front_end_source.copytree(front_end_target)
    
    # concatenate the files
    editor_filename = front_end_target / "editor.html"
    file_list = _get_js_file_list(editor_filename)
    output_filename = front_end_target / "js/combined_uncompressed.js"
    output_file = open(output_filename, "w")
    for f in file_list:
        js_file = front_end_target / f
        output_file.write(js_file.bytes())
    output_file.close()
    
    info("Running YUI Compressor")
    jars = (yui_dir / "lib").glob("*.jar")
    cp = ":".join(jars)
    sh("env CLASSPATH=%s java -jar %s -o %s %s" % (
        cp,
        yui_dir / "build" / ("yuicompressor-%s.jar" % options.compressor_version),
        front_end_target / "js/combined.js",
        front_end_target / "js/combined_uncompressed.js"
        ))
    
    editor_lines = editor_filename.lines()
    start_marker = None
    end_marker = None
    for i in range(0, len(editor_lines)):
        if "<!-- begin script tags -->" in editor_lines[i]:
            start_marker = i
        elif "<!-- end script tags -->" in editor_lines[i]:
            end_marker = i
    del editor_lines[start_marker:end_marker+1]
    editor_lines.insert(start_marker, '<script type="text/javascript" src="js/combined.js"></script>')
    editor_filename.write_bytes("".join(editor_lines))

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
    