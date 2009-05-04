/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 * See the License for the specific language governing rights and
 * limitations under the License.
 *
 * The Original Code is Bespin.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bespin Team (bespin@mozilla.com)
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * Jetpack Plugin
 * --------------
 *
 * The Jetpack plugin aims to make Bespin a good environment for creating and hosting Jetpack extensions.
 *
 * Read more about Jetpack at: https://wiki.mozilla.org/Labs/Jetpack/API
 */

dojo.provide("bespin.jetpack");

dojo.require("bespin.util.webpieces");
dojo.require("bespin.cmd.commands");
dojo.require("bespin.cmd.commandline");

bespin.jetpack.projectName = "jetpacks";

// Command store for the Jetpack commands
// (which are subcommands of the main 'jetpack' command)
bespin.jetpack.commands = new bespin.cmd.commandline.CommandStore({ subCommand: {
    name: 'jetpack',
    preview: 'play with jetpack features',
    completeText: 'subcommands: create [name] [type], install [name], list, edit [name]',
    subcommanddefault: 'help'
}});

// = Commands =
// Jetpack related commands

// ** {{{Command: jetpack help}}} **
bespin.jetpack.commands.addCommand({
    name: 'help',
    takes: ['search'],
    preview: 'show commands for jetpack subcommand',
    description: 'The <u>help</u> gives you access to the various commands in the Bespin system.<br/><br/>You can narrow the search of a command by adding an optional search params.<br/><br/>Finally, pass in the full name of a command and you can get the full description, which you just did to see this!',
    completeText: 'optionally, narrow down the search',
    execute: function(self, extra) {
        bespin.cmd.displayHelp(bespin.jetpack.commands, self, extra, "<br><br>For more info and help on the available API, <a href='https://wiki.mozilla.org/Labs/Jetpack/API'>check out the Reference</a>");
    }
});

// ** {{{Command: jetpack create}}} **
bespin.jetpack.commands.addCommand({
    name: 'create',
    takes: ['feature', 'type'],
    preview: 'create a new jetpack feature of the given type (defaults to sidebar)',
    description: 'Create a new jetpack feature that you can install into Firefox with the new Jetpack goodness.',
    completeText: 'name of your feature, type of JetPack template (sidebar, content, toolbar)',
    template: {
        sidebar: "<feature id='TEMPLATE_NAME' name='TEMPLATE_NAME Sidebar Extension' version='0.1' description='TEMPLATE_NAME Sidebar Test Extension. Opens a sidebar with some HTML code.'>\n<!-- SAMPLE SIDEBAR JETPACK FEATURE -->\n<!-- For more help, read the API documentation at: https://wiki.mozilla.org/Labs/Jetpack/API -->\n   <script>\n    let sidebar;\n\n    function install() {\n      sidebar =\n        Jetpack.UI.Sidebars.create(\n          { id: 'test', name: 'TEMPLATE_NAME Test Sidebar',\n            content: $('#sidebar-content')[0] });\n      window.setInterval(function() { updateTime(); }, 1000);\n    }\n\n    function updateTime() {\n      $('#time')[0].textContent = (new Date()).toString();\n      Jetpack.UI.Sidebars.update({ sidebar : sidebar });\n    }\n\n    function uninstall() {\n    }\n  </script>\n  <div id='sidebar-content'>\n    <h1>Success!</h1>\n    <p>Your sidebar extension was installed correctly!</p>\n    <p>The current <strong>date and time</strong> is:</p>\n    <ul>\n    <li id='time'></li>\n    </ul>\n    <p>And the code:</p>\n    <code><pre>\n    let sidebar;\n\n    function install() {\n      sidebar =\n        Jetpack.UI.Sidebars.create(\n          { id: 'test', name: 'Test Sidebar',\n            content: $('#sidebar-content')[0] });\n      window.setInterval(function() { updateTime(); }, 1000);\n    }\n\n    function updateTime() {\n      $('#time')[0].textContent = (new Date()).toString();\n      Jetpack.UI.Sidebars.update({sidebar : sidebar});\n    }\n    </pre></code>\n  </div>\n</feature>",
        content: "<feature\n  id=\"TEMPLATE_NAME\"\n  name=\"Twitter Video Embedder\"\n  version=\"0.1\"\n  description=\"TEMPLATE_NAME adds video embeds to YouTube links on Twitter.\"\n  previewimage=\"http://jetpack.s3.amazonaws.com/twitter/preview.jpg\">\n\n<!-- SAMPLE CONTENT SCRIPT JETPACK FEATURE -->\n<!-- For more help, read the API documentation at: https://wiki.mozilla.org/Labs/Jetpack/API -->\n  <script><![CDATA[\n\n    function install() {\n      // The addEmbedsToTwitter function would be injected and run in matched\n      // pages. Referencing any variables outside this function wouldn't work.\n      let addEmbedsToTwitter = function() {\n        let template =\n         '<object width=\"425\" height=\"373\">' +\n         '  <param name=\"movie\" value=\"http://www.youtube.com/v/%s&rel=0&border=0\"></param>' +\n         '  <param name=\"wmode\" value=\"transparent\"></param>' +\n         '  <embed src=\"http://www.youtube.com/v/%s&rel=0&border=0\"' +\n         ' type=\"application/x-shockwave-flash\" wmode=\"transparent\"' +\n         ' width=\"425\" height=\"373\"></embed></object>';\n\n\n        $(\"a\").each(function() {\n          let url = $(this).attr(\"href\")\n\n    // some of the youtube links contain ... at the end so ignore them.\n   if (url.indexOf('youtube.com/watch?v=') < 0 ||\n        (url.charAt(url.length-1) == \".\")) {\n      return;\n     }\n\n          let videoId = this.href.match('=([a-zA-Z_0-9\-]+)')[1];\n          let div = document.createElement(\"div\");\n\n          div.innerHTML = template.replace(/%s/g, videoId);\n          $(this).before(div);\n        });\n      }\n\n      // Go to http://search.twitter.com/search?q=youtube+watch to see\n      // the results.  Patterns should contain regular expressions in string\n      // format.\n      Jetpack.Content.addLoadHandler({\n        patterns: [\"twitter.com/\"], filter: addEmbedsToTwitter });\n    };\n\n  ]]></script>\n</feature>",
        toolbar: "<feature id=\"TEMPLATE_NAME\" name=\"Weather Demo\" version=\"0.1\"\n  description=\"TEMPLATE_NAME sidebar and toolbar button demo using Weather.\"\n  previewimage=\"http://jetpack.s3.amazonaws.com/weather/preview.jpg\">\n\n<!-- SAMPLE TOOLBAR JETPACK FEATURE -->\n<!-- For more help, read the API documentation at: https://wiki.mozilla.org/Labs/Jetpack/API -->\n  <require src=\"http://jetpack.s3.amazonaws.com/weather/icon.png\" />\n\n  <script require=\"false\" src=\"http://j.maxmind.com/app/geoip.js\" />\n  <script><![CDATA[        \n    let weatherURL;\n\n    function toTwoDigits(aNumber) {\n      return (aNumber < 10) ? \"0\" + aNumber : String(aNumber);\n    }\n\n    function isToday(aDay) {\n      let dayIndex = new Date().getDay();\n      let days = [ \"Sun\", \"Mon\", \"Tue\", \"Wed\", \"Thu\", \"Fri\", \"Sat\" ];\n      let isToday = false;\n\n      if (dayIndex < days.length && aDay == days[dayIndex]) {\n        isToday = true;\n      }\n\n      return isToday;\n    }\n\n    function updateTime() {\n      let date = new Date();\n      let time =\n        toTwoDigits(date.getHours()) + \":\" + toTwoDigits(date.getMinutes());\n\n      if ($(\"#time\").text() != time) {\n        $(\"#time\").text(time);\n        // reload sidebars.\n        Jetpack.UI.Sidebars.update({ id : \"weathersb\" });\n\n        Jetpack.Logger.log({ message: \"Sidebar Update.\" });\n      }\n    }\n\n    function updateWeather() {\n      Jetpack.Logger.log({ message: \"updateTime()\" });\n\n      $.get(\n        weatherURL,\n        function(xml) {\n          let date = new Date();\n\n          $(\"#last-update-time\").text(\n            toTwoDigits(date.getHours()) + \":\" +\n            toTwoDigits(date.getMinutes()));\n          $(\"#forecast\").empty();\n\n          $(xml).find(\"current_conditions\").each(function() {\n            let title = \"<br/><Strong>Current</strong><br/>\";\n            let content =\n              \"<div style='float: left;  width: 50px;'>\" +\n            \"<img style='border: 1px solid #606060' \" +\n            \"src='http://www.google.com/\" +\n            $(this).find(\"icon\").attr(\"data\") + \"'></div>\" +\n            \"<div>Feels Like: \" + $(this).find(\"temp_f\").attr(\"data\") +\n            \"&deg;F<br/>\" +\n            $(this).find(\"humidity\").attr(\"data\") + \"<br/>\" +\n            $(this).find(\"wind_condition\").attr(\"data\") + \"</div>\";\n\n            $(\"<div/>\").html(title).appendTo(\"#forecast\");\n            $(\"<div/>\").html(content).appendTo(\"#forecast\");\n          });\n\n          $(xml).find(\"forecast_conditions\").each(function(i, entry) {\n            let day = $(this).find(\"day_of_week\").attr(\"data\");\n            let title;\n            let content;\n\n            if (i == 0) {\n              day = isToday(day) ? \"Today\" : day;\n            }\n            title = \"<br/><Strong>\" + day + \"</strong><br/>\";\n            content =\n              \"<div style='float: left;  width: 50px;'>\" +\n              \"<img style='border: 1px solid #606060' \" +\n              \"src='http://www.google.com/\" +\n              $(this).find(\"icon\").attr(\"data\") + \"'></div>\" +\n              \"<div>\" + $(this).find(\"condition\").attr(\"data\") + \"<br/>\" +\n              \"High: \" + $(this).find(\"high\").attr(\"data\") + \"&deg;F<br/>\" +\n              \"Low: \" + $(this).find(\"low\").attr(\"data\") + \"&deg;F</div>\";\n\n            $(\"<div/>\").html(title).appendTo(\"#forecast\");\n            $(\"<div/>\").html(content).appendTo(\"#forecast\");\n          });\n        });\n    }\n\n    function install() {\n      Jetpack.Logger.log(\"install()\");\n\n      let city = geoip_city();\n      let country = geoip_country_name();\n\n      weatherURL =\n      \"http://www.google.com/ig/api?weather=\" +\n      encodeURIComponent(city) + \",\" + encodeURIComponent(country);\n\n      $(\"#location\").text(city + \", \" + country);\n\n      // add the sidebar.\n      Jetpack.UI.Sidebars.create({\n        id: \"weathersb\", name: \"Weather Sidebar\",\n        content: $(\"#sidebar-content\")[0] });\n\n      // add the toolbar button.\n      Jetpack.UI.Toolbars.Main.create(\n       { id: \"weather-toggle\", name: \"Weather\", icon: \"icon.png\",\n         command: \"Jetpack.UI.Sidebars.toggle('weathersb')\" });\n\n      // update data and trigger the regular refresh intervals.\n      updateTime();\n      window.setInterval(function() { updateTime(); }, 1000);\n\n      updateWeather();\n      window.setInterval(function() { updateWeather(); }, 3600000);\n    }\n  ]]></script>\n\n  <div id=\"sidebar-content\"\n    style=\"background-color: #FFFFFF; height: 100%;\">\n    <div style=\"padding: 8px; font-size: 12px;\">\n      <span style=\"font-weight: bold\" id=\"location\"></span>\n      <div id=\"forecast\"></div>\n\n      <br/>\n      <p>Last Weather Update: <strong id=\"last-update-time\"></strong></p>\n      <p>Current Time: <strong id=\"time\"></strong></p>\n    </div>\n  </div>\n</feature>"
    },
    execute: function(self, opts) {
        var feature = opts.feature || 'newjetpack';
        var type = (opts.type && this.template[opts.type]) ? opts.type : 'sidebar';

        // make sure that the jetpacks project is alive!
        bespin.get('files').makeDirectory(bespin.jetpack.projectName, "");

        // create a new file in BespinSettings/jetpack/{feature}.html
        bespin.publish("editor:newfile", {
            project: bespin.jetpack.projectName,
            newfilename: feature + '.html',
            content: this.template[type].replace(/TEMPLATE_NAME/g, feature)
        });
    }
});

// ** {{{Command: jetpack install}}} **
bespin.jetpack.commands.addCommand({
    name: 'install',
    takes: ['feature'],
    preview: 'install a jetpack feature',
    description: 'Install a Jetpack feature, either the current file, or the named feature',
    completeText: 'optionally, the name of the feature to install',
    execute: function(self, feature) {
        // For when Aza exposes the Jetpack object :)
        // if (!window['Jetpack']) {
        //     bespin.publish("message", { msg: "To install a Jetpack, you need to have installed the extension.<br><br>For now this lives in Firefox only, and you can <a href='https://wiki.mozilla.org/Labs/Jetpack/API'>check it out, and download the add-on here</a>." });
        //     return;
        // }

        // Use the given name, or default to the current jetpack
        feature = feature || (function() {
            var editSession = bespin.get('editSession');
            if (editSession.project != bespin.jetpack.projectName) return; // jump out if not in the jetpack project
            var bits = editSession.path.split('.');
            return bits[bits.length - 2];
        })();

        if (!feature) {
            bespin.publish("message", { msg: "Please pass in the name of the Jetpack feature you would like to install" });
        } else {
            // add the link tag to the body
            // <link rel="jetpack" href="1.0/main.html" name="testExtension">
            var link = dojo.create("link", {
                rel: 'jetpack',
                href: bespin.util.path.combine("preview/at", bespin.jetpack.projectName, feature + ".html"),
                name: feature
            }, dojo.body());
        }
    }
});

// ** {{{Command: jetpack list}}} **
bespin.jetpack.commands.addCommand({
    name: 'list',
    preview: 'list out the Jetpacks that you have written',
    description: 'Which Jetpacks have you written and have available in BespinSettings/jetpacks. NOTE: This is not the same as which Jetpacks you have installed in Firefox!',
    execute: function(self, extra) {
        bespin.get('server').list(bespin.jetpack.projectName, '', function(jetpacks) {
            var output;

            if (!jetpacks || jetpacks.length < 1) {
                output = "You haven't installed any Jetpacks. Run '> jetpack create' to get going.";
            } else {
                output = "<u>Your Jetpack Features</u><br/><br/>";

                output += dojo.map(dojo.filter(jetpacks, function(file) {
                    return bespin.util.endsWith(file.name, '\\.html');
                }), function(c) {
                    return "<a href=\"javascript:bespin.get('commandLine').executeCommand('open " + c.name + " " + bespin.jetpack.projectName + "');\">" + c.name.replace(/\.html$/, '') + "</a>";
                }).join("<br>");
            }

            bespin.publish("message", { msg: output });
        });
    }
});

// ** {{{Command: jetpack edit}}} **
bespin.jetpack.commands.addCommand({
    name: 'edit',
    takes: ['feature'],
    preview: 'edit the given Jetpack feature',
    completeText: 'feature name to edit (required)',
    usage: '[feature]: feature name required.',
    execute: function(self, feature) {
        if (!feature) {
            self.showUsage(this);
            return;
        }

        var path = feature + '.html';

        bespin.get('files').whenFileExists(bespin.jetpack.projectName, path, {
            execute: function() {
                bespin.publish("editor:openfile", {
                    project: bespin.jetpack.projectName,
                    filename: path
                });
            },
            elseFailed: function() {
                bespin.publish("message", {
                    msg: "No feature called " + feature + ".<br><br><em>Run 'jetpack list' to see what is available.</em>"
                });
            }
        });
    }
});

/*
 * Jetpack Settings
 *
 * If you "set jetpack on", wire up the toolbar to have the jetpack icon
 */

// ** {{{ Event: settings:set:jetpack }}} **
//
// Turn off the toolbar icon if set to off
bespin.subscribe("settings:set:jetpack", function(event) {
    var newset = bespin.get("settings").isOff(event.value);
    var jptb = dojo.byId('toolbar_jetpack');

    if (newset) { // turn it off
        if (jptb) jptb.style.display = 'none';
    } else { // turn it on
        if (jptb) {
            jptb.style.display = 'inline';
        } else {
            // <img id="toolbar_jetpack" src="images/icn_jetpack.png" alt="Jetpack" style="padding-left: 10px;" title="Jetpack (show or hide menu)">
            dojo.byId('subheader').appendChild(dojo.create("img", {
               id: "toolbar_jetpack",
               src: "images/icn_jetpack.png",
               alt: "Jetpack",
               style: "padding-left: 10px",
               title: "Jetpack (show or hide menu)"
            }));

            // wire up the toolbar fun
            bespin.get("toolbar").setup("jetpack", "toolbar_jetpack");
        }
    }
});

// Toolbar
// Add the jetpack toolbar

bespin.subscribe("toolbar:init", function(event) {
    event.toolbar.addComponent('jetpack', function(toolbar, el) {
        var jetpack = dojo.byId(el) || dojo.byId("toolbar_jetpack");

        dojo.connect(jetpack, 'mouseover', function() {
            jetpack.src = "images/icn_jetpack_on.png";
        });

        dojo.connect(jetpack, 'mouseout', function() {
            jetpack.src = "images/icn_jetpack.png";
        });

        // Change the font size between the small, medium, and large settings
        dojo.connect(jetpack, 'click', function() {
            var dropdown = dojo.byId('jetpack_dropdown');

            if (!dropdown || dropdown.style.display == 'none') { // no dropdown or hidden, so show
                dropdown = dropdown || (function() {
                    var dd = dojo.create("div", {
                        id: 'jetpack_dropdown',
                    });

                    var editor_coords = dojo.coords('editor');
                    var jetpack_coorders = dojo.coords(jetpack);
                    dojo.style(dd, {
                        position: 'absolute',
                        padding: '0px',
                        top: editor_coords.y + 'px',
                        left: (jetpack_coorders.x - 30) + 'px',
                        display: 'none',
                        zIndex: '150'
                    })

                    dd.innerHTML = '<table id="jetpack_dropdown_content"><tr><th colspan="3">Jetpack Actions</th></tr><tr><td>create</td><td><input type="text" size="7" value="jetpack"></td><td><input type="button" value="now &raquo;"></td></tr><tr id="jetpack_dropdown_or"><td colspan="3" align="center">or</td></tr><tr><td>install</td><td><select><option>foo<option>bar</select></td><td><input type="button" value="now &raquo;"></td></tr></table><div id="jetpack_dropdown_border">&nbsp;</div>';

                    document.body.appendChild(dd);
                    dd.style.right = '-50000px';
                    dd.style.display = 'block';
                    var content_coords = dojo.coords('jetpack_dropdown_content');
                    dd.style.right = '';
                    dd.style.display = 'none';

                    dojo.style('jetpack_dropdown_border', {
                      width: content_coords.w + 'px',
                      height: content_coords.h + 'px'
                    })

                    return dd;
                })();

                dropdown.style.display = 'block';
            } else { // hide away
                dropdown.style.display = 'none';
            }
        });
    });
});