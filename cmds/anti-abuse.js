'use strict';

const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'anti-abuse',
  description: 'Toggle anti-abuse protection for your voice channel. (.v anti-abuse on/off/status)',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    const sub    = (args[0] || '').toLowerCase();
    const userId = message.author.id;
    const guild  = message.guild;

    if (!['on', 'off', 'status'].includes(sub))
      return err('Invalid option.\\nUsage: `.v anti-abuse on/off/status`');

    if (sub === 'status') {
      const row = await new Promise(res =>
        db.get('SELECT enabled FROM anti_abuse WHERE owner_id = ? AND guild_id = ?',
          [userId, guild.id], (_, r) => res(r)));
      const isOn = row?.enabled === 1;
      return styledSend(message, {
        title: 'Anti-Abuse Status',
        emoji: e.antiAbuseStatus.trim(),
        msg:   `Anti-abuse is currently **${isOn ? 'ON' : 'OFF'}** for your channel.`,
      });
    }

    const enabled = sub === 'on' ? 1 : 0;

    await new Promise((res, rej) =>
      db.run(
        `INSERT INTO anti_abuse (owner_id, guild_id, enabled) VALUES (?, ?, ?)
         ON CONFLICT(owner_id, guild_id) DO UPDATE SET enabled = excluded.enabled`,
        [userId, guild.id, enabled],
        (err) => err ? rej(err) : res()
      )
    );

    return styledSend(message, {
      title: `Anti-Abuse ${sub === 'on' ? 'Enabled' : 'Disabled'}`,
      emoji: sub === 'on' ? e.antiAbuse.trim() : e.antiAbuseOff.trim(),
      msg:   sub === 'on'
        ? 'Anti-abuse is now ON. Anyone who tries to join your channel when your limit is 1 and you are alone will be disconnected and you will receive a DM to decide.'
        : 'Anti-abuse is now OFF.',
    });
  },
};
