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
 
dojo.provide("bespin.dashboard_dependencies");

dojo.require("dojo.cookie"); 

dojo.require("bespin.bespin"); 

dojo.require("bespin.util.canvas");
dojo.require("bespin.util.keys"); 
dojo.require("bespin.util.navigate");
dojo.require("bespin.util.path");
dojo.require("bespin.util.tokenobject");
dojo.require("bespin.util.clipboard"); 
              
dojo.require("bespin.client.filesystem");
dojo.require("bespin.client.settings");
dojo.require("bespin.client.server");
              
dojo.require("bespin.cmd.commandline");
dojo.require("bespin.cmd.commands");
dojo.require("bespin.cmd.dashboardcommands");
              
dojo.require("bespin.th.helpers");
dojo.require("bespin.th.css");
dojo.require("bespin.th.th");
dojo.require("bespin.th.models");
dojo.require("bespin.th.borders");
dojo.require("bespin.th.components");
              
dojo.require("bespin.client.dashboard_components");
dojo.require("bespin.client.dashboard");