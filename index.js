var irc = require('irc');
var config = require('./config');
var client = new irc.Client(config.server, config.nick, config.options);
var plugins = {};

config.plugins.forEach(function (plugin) {
    plugins[plugin] = require('./plugins/' + plugin)(client);
});

client.addListener('error', function (message) {
    console.log('error: ', message);
});
