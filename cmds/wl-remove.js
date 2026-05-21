const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'wl-remove',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    const user = message.mentions.users.first();
    if (!user) return err('Please mention a user to remove from your whitelist.');

    const ownerId = message.author.id;
    const guildId = message.guild.id;

    db.get('SELECT * FROM whitelist_users WHERE owner_id = ? AND whitelisted_id = ? AND guild_id = ?',
      [ownerId, user.id, guildId], (dbErr, row) => {
        if (!row) return err(`<@${user.id}> is not in your whitelist.`);
        db.run('DELETE FROM whitelist_users WHERE owner_id = ? AND whitelisted_id = ? AND guild_id = ?',
          [ownerId, user.id, guildId], (err2) => {
            if (err2) return err('Failed to remove from whitelist.');
            styledSend(message, { title: 'Success', emoji: e.denyUser.trim(), msg: `<@${user.id}> has been removed from your whitelist` });
          });
      });
  },
};
