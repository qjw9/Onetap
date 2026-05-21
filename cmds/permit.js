const { PermissionsBitField } = require('discord.js');
const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'permit',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    if (!args[0]) return err('Please provide a user or role mention.\\nUsage: `.v permit @user`');

    const guild    = message.guild;
    const inputId  = args[0].replace(/[<@!&#>]/g, '');
    const target   = guild.members.cache.get(inputId) || guild.roles.cache.get(inputId);

    if (!target) return err('User or Role not found in this server.');

    const vc = message.member.voice.channel;
    if (!vc) return err('You need to be in your voice channel to use this command.');

    const row = await new Promise((res, rej) =>
      db.get('SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?',
        [vc.id, guild.id], (e, r) => e ? rej(e) : res(r)));
    if (!row) return err('This voice channel is not managed by the bot.');

    const isManager = await new Promise(res =>
      db.get('SELECT 1 FROM user_managers WHERE owner_id = ? AND manager_id = ?',
        [row.owner_id, message.author.id], (e, r) => res(!!r)));

    if (row.owner_id !== message.author.id && !isManager)
      return err('You must be the voice owner or a manager.');

    try {
      await vc.permissionOverwrites.edit(target, { Connect: true, Speak: true });
      const name = target.displayName || target.name || target.toString();
      return styledSend(message, { title: 'Success', emoji: e.permitUser.trim(), msg: `${name} has been permitted to join` });
    } catch {
      return err('Failed to update permissions. Check my role permissions.');
    }
  },
};
