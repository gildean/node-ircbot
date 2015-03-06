require('use-strict');
var Sandbox = require('sandbox');
var config = require('../config');
var trigger = new RegExp('^' + config.trigger + 'js');

module.exports = function (irc) {
    'use strict';
    var sandbox = new Sandbox();
    function run(from, channel, message) {
        sandbox.run(message.replace(trigger,'').trim(), function jsOutput(output) {
            irc.say(channel, from + ', results: ' + output.result + ((output.console && output.console.length) ? ' console: ' + output.console.join(', ') : ''));
        });
    }
    irc.on('message', function (from, channel, message) {
        if (trigger.test(message)) return run(from, channel, message);
    });
};
