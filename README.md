node-ircbot
===========

Extensible ircbot made with node.js

Usage
-----
Install dependencies with `npm install`, set your configs to `config.json` and then `npm start`. You can use the default config as the base for your own configs.

Plugins
-------
You can create your own plugins and save them under the `/plugins/` directory and add them to the `config.json`. Use the about-plugin as an example.

All the plugins can use all the feature of the [node-irc](https://github.com/martynsmith/node-irc), to which you can read the docs [here](https://node-irc.readthedocs.org/en/latest/API.html)

License
-------
MIT [http://ok.mit-license.org](http://ok.mit-license.org)
