rpgdice
=======
by: ok 2012


Simple eventful dice for rpg or any dicegame.

Designed to support multiple games and players using the same dice, for example in multiple socket.io rooms.

Usage
-----
Install the module:
`npm install rpgdice`

Require the module:
`var dice = require('rpgdice');`

Roll the dice:
`dice.roll('1d6+4', 'player1', 'game1')`
  * the dice must be in the form of *side* __d__ *rolls*
  * the modifier (+4 etc.), the playername and the gamename can be omitted*

events
------
dice.on(' *event* ', function ( *args* ) {});

__'rolling', dice, roller, game__

*when a player rolls*
  * *dice* _string_
  * *roller* _string_
  * *game* _string_

__'roll', roll, roller, game__

*when a single dice rolls*
  * *roll* _string_
  * *roller* _string_
  * *game* _string_

__'result', dice, rolls, result, roller, game__

*when all the dice have been rolled*
  * *dice* _string_
  * *rolls* _array_
  * *result* _number_
  * *roller* _string_
  * *game* _string_

__'misroll', error, roller, game__

*if the dice was malformed or other errors occur*
  * *error* _error_
  * *roller* _string_
  * *game* _string_

License
-------
MIT: [http://ok.mit-license.org/](http://ok.mit-license.org/)
