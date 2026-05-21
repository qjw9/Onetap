const axios = require('axios');
const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'status',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    const statusText = args.join(' ').trim();
    if (!statusText) return err('Please provide a status message.\\nUsage: `.v status <your status>`');

    const userId = message.author.id;
    const guild  = message.guild;
    const vc     = guild.members.cache.get(userId)?.voice?.channel;

    if (!vc) return err('You must be connected to a voice channel.');

    db.get('SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?',
      [vc.id, guild.id], async (dbErr, row) => {
        if (dbErr || !row) return err('This channel is not managed by the bot.');

        const isManager = await new Promise(res =>
          db.get('SELECT 1 FROM user_managers WHERE owner_id = ? AND manager_id = ?',
            [row.owner_id, userId], (e, r) => res(!!r)));

        if (row.owner_id !== userId && !isManager)
          return err('You must be the owner or a manager to set the status.');

        try {
          await axios.put(
            `https://discord.com/api/v10/channels/${vc.id}/voice-status`,
            { status: statusText },
            { headers: { Authorization: `Bot ${client.token}`, 'Content-Type': 'application/json' } }
          );
          return styledSend(message, { title: 'Success', emoji: e.success.trim(), msg: `Voice status set to: **${statusText}**` });
        } catch {
          return err('Failed to update voice status.');
        }
      });
  },
};
