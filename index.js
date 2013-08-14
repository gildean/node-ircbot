#!/usr/bin/env node

// node-ircbot by: ok 2013
// license: MIT (http://ok.mit-license.org)
// set your configs to config.json before running
var irc = require('irc');
var config = require('./config');
var client = new irc.Client(config.server, config.nick, config.options);
var plugins = {};

// load up all plugins
config.plugins.forEach(function (plugin) {
    plugins[plugin] = require('./plugins/' + plugin)(client);
});

// adding a listener for errors, this prevents crashing on otherwise unhandled errors
// note: the plugins should always handle their own errors still
client.addListener('error', function (message) {
    console.log('error: ', message);
});
