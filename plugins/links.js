//gets title to a link automagically

var util = require('util');
var events = require('events');
var ent = require('ent');
var httpGet = require('http-get-shim');
var config = require('../config');

var Links = function Links(irc) {
    'use strict';
    var self = this;
    var urlRegex = /(\b(https?):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/?%=~_|][^\s]+)/ig;
    var titleRegex = /<title>.+?<\/title>/ig;

    function sendToclient(err, title, channel) {
        if (!err && title) {
            irc.say(channel, ent.decode(title));
        } else if (err) {
            irc.say(channel, err);
        }
    }
    
    function parseTitle(response, message, channel) {
        var title = (message.match(titleRegex)) ? message.match(titleRegex)[0].replace('<title>', '').replace('</title>', '') : '';
        var data = (response.statusCode > 299) ? 'Error ' + response.statusCode + ' ' + title : title;
        self.emit('sendToclient', null, data, channel);
    }

    function getPageTitle(message, channel) {
        var req = httpGet(message, function (err, response, answer) {
            if (!err && answer) {
                self.emit('gotTitle', response, answer, channel);
            } else if (err) {
                self.emit('sendToclient', err.message, null, channel);
            }
        });
    }

    this.onMessage = function (channel, msg) {
        var message = msg.match(urlRegex);
        if (message) {
            message.forEach(function (uri) {
                self.emit('getPageTitle', uri.trim(), channel);
            });
        }
    };

    this.on('getPageTitle', getPageTitle)
        .on('gotTitle', parseTitle)
        .on('sendToclient', sendToclient);
    
    irc.on('message', function (from, to, message) {
        if (from !== config.nick) {
            self.onMessage(to, message);
        }
    });
};

util.inherits(Links, events.EventEmitter);

module.exports = function (irc) {
    return new Links(irc); 
};
