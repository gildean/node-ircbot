var dice = require('rpgdice');
var config = require('../config');
var trigger = config.trigger + 'roll';
var len = trigger.length + 1;

module.exports = function (client) {
    client.addListener('message', function (from, to, message) {
        if (message.indexOf(trigger) === 0) {
            dice.roll(message.substring(len), from, to);
        }
    });
    dice.on('result', function (dice, rolls, result, roller, game) {
        client.say(game, roller + ': ' + dice + ' [' + rolls.join('+') + '] => ' + result);
    });
    dice.on('misroll', function (error, roller, game) {
        client.say(game, roller + ': ' + error);
    });
};
