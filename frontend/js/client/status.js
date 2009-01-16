var StatusChecker = Class.create({
    initialize: function() {
        this.interval;
        this.statusMessages = [
            "Bob is editing the file brick.html",
            "Emily is creating a new tag called 'v3.4'",
            "Jessica is saving the file kidly.html",
            "John is idle. Lazy git!",
            "Mickey has checked in a set of 4 files to project 'Bank'",
            "Don has created the function 'doCalculation' in class 'Bank'",
            "Benji is deleting the function 'doCalculation' in class 'Bank'"
        ];
    },

    start: function() {
        this.interval = setInterval(function() {
            this.updateStatus();
        }.bind(this), 12000);
    },

    stop: function() {
        clearInterval(this.interval);
    },

    updateStatus: function() {
        var randomMessage = this.randomStatus();
        this.setStatus(randomMessage);
    },

    randomStatus: function() {
        var random = Math.floor(Math.random() * this.statusMessages.length)
        return this.statusMessages[random];
    },

    setStatus: function(message) {
        $('message').innerHTML = message;
    }
})