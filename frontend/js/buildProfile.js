dependencies = {
    layers: [
        {
            name: "../index_all.js",
            dependencies: [
                "bespin.user.dependencies"
            ]
        },
        {
            name: "../editor_all.js",
            dependencies: [
                "bespin.bootstrap_dependencies"
            ]
        },
        {
            name: "../dashboard_all.js",
            dependencies: [
                "bespin.dashboard.dependencies"
            ]
        }
    ],
    prefixes: [
        ["dijit", "../dijit"],
        ["dojox", "../dojox"],
        ["bespin", "../bespin"],
        ["th", "../th"]
    ]
};
