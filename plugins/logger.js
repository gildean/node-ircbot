// logging plugin
//
// the timestamp is in seconds from epoch
// if you want the logs to be accessible through http 
// and/or if you want to use a custom dir for the log-db, set those in the config.json
// e.g. "logs": { "http": 9084, "path": "/my/custom/logdir" }

var fs = require('fs');
var levelup = require('level');
var subLevel = require('level-sublevel');
var config = require('../config');
var logPath = (config.logs && config.logs.path) ? config.logs.path : './logs';
var logDirExists = fs.existsSync(logPath);

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
function nowSec() {
    return Math.round(Date.now() / 1000);
}

module.exports = function (irc) {

    // on a message-event, write to the channel-log stream
    irc.on('message', function (nick, channel, message) {
        logFiles[channel].ws.write({ key: nowSec(), value: { nick: nick, message: message } });
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
                    res.write(data.key + ' <' + data.value.nick + '> ' + data.value.message + '\n');
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
