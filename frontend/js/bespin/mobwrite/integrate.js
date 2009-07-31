
dojo.provide("bespin.mobwrite.integrate");

/**
 * Constructor of shared object representing a text field.
 * @param {Node} shareNode A Bespin shared node
 * @constructor
 */
mobwrite.shareBespinObj = function(shareNode) {
    this.shareNode = shareNode;
    this.shareNode.setShareObj(this);
    // Call our prototype's constructor.
    mobwrite.shareObj.apply(this, [ shareNode.id ]);
};

// The bespin shared object's parent is a mobwrite shareObj.
mobwrite.shareBespinObj.prototype = new mobwrite.shareObj('');

/**
 * Retrieve the user's text.
 * @return {string} Plaintext content.
 */
mobwrite.shareBespinObj.prototype.getClientText = function(allowUnsynced) {
    return this.shareNode.getClientText(allowUnsynced);
};

/**
 * Set the user's text.
 * @param {string} text New text
 */
mobwrite.shareBespinObj.prototype.setClientText = function(text) {
    console.log('shareBespinObj.setClientText(... ' + text.length + ' chars)');
    this.shareNode.setClientText(text);
};

/**
 * Modify the user's plaintext by applying a series of patches against it.
 * @param {Array<patch_obj>} patches Array of Patch objects
 */
mobwrite.shareBespinObj.prototype.patchClientText = function(patches) {
    this.shareNode.patchClientText(patches);
};

/**
 * We've done a sync and didn't need to make any changes, but bespin might
 * want to call onSuccess
 */
mobwrite.shareBespinObj.prototype.syncWithoutChange = function() {
    this.shareNode.syncWithoutChange();
};

/**
 * Display an updated list of collaborators
 */
mobwrite.shareBespinObj.prototype.reportCollaborators = function(userEntries) {
    this.shareNode.reportCollaborators(userEntries);
};

/**
 * Handler to accept text fields as elements that can be shared.
 * If the element is a bespin share node, create a new sharing object.
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
