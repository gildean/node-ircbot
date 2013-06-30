// logging plugin
//
// the timestamp is in milliseconds from epoch
// if you want the logs to be accessible through http
// and/or if you want to use a custom dir for the log-db, set those in the config.json
// e.g. "logs": { "http": 9084, "path": "/my/custom/logdir" }

var fs = require('fs');
var levelup = require('level');
var subLevel = require('level-sublevel');
var config = require('../config');
var logPath = (config.logs && config.logs.path) ? config.logs.path : './logs';
var logDirExists = fs.existsSync(logPath);
var selfNick = config.nick;

// make the dir for logs if it doesn't exist
if (!logDirExists) {
    fs.mkdirSync(logPath);
}
// then open/create the db
var logDb = subLevel(levelup(logPath + '/logDb'));

// create a sublevel for each channel log and create a writable stream
var logFiles = {};
config.options.channels.forEach(function (channel) {
    logFiles[channel] = logDb.sublevel(channel, { valueEncoding: 'json' });
    logFiles[channel].ws = logFiles[channel].createWriteStream({ type: 'put', valueEncoding: 'json' });
});

// a helper function to return epoch in seconds
function nowSec(n) {
    return Math.round(parseInt(n) / 1000);
}


module.exports = function (irc) {

    // on a message-event, write to the channel-log stream
    irc
    .on('selfMessage', function (channel, message) {
        // this delays the writing of the messages sent by the bot, as they happen faster than other messages
        setTimeout(function() {
            logFiles[channel].ws.write({ key: Date.now(), value: { type: 'message', nick: selfNick, message: message } });
        }, 2);
    })
    .on('message', function (nick, channel, message) {
        logFiles[channel].ws.write({ key: Date.now(), value: { type: 'message', nick: nick, message: message } });
    })
    .on('topic', function (channel, topic, nick, message) {
        logFiles[channel].ws.write({ key: Date.now(), value: { type: 'topic', nick: nick, message: topic } });
    })
    .on('join', function (channel, nick, message) {
        logFiles[channel].ws.write({ key: Date.now(), value: { type: 'join', nick: nick } });
    })
    .on('part', function (channel, nick, reason, message) {
        logFiles[channel].ws.write({ key: Date.now(), value: { type: 'part', nick: nick, message: reason } });
    })
    .on('quit', function (nick, reason, channels, message) {
        channels.forEach(function (channel) {
            if (logFiles.hasOwnProperty(channel)) {
                logFiles[channel].ws.write({ key: Date.now(), value: { type: 'quit', nick: nick, message: reason } });
            }
        });
    })
    .on('kick', function (channel, nick, by, reason, message) {
        logFiles[channel].ws.write({ key: Date.now(), value: { type: 'kick', nick: nick, message: reason, by: by } });
    })
    .on('kill', function (nick, reason, channels, message) {
        channels.forEach(function (channel) {
            if (logFiles.hasOwnProperty(channel)) {
                logFiles[channel].ws.write({ key: Date.now(), value: { type: 'kill', nick: nick, message: reason } });
            }
        });
    })
    .on('+mode', function (channel, by, mode, argument, message) {
        logFiles[channel].ws.write({ key: Date.now(), value: { type: '+mode', nick: by, message: mode, argument: argument } });
    })
    .on('-mode', function (channel, by, mode, argument, message) {
        logFiles[channel].ws.write({ key: Date.now(), value: { type: '-mode', nick: by, message: mode, argument: argument } });
    })
    .on('nick', function (oldnick, newnick, channels, message) {
        channels.forEach(function (channel) {
            if (logFiles.hasOwnProperty(channel)) {
                logFiles[channel].ws.write({ key: Date.now(), value: { type: 'nick', nick: oldnick, message: newnick } });
            }
        });
    });

    // make some simple html for the possible http-server
    var html = '<!DOCTYPE html><html><head><title>IrcLogs</title><style>body{font:105% Arial, sans-serif}</style></head><body>';
    html += '<h2>Channels</h2>';
    config.options.channels.forEach(function (chan) {
        html += '<h3><a href="/' + chan.replace('#', '') + '">' + chan + '</a></h3>';
    });
    html += '</body></html>\n';

    // the http-connection eventhandler
    var app = function app(req, res) {
        if (req.url === '/') {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(html);
        } else {
            var ch = req.url.replace('/', '#');
            if (logFiles.hasOwnProperty(ch)) {
                res.writeHead(200, {'Content-Type': 'text/plain'});
                logFiles[ch].createReadStream()
                .on('data', function (data) {
                    var msg = '';
                    switch (data.value.type) {
                        case 'message':
                            msg = nowSec(data.key) + ' <' + data.value.nick + '> ' + data.value.message + '\n';
                            break;
                        case 'topic':
                            msg = nowSec(data.key) + ' -- Topic: ' + data.value.message + ' -- set by: ' + data.value.nick + '\n';
                            break;
                        case 'join':
                            msg = nowSec(data.key) + ' -- ' + data.value.nick + ' joined' + '\n';
                            break;
                        case 'part':
                            msg = nowSec(data.key) + ' -- ' + data.value.nick + ' parted: [' + data.value.message + ']' + '\n';
                            break;
                        case 'quit':
                            msg = nowSec(data.key) + ' -- ' + data.value.nick + ' quits: [' + data.value.message + ']' + '\n';
                            break;
                        case 'kick':
                            msg = nowSec(data.key) + ' -- ' + data.value.nick + ' was kicked by: ' + data.value.by + ' [' + data.value.message + ']' + '\n';
                            break;
                        case 'kill':
                            msg = nowSec(data.key) + ' -- ' + data.value.nick + ' was killed: [' + data.value.message + ']' + '\n';
                            break;
                        case '+mode':
                            msg = nowSec(data.key) + ' -- ' + data.value.nick + ' sets mode: +' + data.value.message + ' to: ' + data.value.argument + '\n';
                            break;
                        case '-mode':
                            msg = nowSec(data.key) + ' -- ' + data.value.nick + ' sets mode: -' + data.value.message + ' to: ' + data.value.argument + '\n';
                            break;
                        case 'nick':
                            msg = nowSec(data.key) + ' -- ' + data.value.nick + ' is now known as: ' + data.value.message + '\n';
                            break;
                    }
                    res.write(msg);
                })
                .on('end', function () {
                    res.end('\n');
                });
            } else {
                res.statusCode = 404;
                res.end('Page not found\n');
            }
        }
    };

    // if the http-port is set in config, start a server
    if (config.logs && config.logs.http) {
        var logserver = require('http').createServer(app).listen(config.logs.http);
    }
};
