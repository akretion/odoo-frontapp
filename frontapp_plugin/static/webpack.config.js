module.exports = {
    entry: "./src/js/frontapp_es6_bridge.js",
    output: {
        path: __dirname + "/dist",
        filename: "frontapp-plugin-sdk.js",
    },
    module: {
        rules: [
            {
                test: /\.m?js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env"],
                    },
                },
            },
        ],
    },
};
