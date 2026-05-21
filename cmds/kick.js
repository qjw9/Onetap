const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'kick',
  aliases: ['vc-kick', 'disconnect'],
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    if (!args[0]) return err('Please provide a user mention or ID to kick.');

    const userId = message.author.id;
    const guild  = message.guild;
    const target = message.mentions.members.first() || guild.members.cache.get(args[0]);

    if (!target) return err('Target user not found in this server.');
    if (target.id === '335869842748080140') return err("You can't kick the developer.");

    const vc = guild.members.cache.get(userId)?.voice.channel;
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
      if (!isOwner && !isManager) return err('You must be the owner or a manager to kick users.');
      if (target.id === userId) return err('You cannot kick yourself.');
      if (!isOwner && target.id === tempRow.owner_id) return err('Managers cannot kick the channel owner.');
      if (!isOwner && managers.includes(target.id)) return err('Managers cannot kick other managers.');

      if (target.voice.channelId !== vc.id) return err('That user is not in your voice channel.');

      await target.voice.disconnect('Kicked from the temporary voice channel.');
      return styledSend(message, { title: 'Success', emoji: e.trash.trim(), msg: `${target.user.tag} has been kicked from the channel` });
    } catch (error) {
      console.error('kick error:', error);
      return err('Failed to kick the user.');
    }
  },
};
