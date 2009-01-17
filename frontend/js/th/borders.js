var SimpleBorder = Class.define({
    type: "SimpleBorder",

    superclass: Border,

    members: {
        init: function(parms) {
            this._super(parms);
        },

        getInsets: function() {
            return { left: 1, right: 1, top: 1, bottom: 1 };
        },

        paint: function(ctx) {
            var b = this.component.bounds;
            ctx.strokeStyle = this.style.color;
            ctx.strokeRect(0, 0, b.width, b.height);
        }
    }
});

var EmptyBorder = Class.define({
    type: "EmptyBorder",

    superclass: Border,

    members: {
        init: function(parms) {
            if (!parms) parms = {};
            this._super(parms);

            if (parms.size) {
                this.insets = { left: parms.size, right: parms.size, top: parms.size, bottom: parms.size };
            } else {
                this.insets = parms.insets;
            }
        },

        getInsets: function() {
            return this.insets;
        }
    }
});