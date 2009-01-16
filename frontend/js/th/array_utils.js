var ArrayUtils = {
    /*
     * Returns a new array without the passed item, if it was present in the old array
     */
    remove: function(array, item) {
        var newa = [];
        for (var i = 0; i < array.length; i++) {
            if (array[i] !== item) newa.push(array[i]);
        }
        return newa;
    },

    /*
     * Wraps the passed object as an array if it is not one already
     */
    array: function(object) {
        return this.isArray(object) ? object : [ object ];
    },

    isArray: function(object) {
        return (object && object.constructor == Array);
    }
}