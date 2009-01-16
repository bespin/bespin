var LazyTreeModel = Class.define({
    type: "LazyTreeModel",

    members: {
        placeholder: "(placeholder)",

        loading: "(loading)",

        root: this.placeholder,

        getRoot: function() {
            return this.root;
        },

        getChildren: function(parent) {

        },

        loadChildren: function(parent) {

        },

        childrenLoaded: function(parent, children) {}
    }
});