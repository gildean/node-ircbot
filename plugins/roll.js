// rpg-dice rolling plugin

var dice = require('rpgdice');
var config = require('../config');
var trigger = config.trigger + 'roll';
var len = trigger.length + 1;

module.exports = function (client) {
    'use strict';
    client.on('message', function (from, to, message) {
        if (message.indexOf(trigger) === 0) {
            if (message.length > len) {
                dice.roll(message.substring(len), from, to);
            } else {
                client.say(to, from + ': ' + 'Roll a dice e.g. \'' + trigger + ' 1d6+2\'');
            }
        }
    });
    dice.on('result', function (dice, rolls, result, roller, game) {
        client.say(game, roller + ': ' + dice + ' [' + rolls.join('+') + '] => ' + result);
    });
    dice.on('misroll', function (error, roller, game) {
        client.say(game, roller + ': ' + error);
    });
};
