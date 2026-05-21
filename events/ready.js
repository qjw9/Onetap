const e = require('../emojis');

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
      console.log(`${e.success} Logged in as ${client.user.tag}`);
    }
  };
  