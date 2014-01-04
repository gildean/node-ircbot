// About the bot

var config = require('../config');
var trigger = config.trigger + 'about';
var pluginTrigger = config.trigger + 'plugins';

module.exports = function (irc) {
    'use strict';
    irc.on('message', function (from, channel, message) {
        if (message === trigger) {
            irc.say(channel, 'Node.js ircbot by: ok 2013, check the code at https://github.com/gildean/node-ircbot');
        } else if (message === pluginTrigger) {
        	irc.say(channel, 'Loaded plugins: ' + config.plugins.join(', '));
        }
    });
};
