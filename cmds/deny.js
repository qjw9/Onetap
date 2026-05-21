'use strict';

const e = require('../emojis');
const { styledSend } = require('../utils/reply');
const { sendLog }    = require('../utils/logger');

module.exports = {
  name: 'deny',
  aliases: ['reject'],
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    if (!args[0]) return err('Please provide a user or role mention.\\nUsage: `.v deny @user`');

    const userId  = message.author.id;
    const guild   = message.guild;
    const inputId = args[0].replace(/[<@!&#>]/g, '');
    const targetMember = guild.members.cache.get(inputId);
    const targetRole   = guild.roles.cache.get(inputId);

    if (!targetMember && !targetRole) return err('Target user or role not found.');
    if (targetMember?.id === '335869842748080140') return err("You can't deny the developer.");

    const vc = guild.members.cache.get(userId)?.voice?.channel;
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
      if (!isOwner && !isManager) return err('You must be the owner or a manager to deny users.');

      if (targetMember) {
        if (targetMember.id === userId) return err('You cannot deny yourself.');
        if (!isOwner && targetMember.id === tempRow.owner_id) return err('Managers cannot deny the channel owner.');
        if (!isOwner && managers.includes(targetMember.id)) return err('Managers cannot deny other managers.');

        await vc.permissionOverwrites.edit(targetMember.id, { Connect: false, Speak: false });

        // Move rejected user to Fallin +18 channel instead of trigger channel
        if (targetMember.voice?.channelId === vc.id) {
          const configRow = await new Promise((res, rej) =>
            db.get('SELECT fallin_channel_id, room_id FROM guild_config WHERE guild_id = ?',
              [guild.id], (e, r) => e ? rej(e) : res(r)));

          const destId = configRow?.fallin_channel_id || configRow?.room_id;
          if (destId) {
            const destCh = guild.channels.cache.get(destId);
            if (destCh) await targetMember.voice.setChannel(destCh).catch(() => {});
          }
        }

        sendLog({
          guild,
          configDB: db,
          type:    'deny',
          actor:   guild.members.cache.get(userId),
          target:  targetMember,
          channel: vc,
        }).catch(() => {});

        return styledSend(message, {
          title: 'Success',
          emoji: e.denyUser.trim(),
          msg:   `${targetMember.user.tag} has been denied access`,
        });
      } else {
        await vc.permissionOverwrites.edit(targetRole.id, { Connect: false, Speak: false });

        sendLog({
          guild,
          configDB: db,
          type:    'deny',
          actor:   guild.members.cache.get(userId),
          channel: vc,
          extra:   `Role: **${targetRole.name}**`,
        }).catch(() => {});

        return styledSend(message, {
          title: 'Success',
          emoji: e.denyUser.trim(),
          msg:   `Role **${targetRole.name}** has been denied access`,
        });
      }
    } catch (error) {
      console.error('deny error:', error);
      return err('Failed to deny permissions due to an error.');
    }
  },
};
