// rpg-dice rolling plugin

var dice = require('rpgdice');
var config = require('../config');
var trigger = config.trigger + 'roll';
var regExp = '^' + trigger;
var len = trigger.length + 1;

module.exports = function (irc) {
    'use strict';
    irc.on('message', function (from, to, message) {
        if (message.match(regExp)) {
            if (message.length > len) {
                dice.roll(message.substring(len), from, to);
            } else {
                irc.say(to, from + ': ' + 'Roll a dice e.g. \'' + trigger + ' 1d6+2\'');
            }
        }
    });
    dice.on('result', function (dice, rolls, result, roller, game) {
        irc.say(game, roller + ': ' + dice + ' [' + rolls.join('+') + '] => ' + result);
    });
    dice.on('misroll', function (error, roller, game) {
        irc.say(game, roller + ': ' + error);
    });
};
