'use strict';

const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'rpermit',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    if (!args[0]) return err('Please provide a role ID.\\nUsage: `.v rpermit <roleID>`');

    const roleId = args[0].replace(/[<@&#>]/g, '').trim();
    const guild  = message.guild;
    const userId = message.author.id;
    const member = guild.members.cache.get(userId);

    const role = guild.roles.cache.get(roleId);
    if (!role) return err(`Role with ID \`${roleId}\` not found in this server.`);

    const vc = member?.voice?.channel;
    if (!vc) return err('You must be in your voice channel to use this command.');

    const row = await new Promise(res =>
      db.get('SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?',
        [vc.id, guild.id], (_, r) => res(r)));
    if (!row) return err('This voice channel is not managed by the bot.');

    const isOwner = row.owner_id === userId;
    const isMan   = await new Promise(res =>
      db.get('SELECT 1 FROM user_managers WHERE owner_id = ? AND manager_id = ?',
        [row.owner_id, userId], (_, r) => res(!!r)));
    if (!isOwner && !isMan) return err('You must be the voice owner or a manager.');

    try {
      await vc.permissionOverwrites.edit(role.id, { Connect: true, Speak: true });

      db.run(
        'DELETE FROM rejected_roles WHERE owner_id = ? AND role_id = ? AND guild_id = ?',
        [row.owner_id, roleId, guild.id]
      );

      return styledSend(message, {
        title: 'Success',
        emoji: e.rpermit.trim(),
        msg:   `Role **${role.name}** has been permitted to join your channel`,
      });
    } catch {
      return err('Failed to update permissions. Check my role hierarchy.');
    }
  },
};
