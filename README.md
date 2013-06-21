node-ircbot
===========

Extensible ircbot made with node.js

Usage
-----
Install dependencies with `npm install`, set your configs in `config.json` and then `npm start`. You can use the default config as the base for your own configs.

Plugins
-------
You can create your own plugins and save them under the `/plugins/` directory and add them to the `config.json`. Use the about-plugin as an example.

All plugins should be as self-contained as possible, but for example the quotes-plugin uses mongodb as the default database, so if you use those, you also have to include the following line(s) to the config: `"mongodb": { "address": "mongodb://someaddress/somedb" }`.

You can of course modify the database-driven plugins to use whatever database you want, the bot iself is not dependant on any database.

The plugins can use all the features of [node-irc](https://github.com/martynsmith/node-irc), to which you can read the docs [here](https://node-irc.readthedocs.org/en/latest/API.html).

License
-------
MIT [http://ok.mit-license.org](http://ok.mit-license.org)
