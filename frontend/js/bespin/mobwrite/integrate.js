
dojo.provide("bespin.mobwrite.integrate");

// BESPIN

/**
 * Constructor of shared object representing a text field.
 * @param {Node} shareNode A Bespin shared node
 * @constructor
 */
mobwrite.shareBespinObj = function(shareNode) {
    this.shareNode = shareNode;
    // Call our prototype's constructor.
    mobwrite.shareObj.apply(this, [ shareNode.id ]);
};

// The textarea shared object's parent is a shareObj.
mobwrite.shareBespinObj.prototype = new mobwrite.shareObj('');

/**
 * Retrieve the user's text.
 * @return {string} Plaintext content.
 */
mobwrite.shareBespinObj.prototype.getClientText = function() {
    return this.shareNode.getClientText();
};

/**
 * Set the user's text.
 * @param {string} text New text
 */
mobwrite.shareBespinObj.prototype.setClientText = function(text) {
    this.shareNode.setClientText(text);
};

/**
 * Modify the user's plaintext by applying a series of patches against it.
 * @param {Array<patch_obj>} patches Array of Patch objects
 */
mobwrite.shareBespinObj.prototype.patchClientText = function(patches) {
    // Set some constants which tweak the matching behavior.
    // Tweak the relative importance (0.0 = accuracy, 1.0 = proximity)
    this.dmp.Match_Balance = 0.5;
    // At what point is no match declared (0.0 = perfection, 1.0 = very loose)
    this.dmp.Match_Threshold = 0.6;

    var oldClientText = this.getClientText();
    var result = this.dmp.patch_apply(patches, oldClientText);
    // Set the new text only if there is a change to be made.
    if (oldClientText != result[0]) {
        // Good place to capture the cursor position
        this.setClientText(result[0]);
        // Good place to restore the cursor position
    }
    if (mobwrite.debug) {
        for (var x = 0; x < result[1].length; x++) {
            if (result[1][x]) {
                console.info('Patch OK.');
            } else {
                console.warn('Patch failed: ' + patches[x]);
            }
        }
    }
};

/**
 * Handler to accept text fields as elements that can be shared.
 * If the element is a textarea, text or password input, create a new
 * sharing object.
 * @param {*} node Object or ID of object to share
 * @return {Object?} A sharing object or null.
 */
mobwrite.shareBespinObj.shareHandler = function(node) {
    if (node.isShareNode === true) {
        node.shareHandler = new mobwrite.shareBespinObj(node);
        return node.shareHandler;
    } else {
        return null;
    }
};

// Register this shareHandler with MobWrite.
mobwrite.shareHandlers.push(mobwrite.shareBespinObj.shareHandler);
