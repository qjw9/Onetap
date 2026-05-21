'use strict';

const e = require('../emojis');
const { styledSend } = require('../utils/reply');
const { sendLog }    = require('../utils/logger');

module.exports = {
  name: 'unlock',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    const userId = message.author.id;
    const guild  = message.guild;
    const member = guild.members.cache.get(userId);
    const vc     = member?.voice?.channel;

    if (!vc) return err('You must be connected to a voice channel.');

    const row = await new Promise((res, rej) =>
      db.get('SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?',
        [vc.id, guild.id], (e, r) => e ? rej(e) : res(r)));
    if (!row) return err('This channel is not managed by the bot.');

    const managers = await new Promise((res, rej) =>
      db.all('SELECT manager_id FROM user_managers WHERE owner_id = ?',
        [row.owner_id], (e, rows) => e ? rej(e) : res(rows.map(r => r.manager_id))));

    if (row.owner_id !== userId && !managers.includes(userId))
      return err('You must be the owner or a manager.');

    await vc.permissionOverwrites.edit(guild.roles.everyone, { Connect: null });

    sendLog({ guild, configDB: db, type: 'unlock', actor: member, channel: vc }).catch(() => {});

    return styledSend(message, {
      title: 'Success',
      emoji: e.unlock.trim(),
      msg:   'Channel has been unlocked',
    });
  },
};
