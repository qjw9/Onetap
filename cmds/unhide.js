const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'unhide',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    const userId  = message.author.id;
    const guild   = message.guild;

    const config = await new Promise((res, rej) =>
      db.get('SELECT hide_role FROM guild_config WHERE guild_id = ?',
        [guild.id], (e, r) => e ? rej(e) : res(r))).catch(() => null);

    if (!config?.hide_role) return err('No hide role configured.');

    const member = guild.members.cache.get(userId);
    if (!member.roles.cache.has(config.hide_role))
      return err(`You need the <@&${config.hide_role}> role to use this command.`);

    const vc = member.voice?.channel;
    if (!vc) return err('You must be in your voice channel.');

    const tempRow = await new Promise((res, rej) =>
      db.get('SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?',
        [vc.id, guild.id], (e, r) => e ? rej(e) : res(r))).catch(() => null);

    if (!tempRow || tempRow.owner_id !== userId)
      return err('You must be the owner of the voice channel.');

    try {
      await vc.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: null });
      return styledSend(message, { title: 'Success', emoji: e.success.trim(), msg: 'Your voice room is now visible to everyone' });
    } catch {
      return err('Failed to unhide the channel.');
    }
  },
};
