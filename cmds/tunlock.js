'use strict';

const { PermissionsBitField } = require('discord.js');
const e = require('../emojis');
const { styledSend } = require('../utils/reply');
const { sendLog }    = require('../utils/logger');

module.exports = {
  name: 'tunlock',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    const guild  = message.guild;
    const member = message.member;
    const ch     = message.channel;

    const hasAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!hasAdmin) {
      const row = await new Promise(res =>
        db.get('SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?',
          [ch.id, guild.id], (_, r) => res(r)));
      if (!row) return err('You do not have permission to unlock this channel.');
      const isOwner = row.owner_id === member.id;
      const isMan   = await new Promise(res =>
        db.get('SELECT 1 FROM user_managers WHERE owner_id = ? AND manager_id = ?',
          [row.owner_id, member.id], (_, r) => res(!!r)));
      if (!isOwner && !isMan) return err('You must be the owner or a manager.');
    }

    try {
      await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
      sendLog({ guild, configDB: db, type: 'tunlock', actor: member, channel: ch }).catch(() => {});
      return styledSend(message, {
        title: 'Success',
        emoji: e.tunlock.trim(),
        msg:   'Text channel has been unlocked',
      });
    } catch {
      return err('Failed to unlock the text channel. Check my permissions.');
    }
  },
};
