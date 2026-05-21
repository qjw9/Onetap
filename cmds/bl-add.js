const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'bl-add',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    const userToAdd = message.mentions.users.first();
    if (!userToAdd) return err('Please mention a user to blacklist.');
    if (userToAdd.id === message.author.id) return err('You cannot blacklist yourself.');

    const ownerId      = message.author.id;
    const guildId      = message.guild.id;
    const blacklistedId = userToAdd.id;

    db.get('SELECT * FROM whitelist_users WHERE owner_id = ? AND whitelisted_id = ? AND guild_id = ?',
      [ownerId, blacklistedId, guildId], (err1, wlRow) => {
        if (wlRow) return err('This user is whitelisted. Remove them first.');
        db.get('SELECT * FROM blacklist_users WHERE owner_id = ? AND blacklisted_id = ? AND guild_id = ?',
          [ownerId, blacklistedId, guildId], (err2, blRow) => {
            if (blRow) return err('This user is already blacklisted.');
            db.run('INSERT INTO blacklist_users (owner_id, blacklisted_id, guild_id) VALUES (?, ?, ?)',
              [ownerId, blacklistedId, guildId], (err3) => {
                if (err3) return err('Database error while adding to blacklist.');
                styledSend(message, { title: 'Success', emoji: e.denyUser.trim(), msg: `**${userToAdd.tag}** has been blacklisted` });
              });
          });
      });
  },
};
