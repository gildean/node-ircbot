// plugin for saving and querying quotes
// you can set the path to the leveldb file in the config.json
// e.g "logs": { "path": "/my/quotes/path" }
 
var util = require('util'),
    fs = require('fs'),
    events = require('events'),
    levelup = require('level'),
    subLevel = require('level-sublevel'),
    config = require('../config'),
    quotesPath = (config.quotes && config.quotes.path) ? config.quotes.path : './quotes',
    quotesPathExists = fs.existsSync(quotesPath);

// make the dir for quotes if it doesn't exist
if (!quotesPathExists) {
    fs.mkdirSync(quotesPath);
}

// create or open the db and sublevels for each channel
var quotesDb = subLevel(levelup(quotesPath + '/quotesDb'));
var quotesFiles = {};
var userFiles = {};
var memIterators = {};
var iterators;

config.options.channels.forEach(function (channel) {
    quotesFiles[channel] = quotesDb.sublevel(channel, { valueEncoding: 'json' });
    userFiles[channel] = quotesDb.sublevel(channel + 'Users');
    iterators = quotesDb.sublevel('iterators');
    memIterators[channel] = 0;
});

var Quote = function (irc) {
    'use strict';
    var self = this;
    (function (callback) {
        var j = config.options.channels.length - 1;
        var y = 0;
        config.options.channels.forEach(function (channel) {
            iterators.get(channel, function (err, i) {
                if (err) {
                    memIterators[channel] = 0;
                    iterators.put(channel, '0', function (err) {
                        if (err) {
                            throw err;
                        }
                    });
                } else {
                    memIterators[channel] = parseInt(i);
                }
                if (y === j) {
                    callback();
                } else {
                    y += 1;
                }
            });
        });
    }(mainFn));
    
    function has(ar, el) {
        return ar.indexOf(el) > -1;
    }

    function mainFn() {
        var trigger = 'quote',
            helpText = config.trigger + trigger,
            helpTxtLen = helpText.length + 1,
            ErrMsg = function ErrMsg(name, message, user) {
                return {
                    name: name,
                    message: message,
                    user: user
                };
            },
            notFoundErr = new ErrMsg('Not found', 'Sorry', true),
            authError = new ErrMsg('Permissions required', 'You don\'t have them', true),
            invalidAction = new ErrMsg('Invalid Action', 'Try again or try: ".quote help".', true),
            ircAdmins = config.admins;

         // main function
        var quote = function quote(nick, channel, message) {
            self.emit('message', channel, nick, message);
        },

        throwErr = function throwErr(channel, nick, err) {
            if (err && err.user) {
                irc.say(channel, nick + ': ' + err.name + ': ' + err.message);
            } else {
                throw err;
            }
        },
        
        helpMe = function helpMe(channel, message) {
            if (message.length === 1) {
                irc.say(channel, '- ' + helpText + ' <id> -- Get a a specific quote with an id-number.');
                irc.say(channel, '- ' + helpText + ' <nick> -- Get a random quote from nick.');
                irc.say(channel, '- ' + helpText + ' add <nick> <quote> -- Add a quote.');
                irc.say(channel, '- ' + helpText + ' rm <id-number> -- Removes a quote if you\'re the creator and/or admin.');
                irc.say(channel, 'Use "' + helpText + ' help user" for admin help');
            } else if (message[1] === 'user') {
                irc.say(channel, '- '+ helpText +' user list -- List current users.');
                irc.say(channel, '- '+ helpText +' user add <nick> [admin] -- Adds a new user. Admin value as boolean.');
                irc.say(channel, '- '+ helpText +' user rm <nick> -- Removes a user. Also removes all the quotes added by the user.');
            }
        },

        confirmAction = function confirmAction(channel, nick, id, action, type) {
            irc.say(channel, nick + ': ' + type + ' ' + id + ' ' + action);
        },

        sendQuoteToIrc = function sendQuoteToIrc(channel, nick, doc) {
            if (typeof(doc) === 'object' && doc.hasOwnProperty('idNumber')) {
                irc.say(channel, '(' + doc.idNumber + ') <' + doc.nick + '> ' + doc.quote);
            } else {
                irc.say(channel, nick + ': ' + doc);
            }
        },

        findAndVerifyUser = function findAndVerifyUser(channel, nick, callback) {
            userFiles[channel].get(nick, function (err, foundUser) {
                if ((foundUser && foundUser === 'true') || has(ircAdmins, nick)) {
                    callback(null, true);
                } else {
                    callback(authError, false);
                }
            });
        },

        addUser = function addUser(channel, nick, user, admin) {
            userFiles[channel].put(user, admin, function (saveerr) {
                if (!saveerr) {
                    self.emit('confirmAction', channel, nick, user, 'added', 'user');
                } else {
                    self.emit('quoteError', channel, nick, saveerr);
                }
            });
        },

        rmUser = function rmUser(channel, nick, user) {
            userFiles[channel].get(user, function (notfound, rmuser) {
                if (!notfound && rmuser) {
                    userFiles[channel].del(user, function (rmerr) {
                        if (!rmerr) {
                            self.emit('confirmAction', channel, nick, user, 'deleted', 'user');
                            quotesFiles[channel].createReadStream()
                                .on('data', function (data) {
                                    if (data.owner === user) {
                                        quotesFiles[channel].del(data.key);
                                    }
                                })
                                .on('error', function (qerr) {
                                    self.emit('quoteError', channel, nick, qerr);
                                });
                        } else {
                            self.emit('quoteError', channel, nick, rmerr);
                        }
                    });
                } else {
                    self.emit('quoteError', channel, nick, notFoundErr);
                }
            });
        },

        listUsers = function listUsers(channel, nick) {
            var userlist = 'Users added on this channel: ';
            userFiles[channel].createReadStream()
                .on('data', function (data) {
                    userlist += data.key;
                    userlist += (data.value === 'true') ? ' (admin), ' : ' (user), ';
                })
                .on('error', function (err) {
                    self.emit('quoteError', channel, nick, err);
                })
                .on('end', function () {
                    if (userlist.length > 29) {
                        userlist = userlist.substring(0, userlist.length - 2);
                    } else {
                        userlist = 'No users added to this channel';
                    }
                    self.emit('foundQuote', channel, nick, userlist);
                });
        },

        adminAction = function adminAction(channel, nick, message) {
            findAndVerifyUser(channel, nick, function (err, verified) {
                if (!err && verified) {
                    var action = message[1],
                        target, admin;
                    if (action === 'list') {
                        self.emit('listUsers', channel, nick);
                    } else if (message.length > 2) {
                        target = message[2].toLowerCase();
                        admin = message[3] || 'false';
                        if (action === 'add') {
                            self.emit('addUser', channel, nick, target, admin);
                        } else if (action === 'rm' || action === 'remove') {
                            self.emit('rmUser', channel, nick, target);
                        } else {
                            self.emit('quoteError', channel, nick, invalidAction);
                        }
                    } else {
                        self.emit('quoteError', channel, nick, invalidAction);
                    }
                } else {
                    self.emit('quoteError', channel, nick, err);
                }
            });
        },

        searchQuotesById = function searchQuotesById(channel, nick, id) {
            quotesFiles[channel].get(id, function (err, found) {
                if (!err && found) {
                    self.emit('foundQuote', channel, nick, found);
                } else {
                    self.emit('quoteError', channel, nick, notFoundErr);
                }
            });
        },

        searchQuotesByNick = function searchQuotesByNick(channel, nick, query) {
            var found = [];
            var queryNick = query.toLowerCase();
            quotesFiles[channel].createValueStream()
                .on('data', function (data) {
                    if (data.searchname === queryNick) {
                        found.push(data);
                    }
                })
                .on('error', function (err) {
                    self.emit('quoteError', channel, nick, err);
                })
                .on('end', function () {
                    var foundL = found.length;
                    if (foundL > 0) {
                        var foundQuote = found[Math.floor(Math.random() * foundL)];
                        self.emit('foundQuote', channel, nick, foundQuote);
                    } else {
                        self.emit('quoteError', channel, nick, notFoundErr);
                    }
                });
        },

        getRandomQuote = function getRandomQuote(channel, nick) {
            var rid = Math.floor(Math.random() * memIterators[channel]) + 1;
            quotesFiles[channel].get(rid, function (ferr, found) {
                if (!ferr && found) {
                    self.emit('foundQuote', channel, nick, found);
                } else {
                    self.emit('quoteError', channel, nick, notFoundErr);
                }
            });
        },

        getQuote = function getQuote(channel, nick, message) {
            var getter = message[0];
            if (getter.match(/^\d/)) {
                self.emit('getQuoteById', channel, nick, getter);
            } else {
                self.emit('getQuoteByNick', channel, nick, getter);
            }
        },


        getIdNumber = function getIdNumber(channel, callback) {
            memIterators[channel] += 1;
            var newIt = memIterators[channel].toString();
            iterators.put(channel, newIt, function (err) {
                if (!err) {
                    callback(null, newIt);
                } else {
                    callback(err, null);
                }
                        
            });
        },

        addQuote = function addQuote(channel, nick, message) {
            userFiles[channel].get(nick, function (err, user) {
                if (!err && (user || has(ircAdmins, nick))) {
                    var quoteduser = message[1].replace(':','').replace('<','').replace('>','').replace(' ',''),
                        searchname = quoteduser.toLowerCase(),
                        quoteMsg = message.slice(2).join(' ');
                    getIdNumber(channel, function (err, idNumber) {
                        if (!err && idNumber) {
                            quotesFiles[channel].put(idNumber, { idNumber: idNumber, nick: quoteduser, owner: nick, searchname: searchname, quote: quoteMsg }, function (err) {
                                if (!err) {
                                    self.emit('confirmAction', channel, nick, idNumber, 'added', 'quote');
                                } else {
                                    self.emit('quoteError', channel, nick, err);
                                }
                            });
                        } else {
                            self.emit('quoteError', channel, nick, err);
                        }
                    });
                } else {
                    self.emit('quoteError', channel, nick, authError);
                }
            });
        },

        rmQuote = function rmQuote(channel, nick, message) {
            var idNumber = message[1];
            if (idNumber.match(/^\d/)) {
                userFiles[channel].get(nick, function (err, user) {
                    if (!err && (user || has(ircAdmins, nick))) {
                        quotesFiles[channel].get(idNumber, function (err, found) {
                            if (!err && found) {
                                if (nick === found.owner || (user && user.admin === 'true') || has(ircAdmins, nick)) {
                                    quotesFiles[channel].del(idNumber, function (err) {
                                        if (!err) {
                                            self.emit('confirmAction', channel, nick, idNumber, 'deleted', 'quote');
                                        } else {
                                            self.emit('quoteError', channel, nick, err);
                                        }
                                    });
                                } else {
                                    self.emit('quoteError', channel, nick, authError);
                                }
                            }  else {
                                self.emit('quoteError', channel, nick, notFoundErr);
                            }
                        });
                    } else {
                        self.emit('quoteError', channel, nick, authError);
                    }
                });
            } else {
                var tmpErr = new ErrMsg('Invalid Id-Number', 'Id-Number could not be parsed',true);
                self.emit('quoteError', channel, nick, tmpErr);
            }
        },

        parseMessage = function parseMessage(channel, nick, msg) {
            if (msg !== helpText) {
                var message = msg.substr(helpTxtLen).trim().split(' '),
                    msgLen = message.length,
                    command = message[0].substr(0,4).trim();

                if (command === 'help') {
                    self.emit('help', channel, message);
                } else if (msgLen === 1) {
                    self.emit('getQuote', channel, nick, message);
                } else if (command === 'add' && msgLen > 2) {
                    self.emit('addQuote', channel, nick, message);
                } else if ((command === 'rm' || command === 'remove') && msgLen > 1) {
                    self.emit('rmQuote', channel, nick, message);
                } else if (command === 'user' && msgLen > 1) {
                    self.emit('adminAction', channel, nick, message);
                } else {
                    self.emit('quoteError', channel, nick, invalidAction);
                }

            } else {
                self.emit('getRandomQuote', channel, nick);
            }
        };

        // the message event should always fire first and determine what comes next
        self.on('message', parseMessage)
            .on('help', helpMe)
            .on('getQuote', getQuote)
            .on('getRandomQuote', getRandomQuote)
            .on('getQuoteByNick', searchQuotesByNick)
            .on('getQuoteById', searchQuotesById)
            .on('foundQuote', sendQuoteToIrc)
            .on('addQuote', addQuote)
            .on('rmQuote', rmQuote)
            .on('adminAction', adminAction)
            .on('listUsers', listUsers)
            .on('addUser', addUser)
            .on('rmUser', rmUser)
            .on('confirmAction', confirmAction)
            .on('quoteError', throwErr);

        // attach a listener for the messages
        irc.on('message', function (nick, channel, message) {
            if (message.indexOf(helpText) === 0) {
                quote(nick, channel, message);
            }
        });
    }
};

util.inherits(Quote, events.EventEmitter);

module.exports = function (irc) {
    return new Quote(irc);
};
