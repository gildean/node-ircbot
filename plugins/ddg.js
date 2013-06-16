// Use the duckduckgo api

var qs = require('querystring');
var url = require('url');
var httpGet = require('http-get-shim');
var config = require('../config');
var trigger = config.trigger + 'ddg';
var mesLen = trigger.length + 1;

module.exports = function (irc) {
    'use strict';

    var question = function (nick, channel, message) {

        function isValidJson(json) {
            try {
                return JSON.parse(json);
            } catch (e) {
                return false;
            }
        }

        function sendToclient(err, links) {
            return irc.say(channel, nick + ': ' + ((!err) ? links : err));
        }
        
        function getDataFromJson(jsonn, query, cb) {
            var json = isValidJson(jsonn);
            if (json) {
                var abstractText = (json.AbstractText) ? (json.AbstractText.replace(/\n/ig, ' ').replace(/<pre>.+?<\/pre>/ig, '')) + ' || ' : '';
                var abstractSource = (json.AbstractSource && json.AbstractURL) ? json.AbstractSource + ': ' + json.AbstractURL + ' || ' : '';
                var answerText = (json.Answer) ? json.Answer + ' || ' : '';
                var definitionText = (json.DefinitionText && json.DefinitionURL) ? 'Definition ( ' + json.DefinitionURL + ' ): ' + json.DefinitionText + ' || ' : '';
                var redirect = (json.Redirect) ? url.resolve('https://duckduckgo.com', json.Redirect) + ' || ' : '';
                var links = abstractText + abstractSource + answerText + definitionText + redirect;
                if (links === '') {
                    links = 'https://duckduckgo.com/?q=' + query + '    ';
                }
                return cb(null, links.substring(0, links.length - 4));
            } else {
                return cb('No valid answer', null);
            }
        }

        function handleAnswer(err, answer, query) {
            if (!err) {
                return getDataFromJson(answer, query, sendToclient);
            } else {
                return sendToclient(err);
            }
        }

        (function searchDdg(message, cb) {
            var msg = qs.escape(message.substring(mesLen).trim());
            if (msg !== '') {
                var qPath = '/?q=' + msg + '&format=json&no_redirect=1&no_html=1';
                var options = {
                    hostname: 'api.duckduckgo.com',
                    path: qPath
                };
                var req = httpGet(options, function (err, res, json) {
                    if (!err) {
                        return cb(null, json, msg);
                    } else {
                        return cb(err.message, null);
                    }
                });
            } else {
                return cb('DuckDuckGo e.g. \'' + trigger + ' define google\' or \'' + trigger + ' 10+20*50\'', null);
            }
        }(message, handleAnswer));

    };

    irc.on('message', function (from, to, message) {
        if (message.indexOf(trigger) === 0) {
            question(from, to, message);
        }
    });

};
