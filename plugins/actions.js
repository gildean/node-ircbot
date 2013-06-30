// irc commands plugin
var fs = require('fs');
var levelup = require('level');
var subLevel = require('level-sublevel');
var config = require('../config');
var trigger = config.trigger;
var admins = config.admins;
var actionsPath = (config.actions && config.actions.path) ? config.actions.path : './actions';
var actionsPathExists = fs.existsSync(actionsPath);

// make the dir for logs if it doesn't exist
if (!actionsPathExists) {
    fs.mkdirSync(actionsPath);
}

// then open/create the db
var actionsDb = subLevel(levelup(actionsPath + '/actionsDb'));

// create a sublevel for each channel
var actionFiles = {};
config.options.channels.forEach(function (channel) {
    actionFiles[channel] = actionsDb.sublevel(channel);
});

// export the plugin
module.exports = function (irc) {
    'use strict';
    var actions = {
        'kick': {
            msg: 'KICK',
        },
        'topic': {
            msg: 'TOPIC',
        },
        'ban': {
            msg: 'MODE',
            val: '+b'
        },
        'deban': {
            msg: 'MODE',
            val: '-b'
        },
        'op': {
            msg: 'MODE',
            val: '+o'
        },
        'deop':  {
            msg: 'MODE',
            val: '-o'
        },
        'voice':  {
            msg: 'MODE',
            val: '+v'
        },
        'devoice':  {
            msg: 'MODE',
            val: '-v'
        },
        'auto-op':  {
            msg: 'MODE',
            val: '+o'
        },
        'auto-deop':  {
            msg: 'MODE',
            val: '-o'
        },
        'auto-voice':  {
            msg: 'MODE',
            val: '+v'
        },
        'auto-devoice': {
            msg: 'MODE',
            val: '-v'
        }
    };

    // helper function for sending the actions to irc
    var sendAction = function sendAction(calledAction, calledUser, channel) {
        var action = actions[calledAction];
        if (action.hasOwnProperty('val')) {
            irc.send(action.msg, channel, action.val, calledUser);
        } else {
            irc.send(action.msg, channel, calledUser);
        }
    };


    // attach listeners for the message and join events
    irc
    .on('message', function (from, channel, message) {
        var msgPart = message.replace(config.trigger, '').split(' ');
        var calledAction = msgPart[0];
        var calledUser = msgPart[1];
        if (actions.hasOwnProperty(calledAction) && admins.indexOf(from) > -1) {
            var auto = calledAction.split('-');
            if (auto.length > 1) {
                irc.whois(calledUser, function (info) {
                    if (info.user && info.host) {
                        var autoUser = info.user + '@' + info.host;
                        if (auto[1].match('^de')) {
                            actionFiles[channel].del(autoUser, function (err) {
                                if (!err) {
                                    irc.say(channel, 'Removed' calledAction + ' from ' + calledUser);
                                } else {
                                    irc.say(channel, 'Error: ' + err.message);
                                }
                            });
                        } else {
                            actionFiles[channel].put(autoUser, calledAction, function (err) {
                                if (!err) {
                                    irc.say(channel, 'Added ' + calledAction + ' to ' + calledUser);
                                } else {
                                    irc.say(channel, 'Error: ' + err.message);
                                }
                            });
                        }
                    } else {
                        irc.say(channel, 'No such user');
                    }
                });
            }
            sendAction(calledAction, calledUser, channel);
        }
    })
    .on('join', function (channel, nick, message) {
        var getAutoUser = message.user + '@' + message.host;
        actionFiles[channel].get(getAutoUser, function (err, value) {
            if (!err && value) {
                sendAction(value, nick, channel);
            }
        });
    });
};
