/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check
'use strict';

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/


const path = require('path');
const webpack = require('webpack');

/** @type WebpackConfig */
const baseExtensionConfig = {
	mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
	target: 'webworker', // extensions run in a webworker context
	entry: {
		'extension': './src/extension/extension.ts',
	},
	output: {
		filename: '[name].js',
		path: path.join(__dirname, './dist'),
		libraryTarget: 'commonjs',
		devtoolModuleFilenameTemplate: '../../[resource-path]',
		// publicPath: '/',
		// globalObject: 'this',
	},
	resolve: {
		mainFields: ['browser', 'module', 'main'], // look for `browser` entry point in imported node modules
		extensions: ['.ts', '.js', '.tsx', '.json', '.svg', '.scss'],
		alias: {
			// provides alternate implementation for node module and source files
		},
		fallback: {
			// Webpack 5 no longer polyfills Node.js core modules automatically.
			// see https://webpack.js.org/configuration/resolve/#resolvefallback
			// for the list of Node.js core module polyfills.
			'assert': require.resolve('assert')
		}
	},
	module: {
		rules: [{
		// 	test: () => true, // disable tree shaking for all file, we want whole libraries; https://github.com/jcubic/lips/wiki/Webpack
		// 	sideEffects: true
		// },{
			test: /\.tsx?$/,
			exclude: /node_modules/,
			use: [{
				loader: 'ts-loader'
			}]
		}, {
			test: /\.css$/,
			use: ['style-loader', 'css-loader'],
		}, {
			test: /\.scss$/,
			exclude: /node_modules/,
			use: [
				'style-loader',
				'css-modules-typescript-loader',
				// {loader: 'css-loader', options: {modules: true}},
				'css-loader',
				'resolve-url-loader',
				'sass-loader',
			],
		}, {
			test: /\.scm$/i,
			use: 'raw-loader',
		}]
	},
    externalsPresets: { node: true },
	plugins: [
		new webpack.optimize.LimitChunkCountPlugin({
			maxChunks: 1 // disable chunks by default since web extensions must be a single bundle
		}),
		new webpack.ProvidePlugin({
			process: 'process/browser', // provide a shim for the global `process` variable
		})
	],
	externals: {
		'vscode': 'commonjs vscode', // ignored because it doesn't exist
	},
	performance: {
		hints: false
	},
	devtool: 'nosources-source-map', // create a source map that points to the original source file
	infrastructureLogging: {
		level: "log", // enables logging required for problem matchers
	},
};


const webviewExtensionConfig = {
	...baseExtensionConfig,
	target: "web",
	entry: {
		'dpage-webview': './src/dpage/index.tsx'
	},
	plugins: [
		new webpack.DefinePlugin({
			'process.env': {
				'NODE_ENV': JSON.stringify('production'),
				'VSCODE_DEV': JSON.stringify(process.env.VSCODE_DEV),
				'VSCODE_VERSION': JSON.stringify(process.env.VSCODE_VERSION),
			}
		})
	]
};


module.exports = [ baseExtensionConfig, webviewExtensionConfig ];
