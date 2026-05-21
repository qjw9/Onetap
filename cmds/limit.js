const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'limit',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.limit.trim(), msg });

    const limit = parseInt(args[0], 10);
    if (isNaN(limit) || limit < 0 || limit > 99)
      return err('Please provide a valid user limit between **0** and **99**.');

    const userId = message.author.id;
    const guild  = message.guild;
    const vc     = guild.members.cache.get(userId)?.voice.channel;

    if (!vc) return err('You must be connected to a voice channel.');

    try {
      const tempRow = await new Promise((res, rej) =>
        db.get('SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?',
          [vc.id, guild.id], (e, r) => e ? rej(e) : res(r)));
      if (!tempRow) return err('This channel is not managed by the bot.');

      const managers = await new Promise((res, rej) =>
        db.all('SELECT manager_id FROM user_managers WHERE owner_id = ?',
          [tempRow.owner_id], (e, rows) => e ? rej(e) : res(rows.map(r => r.manager_id))));

      const isOwner   = tempRow.owner_id === userId;
      const isManager = managers.includes(userId);
      if (!isOwner && !isManager) return err('You must be the owner or a manager.');

      await vc.setUserLimit(limit);
      const msg = limit === 0 ? 'User limit has been removed' : `User limit set to **${limit}**`;
      return styledSend(message, { title: 'Success', emoji: e.limit.trim(), msg });
    } catch {
      return err('Failed to set the user limit. Check my permissions.');
    }
  },
};
