dependencies = {
    layers: [
        {
            name: "index_all.js",
            dependencies: [
                "bespin.user.dependencies"
            ]
        },
        {
            name: "editor_all.js",
            dependencies: [
                "bespin.bootstrap_dependencies"
            ]
        }
    ],
    prefixes: [
        ["dijit", "../dijit"],
        ["dojox", "../dojox"],
        ["bespin", "../bespin"]
    ]
};
