dependencies = {
    layers: [
        {
            name: "../index_all.js",
            dependencies: [
                "bespin.page.index.dependencies"
            ]
        },
        {
            name: "../editor_all.js",
            dependencies: [
                "bespin.page.editor.dependencies"
            ]
        }
    ],
    prefixes: [
        ["dijit", "../dijit"],
        ["dojox", "../dojox"],
        ["bespin", "../bespin"],
    ]
};
