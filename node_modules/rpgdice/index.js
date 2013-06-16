var events = require('events'),
    util = require('util');

var Dice = function () {
    events.EventEmitter.call(this);
    var self = this;
    this.roll = function (dice, roller, game) {
        var roller = roller || 'player',
            game = game || null,
            error = false,
            i, dices, times, withoutmod, result, mod, die, rolls;
        if (dice) {
            self.emit('rolling', dice, roller, game);
            dices = dice.split('d');
            if (dices.length > 1) {
                times = parseInt(dices[0]);
                withoutmod = dices[1].split('+');
                die = parseInt(withoutmod[0]) - 1;
                result = 0;
                rolls = [];
                function rolling() {
                    return parseInt(Math.round(Math.random() * die) + 1);
                };
                if (!isNaN(die) && die > 0 && die < 1000001 && times > 0 && times < 1001) {
                    for (i = 0; i < times; i += 1) {
                        roll = rolling();
                        rolls.push(roll);
                        self.emit('roll', roll, roller, game);
                        result += roll;
                    };
                } else {
                    error = true;
                    self.emit('misroll', new Error('A die must have 2 to 1M sides and you must roll 1 to 1k times'), roller, game);
                }
                if (withoutmod.length > 1) {
                    mod = parseInt(withoutmod[1]);
                    if (!isNaN(mod)) {
                        result += mod;
                        rolls.push(mod);
                    }
                }
            } else {
                error = true;
                self.emit('misroll', new Error('Malformed dice'), roller, game);
            }
            if (result && !error) {
                self.emit('result', dice, rolls, result, roller, game);
            }
        } else {
            error = true;
            self.emit('misroll', new Error('No dice'), roller, game);
        }
    };
};

util.inherits(Dice, events.EventEmitter);

module.exports = new Dice();
