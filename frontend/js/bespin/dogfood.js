dojo.provide("bespin.dogfood");

bespin.cmd.commands.add({
  name: 'dogfood',
  takes: ['action'],
  //  type: [Bespin.Commands.Editor, Bespin.Commands.Dashboard],
  preview: 'execute your own code in the project named "bespin"',
  completeText: 'dogfood on|off|toggle',
  execute: function(self, action) {
    var opts = {
      onSuccess: function(response) {
        bespin.publish("message", { msg: response });
      },
      onFailure: function(xhr) {
        bespin.publish("message", {
          msg: "Failed. Maybe due to: " + xhr.responseText });
      }
    };

    if (action == "on" || action == "off" || action == "toggle") {
      bespin.get('server').request('POST', 'dogfood/' + action, null, opts);
    } else {
      bespin.publish("message", {msg: "dogfood on|off|toggle"});
    }
    return;
  },

});
