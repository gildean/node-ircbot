//gets title to a link automagically

var util = require('util');
var events = require('events');
var httpGet = require('http-get-shim');
var config = require('../config');

var Links = function Links(client) {
    'use strict';
    var self = this;
    var urlRegex = /(\b(https?):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/?%=~_|][^\s]+)/ig;
    var titleRegex = /<title>.+?<\/title>/ig;

    function sendToclient(err, title, channel) {
        if (!err && title) {
            client.say(channel, title);
        } else if (err) {
            client.say(channel, err);
        }
    }
    
    function parseTitle(response, message, channel, shortLink) {
        var title = (message.match(titleRegex)) ? message.match(titleRegex)[0].replace('<title>', '').replace('</title>', '') : '';
        var data = (response.statusCode > 299) ? 'Error ' + response.statusCode + ' ' + title : title;
        var msg = (shortLink) ? data + ' || ' + shortLink : data;
        self.emit('sendToclient', null, msg, channel);
    }

    function getPageTitle(message, channel, shortLink) {
        var req = httpGet(message, function (err, response, answer) {
            if (!err && answer) {
                self.emit('gotTitle', response, answer, channel, shortLink);
            } else if (err) {
                self.emit('sendToclient', err.message, null, channel);
            }
        });
    }

    this.onMessage = function (channel, msg) {
        var message = msg.match(urlRegex);
        if (message) {
            message.forEach(function (uri) {
                self.emit('getPageTitle', uri.trim(), channel, null);
            });
        }
    };

    this.on('getPageTitle', getPageTitle)
        .on('gotTitle', parseTitle)
        .on('sendToclient', sendToclient);
    
    client.on('message', function (from, to, message) {
        if (from !== config.nick) {
            self.onMessage(to, message);
        }
    });
};

util.inherits(Links, events.EventEmitter);

module.exports = function (client) {
    return new Links(client); 
};
