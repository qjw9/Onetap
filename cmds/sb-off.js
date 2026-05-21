const { PermissionsBitField } = require('discord.js');
const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'sb-off',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    const userId = message.author.id;
    const guild  = message.guild;
    const vc     = guild.members.cache.get(userId)?.voice?.channel;
    if (!vc) return err('You must be in a voice channel.');

    db.get('SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?',
      [vc.id, guild.id], async (dbErr, row) => {
        if (dbErr || !row) return err('This channel is not managed by the bot.');
        const isManager = await new Promise(res =>
          db.get('SELECT 1 FROM user_managers WHERE owner_id = ? AND manager_id = ?',
            [row.owner_id, userId], (e, r) => res(!!r)));
        if (row.owner_id !== userId && !isManager) return err('You must be the owner or a manager.');
        try {
          await vc.permissionOverwrites.edit(guild.roles.everyone, { [PermissionsBitField.Flags.UseSoundboard]: false });
          return styledSend(message, { title: 'Success', emoji: e.sbOff.trim(), msg: 'Soundboard has been disabled for everyone' });
        } catch { return err('Failed to update permissions.'); }
      });
  },
};
