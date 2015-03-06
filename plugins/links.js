//gets title to a link automagically

var util = require('util');
var events = require('events');
var ent = require('ent');
var request = require('request');
var config = require('../config');

util.inherits(Links, events.EventEmitter);
function Links(irc) {
    'use strict';
    var self = this;
    this.irc = irc;
    this.titleRegex = /<title>(.*?)<\/title>/i;
    this.urlRegex = /(\b(https?):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/?%=~_|][^\s]+)/ig;
    this.on('getPageTitle', this.getPageTitle)
        .on('gotTitle', this.parseTitle)
        .on('sendToclient', this.sendToclient);

    irc.on('message', function (from, to, message) {
        if (from !== config.nick) return self.onMessage(to, message);
        return;
    });
}

Links.prototype.onMessage = function onMessage(channel, msg) {
    var self = this;
    var message = msg.match(this.urlRegex);
    if (message) {
        message.forEach(function (uri) {
            if (!/localhost|127\.|\.[zip|jpg|png|gif|gz|tar|rar|tiff]$/.test(uri)) return self.emit('getPageTitle', uri.trim(), channel);
        });
    }
};

Links.prototype.sendToclient = function sendToclient(err, title, channel) {
    if (err || title) return this.irc.say(channel, '➤➤ ' + ((!err) ? ent.decode(title) : err));
};

Links.prototype.parseTitle = function parseTitle(response, message, channel) {
    var title = message.match(this.titleRegex);
    title = title.length ? title[1] : '';
    var data = (response.statusCode > 299) ? 'Error ' + response.statusCode + ' ' + title : title;
    return self.emit('sendToclient', null, data, channel);
};

Links.prototype.getPageTitle = function getPageTitle(message, channel) {
    var self = this;
    return request(message, function (err, response, answer) {
        if (!err && answer) {
            return self.emit('gotTitle', response, answer, channel);
        } else if (err) {
            return self.emit('sendToclient', err.message, null, channel);
        }
    }).setMaxListeners(20);
};

module.exports = function (irc) {
    return new Links(irc);
};
