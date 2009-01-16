# Top level pavement for putting together the Bespin project.
import sys

from paver.defaults import *

options(
    build_dir=path("build"),
    compress_js=Bunch(
        compressor_version = "2.4.2",
        zip_name = lambda: "yuicompressor-%s.zip" % options.compressor_version,
        url = lambda: "http://www.julienlecomte.net/yuicompressor/%s" % \
                zip_name,
        beautiful_soup_url = "http://www.crummy.com/software/BeautifulSoup/download/BeautifulSoup.tar.gz"
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