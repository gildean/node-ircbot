// logging plugin
//
// the timestamp is in milliseconds from epoch
// if you want the logs to be accessible through http
// and/or if you want to use a custom dir for the log-db, set those in the config.json
// e.g. "logs": { "http": 9084, "path": "/my/custom/logdir" }

var fs = require('fs');
var levelup = require('level');
var subLevel = require('level-sublevel');
var moment = require('moment');
var config = require('../config');
var logPath = (config.logs && config.logs.path) ? config.logs.path : './logs';
var logDirExists = fs.existsSync(logPath);
var selfNick = config.nick;
var url = require('url');

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
function nowTime(n) {
    return moment(n).format('H:mm:ss');
}

var previousMs = 0;
function uniqueMs(now) {
    if (now === previousMs) {
        var ms = now + 1;
        previousMs = ms;
        return ms;
    } else {
        previousMs = now;
        return now;
    }
}

function getMessageFromStream(time, value) {
    switch (value.type) {
        case 'message':
            return time + ' <' + value.nick + '> ' + value.message + '\n';
        case 'topic':
            return time + ' -- Topic: ' + value.message + ' -- set by: ' + value.nick + '\n';
        case 'join':
            return time + ' -- ' + value.nick + ' joined' + '\n';
        case 'part':
            return time + ' -- ' + value.nick + ' parted: [' + value.message + ']' + '\n';
        case 'quit':
            return time + ' -- ' + value.nick + ' quits: [' + value.message + ']' + '\n';
        case 'kick':
            return time + ' -- ' + value.nick + ' was kicked by: ' + value.by + ' [' + value.message + ']' + '\n';
        case 'kill':
            return time + ' -- ' + value.nick + ' was killed: [' + value.message + ']' + '\n';
        case '+mode':
            return time + ' -- ' + value.nick + ' sets mode: +' + value.message + ((value.argument) ? ' to: ' + value.argument + '\n' : '\n');
        case '-mode':
            return time + ' -- ' + value.nick + ' sets mode: -' + value.message + ((value.argument) ? ' to: ' + value.argument + '\n' : '\n');
        case 'nick':
            return time + ' -- ' + value.nick + ' is now known as: ' + value.message + '\n';
    }
}

module.exports = function (irc) {

    // on a message-event, write to the channel-log stream
    irc
    .on('selfMessage', function (channel, message) {
        if (!logFiles.hasOwnProperty(channel)) return;
        // this adds to the key of the messages sent by the bot, as they happen faster than other messages
        logFiles[channel].ws.write({ key: uniqueMs(Date.now() + 2), value: { type: 'message', nick: selfNick, message: message } });
    })
    .on('message', function (nick, channel, message) {
        if (!logFiles.hasOwnProperty(channel)) return;
        logFiles[channel].ws.write({ key: uniqueMs(Date.now()), value: { type: 'message', nick: nick, message: message } });
    })
    .on('topic', function (channel, topic, nick, message) {
        if (!logFiles.hasOwnProperty(channel)) return;
        logFiles[channel].ws.write({ key: uniqueMs(Date.now()), value: { type: 'topic', nick: nick, message: topic } });
    })
    .on('join', function (channel, nick, message) {
        if (!logFiles.hasOwnProperty(channel)) return;
        logFiles[channel].ws.write({ key: uniqueMs(Date.now()), value: { type: 'join', nick: nick } });
    })
    .on('part', function (channel, nick, reason, message) {
        if (!logFiles.hasOwnProperty(channel)) return;
        logFiles[channel].ws.write({ key: uniqueMs(Date.now()), value: { type: 'part', nick: nick, message: reason } });
    })
    .on('quit', function (nick, reason, channels, message) {
        channels.forEach(function (channel) {
            if (logFiles.hasOwnProperty(channel)) {
                logFiles[channel].ws.write({ key: uniqueMs(Date.now()), value: { type: 'quit', nick: nick, message: reason } });
            }
        });
    })
    .on('kick', function (channel, nick, by, reason, message) {
        if (!logFiles.hasOwnProperty(channel)) return;
        logFiles[channel].ws.write({ key: uniqueMs(Date.now()), value: { type: 'kick', nick: nick, message: reason, by: by } });
    })
    .on('kill', function (nick, reason, channels, message) {
        channels.forEach(function (channel) {
            if (logFiles.hasOwnProperty(channel)) {
                logFiles[channel].ws.write({ key: uniqueMs(Date.now()), value: { type: 'kill', nick: nick, message: reason } });
            }
        });
    })
    .on('+mode', function (channel, by, mode, argument, message) {
        if (!logFiles.hasOwnProperty(channel)) return;
        logFiles[channel].ws.write({ key: uniqueMs(Date.now()), value: { type: '+mode', nick: by, message: mode, argument: argument } });
    })
    .on('-mode', function (channel, by, mode, argument, message) {
        if (!logFiles.hasOwnProperty(channel)) return;
        logFiles[channel].ws.write({ key: uniqueMs(Date.now()), value: { type: '-mode', nick: by, message: mode, argument: argument } });
    })
    .on('nick', function (oldnick, newnick, channels, message) {
        channels.forEach(function (channel) {
            if (logFiles.hasOwnProperty(channel)) {
                logFiles[channel].ws.write({ key: uniqueMs(Date.now()), value: { type: 'nick', nick: oldnick, message: newnick } });
            }
        });
    });

    // make some simple html for the possible http-server
    var html = '<!DOCTYPE html><html><head><title>IrcLogs</title><style>body { font:105% sans-serif; width: 13.25rem; margin: 0 auto; color: dimgray; } span { margin: 0 0.5rem; display: inline-block; } footer { padding: 2.5rem 0 0; font-size: .9rem; } a { color: dodgerblue; text-decoration: none; }</style></head><body>';
    html += '<main><h2>Channels</h2>';
    config.options.channels.forEach(function (chan) {
        var chanLink = chan.replace('#', '');
        html += '<h3>' + chan + '</h3>';
        html += '<span><a href="/' + chanLink + '?days=1">day </a></span>';
        html += '<span><a href="/' + chanLink + '?days=7">week </a></span>';
        html += '<span><a href="/' + chanLink + '?days=30">month </a></span>';
        html += '<span><a href="/' + chanLink + '?days=365">year </a></span>';
    });
    html += '</main><footer><i>add queryparameter json=1 to get full json responses</i></footer></body></html>\n\n';

    // the http-connection eventhandler
    function app(req, res) {
        if (req.url === '/') {
            res.writeHead(200, {'Content-Type': 'text/html'});
            return res.end(html);
        }
        if (req.url === '/robots.txt') {
        	res.writeHead(200, {'Content-Type': 'text/plain'});
        	return res.end('User-agent: *\r\nDisallow: /\r\n');
        } 
        var reqUrl = url.parse(req.url, true);
        var queries = reqUrl.query;
        var ch = reqUrl.pathname.replace('/', '#');
        if (!logFiles.hasOwnProperty(ch)) {
            res.statusCode = 404;
            return res.end('Page not found\n');
        }
        var json = queries.hasOwnProperty('json');
        var options = { keys: true, values: true };
        var previousDay;
        res.writeHead(200, {'Content-Type': (json ? 'application/json' : 'text/plain; charset="utf-8"')});
        if (queries.days) {
            var end = Math.floor(Date.now() / 1000);
            options.end = end;
            options.start = end - (!isNaN(+queries.days) ? +queries.days * 86400 : 86400);
        }
        var rs = logFiles[ch].createReadStream(options);
        rs
        .on('data', function (data) {
            if (json) return res.write(JSON.stringify({ time: (+data.key), data: data.value }) + '\r\n');
            var key = +data.key;
            if (!previousDay) previousDay = moment(key).format('dddd, MMMM Do YYYY');
            var today = moment(key).format('dddd, MMMM Do YYYY');
            if (today !== previousDay) {
                res.write(' -- Day changed ' + today + '\n');
                previousDay = today;
            }
            var msg = getMessageFromStream(nowTime(key), data.value);
            if (msg) res.write(msg);
        })
        .on('end', function () {
            res.end('\n');
        })
        .on('error', function (err) {
            res.end('error\n');
            throw err;
        });

    }

    // if the http-port is set in config, start a server
    if (config.logs && config.logs.http) {
        var logserver = require('http').createServer(app).listen(config.logs.http);
    }
};
