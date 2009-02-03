//  ***** BEGIN LICENSE BLOCK *****
// Version: MPL 1.1
// 
// The contents of this file are subject to the Mozilla Public License  
// Version
// 1.1 (the "License"); you may not use this file except in compliance  
// with
// the License. You may obtain a copy of the License at
// http://www.mozilla.org/MPL/
// 
// Software distributed under the License is distributed on an "AS IS"  
// basis,
// WITHOUT WARRANTY OF ANY KIND, either express or implied. See the  
// License
// for the specific language governing rights and limitations under the
// License.
// 
// The Original Code is Bespin.
// 
// The Initial Developer of the Original Code is Mozilla.
// Portions created by the Initial Developer are Copyright (C) 2009
// the Initial Developer. All Rights Reserved.
// 
// Contributor(s):
// 
// ***** END LICENSE BLOCK *****
// 

if (typeof Bespin == "undefined") Bespin = {};
if (!Bespin.Commands) Bespin.Commands = {};

Bespin.Commands.Dashboard = [
{
            name: 'help',
            takes: ['search'],
            preview: 'show commands',
            description: 'The <u>help</u> gives you access to the various commands in the Bespin system.<br/><br/>You can narrow the search of a command by adding an optional search params.<br/><br/>If you pass in the magic <em>hidden</em> parameter, you will find subtle hidden commands.<br/><br/>Finally, pass in the full name of a command and you can get the full description, which you just did to see this!',
            completeText: 'optionally, narrow down the search',
            execute: function(self, extra) {
                var commands = [];
                if (self.commands[extra]) { // caught a real command
                    commands.push("<u>Help for the command: <em>" + extra + "</em></u><br/>");
                    var command = self.commands[extra];
                    commands.push(command['description'] ? command.description : command.preview);
                } else {
                    var showHidden = false;
                    commands.push("<u>Commands Available</u><br/>");

                    if (extra) {
                        if (extra == "hidden") { // sneaky, sneaky.
                            extra = "";
                            showHidden = true;
                        }
                        commands.push("<em>(starting with</em> " + extra + " <em>)</em><br/>");
                    }

                    var tobesorted = [];
                    for (name in self.commands) {
                        tobesorted.push(name);
                    }

                    var sorted = tobesorted.sort();
                    
                    for (var i = 0; i < sorted.length; i++) {
                        var name = sorted[i];
                        var command = self.commands[name];

                        if (!showHidden && command.hidden) continue;
                        if (extra && name.indexOf(extra) != 0) continue;

                        var arguments = (command.takes) ? ' [' + command.takes.order.join('] [') + ']' : '';
                        commands.push('<b>' + name + arguments + '</b>: ' + command.preview);
                    }
                }
                self.showInfo(commands.join("<br/>"));
            }
}];