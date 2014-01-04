node-ircbot
===========

Extensible ircbot made with node.js

Usage
-----
Install dependencies with `npm install`, set your configs in `config.json` and then `npm start`. You can use the default config as the base for your own configs.

Configuration
-------------
This is the default config:
```
{
    "trigger": "!",
    "nick": "botname",
    "server": "irc.freenode.net",
    "options": {
        "userName": "somename",
        "realName": "Real name maybe",
        "port": 6667,
        "debug": false,
        "showErrors": false,
        "autoRejoin": true,
        "autoConnect": true,
        "secure": false,
        "selfSigned": false,
        "certExpired": false,
        "floodProtection": false,
        "floodProtectionDelay": 1000,
        "stripColors": false,
        "channelPrefixes": "&#",
        "messageSplit": 512,
        "channels": [
            "#node.js"
        ]
    },
    "admins": [
        "user@host.tld"
    ],
    "plugins": [
        "about",
        "actions",
        "ddg",
        "links",
        "logger",
        "roll"
    ],
    "protect": false,
    "logs": {
        "dir": "./logs",
        "http": 9084
    }
}
```
 * `trigger`: *the character(s) that are used as action-trigger in plugins* 
 * `nick`: *the nick of the bot* 
 * `server`: *the irc-server address*
 * `options`: *options for node-irc client, for more info check link below*
 * `admins`: *list of bot admins, in form of `username@host.tld`*
 * `plugins`: *list of plugins to load on startup*
 * `protect`: *protect-mode for actions-plugin, stops unauthorized ops etc.*
 * `logs`: *options for logger-plugin, set the http-property for http-access*

Plugins
-------
You can create your own plugins and save them under the `/plugins/` directory and add them to the `config.json`. Use the about-plugin as an example.

All plugins should be as self-contained as possible, but for example the logger uses [LevelDB](https://github.com/rvagg/node-levelup) (with [level-sublevel](https://github.com/dominictarr/level-sublevel)) as the database, so it's installed as a dependency. Each plugin should use their own set of sublevels so the keys on the db don't clash. [LevelDB](https://github.com/rvagg/node-levelup) doesn't require an external server, which makes it perfect for a self-contained application like this.

You can of course modify the database-driven plugins to use whatever database you want, the bot iself is not dependant on any database, as it's basically just a wrapper on [node-irc](https://github.com/martynsmith/node-irc).

The plugins can use all the features of [node-irc](https://github.com/martynsmith/node-irc), to which you can read the docs [here](https://node-irc.readthedocs.org/en/latest/API.html).

License
-------
MIT [http://ok.mit-license.org](http://ok.mit-license.org)
