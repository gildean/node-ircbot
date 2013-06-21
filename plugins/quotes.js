// plugin for saving and querying quotes
// requires mongodb to function
 
var util = require('util'),
    events = require('events'),
    mongojs = require('mongojs'),
    config = require('../config');

var Quote = function (irc) {
    'use strict';
    if (!config.mongodb) {
        return console.log('no mongodb found, quotes-plugin not loaded');
    }
    var trigger = 'quote',
        helpText = config.trigger + trigger,
        helpTxtLen = helpText.length + 1,
        self = this,
        db = mongojs.connect(config.mongodb.address),
        quotecoll = db.collection('quotes'),
        quoteUserDb = db.collection('quoteUsers'),
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

    // ensure the indexes on the db for better performance
    quotecoll.ensureIndex({ idNumber: 1, nick: 1 }, function (err) {
        if (err) {
            throw new Error('Quotes plugin requires mongodb to function, disable the plugin or get your mongo on.');
        };
    });
    quoteUserDb.ensureIndex({ name: 1 });
    
    function has(ar, el) {
        return ar.indexOf(el) > -1;
    }

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
        quoteUserDb.findOne({name: nick, channel: channel}, function (err, foundUser) {
            if (!err && (foundUser && foundUser.admin || has(ircAdmins, nick))) {
                callback(null, true);
            } else if (err) {
                callback(err, false);
            } else {
                callback(authError, false);
            }
        });
    },

    addUser = function addUser(channel, nick, user, admin) {
        quoteUserDb.update({name: user, channel: channel}, {$set: { name: user, channel: channel, admin: admin }}, { upsert: true }, function (saveerr) {
            if (!saveerr) {
                self.emit('confirmAction', channel, nick, user, 'added', 'user');
            } else {
                self.emit('quoteError', channel, nick, saveerr);
            }
        });
    },

    rmUser = function rmUser(channel, nick, user) {
        quoteUserDb.findOne({name: user, channel: channel}, function (notfound, rmuser) {
            if (!notfound && rmuser) {
                quoteUserDb.remove({_id: rmuser._id}, function (rmerr) {
                    if (!rmerr) {
                        quotecoll.remove({owner: user, channel: channel}, function (qrmerr) {
                            if (!qrmerr) {
                                self.emit('confirmAction', channel, nick, user, 'deleted', 'user');
                            } else {
                                self.emit('quoteError', channel, nick, qrmerr);
                            }
                        });
                    } else {
                        self.emit('quoteError', channel, nick, rmerr);
                    }
                });
            } else {
                var tmpErr = notfound || notFoundErr;
                self.emit('quoteError', channel, nick, tmpErr);
            }
        });
    },

    listUsers = function listUsers(channel, nick) {
        quoteUserDb.find({channel: channel}, function (err, users) {
            var userlist = 'Users added on this channel: ';
            if (!err && users) {
                users.forEach(function (user) {
                    if (user.hasOwnProperty('name')) {
                        userlist += user.name;
                        userlist += (user.admin === 'true') ? '(admin), ' : '(user), ';
                    }
                });
                self.emit('foundQuote', channel, nick, userlist);
            } else {
                self.emit('quoteError', channel, nick, err);
            }
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
                    admin = message[3] || false;
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
        quotecoll.findOne({ idNumber: parseInt(id) }, function (err, found) {
            if (!err && found) {
                self.emit('foundQuote', channel, nick, found);
            } else {
                var tmpErr = err || notFoundErr;
                self.emit('quoteError', channel, nick, tmpErr);
            }
        });
    },

    searchQuotesByNick = function searchQuotesByNick(channel, nick, query) {
        quotecoll.find({ searchname: query.toLowerCase(), channel: channel }, function (err, quotes) {
            if (!err && quotes.length > 0) {
                var found = quotes[Math.floor(Math.random() * quotes.length)];
                self.emit('foundQuote', channel, nick, found);
            } else {
                var tmpErr = err || notFoundErr;
                self.emit('quoteError', channel, nick, tmpErr);
            }
        });
    },

    getRandomQuote = function getRandomQuote(channel, nick) {
        quotecoll.find({channel: channel}, function (err, quotes) {
            if (!err && quotes.length > 0) {
                var found = quotes[Math.floor(Math.random() * quotes.length)];
                self.emit('foundQuote', channel, nick, found);
            } else {
                var tmpErr = err || notFoundErr;
                self.emit('quoteError', channel, nick, tmpErr);
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
        quoteUserDb.findAndModify({ query: { special: '_idNumber' }, update: { $inc: { number: 1 } }, upsert: true, new: true }, function (err, id) {
            if (!err && id) {
                callback(null, id.number);
            } else {
                callback(err, null);
            }
            
        });
    },

    addQuote = function addQuote(channel, nick, message) {
        quoteUserDb.findOne({name: nick, channel: channel}, function (err, user) {
            if (!err && (user || has(ircAdmins, nick))) {
                var quoteduser = message[1].replace(':','').replace('<','').replace('>','').replace(' ',''),
                    searchname = quoteduser.toLowerCase(),
                    quoteMsg = message.slice(2).join(' ');
                getIdNumber(channel, function (err, idNumber) {
                    if (!err && idNumber) {
                        quotecoll.save({ nick: quoteduser, owner: nick, searchname: searchname, channel: channel, idNumber: idNumber, quote: quoteMsg }, function (err) {
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
                var tmpErr = err || authError;
                self.emit('quoteError', channel, nick, tmpErr);
            }
        });
    },

    rmQuote = function rmQuote(channel, nick, message) {
        var idNumber = parseInt(message[1]);
        if (!isNaN(idNumber)) {
            quoteUserDb.findOne({name: nick, channel: channel}, function (err, user) {
                if (!err && (user || has(ircAdmins, nick))) {
                    quotecoll.findOne({idNumber: idNumber}, function (err, found) {
                        if (!err && found && (nick === found.owner || (user && user.admin) || has(ircAdmins, nick))) {
                            quotecoll.remove({idNumber: idNumber}, function (err) {
                                if (!err) {
                                    self.emit('confirmAction', channel, nick, idNumber, 'deleted', 'quote');
                                } else {
                                    self.emit('quoteError', channel, nick, err);
                                }
                            });
                        } else if (err) {
                            self.emit('quoteError', channel, nick, err);
                        } else if (!found) {
                            self.emit('quoteError', channel, nick, notFoundErr);
                        } else {
                            self.emit('quoteError', channel, nick, authError);
                        }
                    });
                } else {
                    var tmpErr = err || authError;
                    self.emit('quoteError', channel, nick, tmpErr);
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
    this.on('message', parseMessage)
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
};

util.inherits(Quote, events.EventEmitter);

module.exports = function (irc) {
    return new Quote(irc);
};
