const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'wl-add',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    const userToAdd = message.mentions.users.first();
    if (!userToAdd) return err('Please mention a user to whitelist.');
    if (userToAdd.id === message.author.id) return err('You cannot whitelist yourself.');

    const ownerId      = message.author.id;
    const guildId      = message.guild.id;
    const whitelistedId = userToAdd.id;

    db.get('SELECT * FROM blacklist_users WHERE owner_id = ? AND blacklisted_id = ? AND guild_id = ?',
      [ownerId, whitelistedId, guildId], (err1, blRow) => {
        if (blRow) return err('This user is blacklisted. Remove them first.');

        db.get('SELECT COUNT(*) AS count FROM whitelist_users WHERE owner_id = ? AND guild_id = ?',
          [ownerId, guildId], (err2, countRow) => {
            if (countRow?.count >= 5) return err('You have already whitelisted 5 users (maximum).');

            db.get('SELECT * FROM whitelist_users WHERE owner_id = ? AND whitelisted_id = ? AND guild_id = ?',
              [ownerId, whitelistedId, guildId], (err3, exists) => {
                if (exists) return err('This user is already whitelisted.');
                db.run('INSERT INTO whitelist_users (owner_id, whitelisted_id, guild_id) VALUES (?, ?, ?)',
                  [ownerId, whitelistedId, guildId], (err4) => {
                    if (err4) return err('Database error while adding to whitelist.');
                    styledSend(message, { title: 'Success', emoji: e.permitUser.trim(), msg: `**${userToAdd.tag}** has been whitelisted` });
                  });
              });
          });
      });
  },
};
