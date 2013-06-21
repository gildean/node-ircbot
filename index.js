var irc = require('irc');
var config = require('./config');
var client = new irc.Client(config.server, config.nick, config.options);
var plugins = {};

// load up all plugins
config.plugins.forEach(function (plugin) {
    plugins[plugin] = require('./plugins/' + plugin)(client);
});

// adding a listener for errors, this prevents crashing on otherwise unhandled errors
client.addListener('error', function (message) {
    console.log('error: ', message);
});
