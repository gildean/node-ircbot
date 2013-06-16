// About the bot

var config = require('../config');
var trigger = config.trigger + 'about';

module.exports = function (client) {
    'use strict';
    client.on('message', function (from, to, message) {
        if (message.indexOf(trigger) === 0) {
            client.say(to, 'Node.js ircbot by: ok 2013, check the code at https://github.com/gildean/node-ircbot');
        }
    });
};
