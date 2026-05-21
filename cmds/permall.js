const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'permall',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.permitUser.trim(), msg });

    const userId  = message.author.id;
    const guild   = message.guild;
    const vc      = guild.members.cache.get(userId)?.voice?.channel;
    if (!vc) return err('You must be connected to a voice channel.');

    const mentionedUsers = [...message.mentions.users.values()];
    const rawIds = args.filter(a => /^\d{17,19}$/.test(a) && !message.mentions.users.has(a));
    const targets = [
      ...mentionedUsers.map(u => guild.members.cache.get(u.id)).filter(Boolean),
      ...rawIds.map(id => guild.members.cache.get(id)).filter(Boolean),
    ];

    if (!targets.length)
      return err('Please mention at least one user.\\nUsage: `.v permall @user1 @user2`');

    const tempRow = await new Promise((res, rej) =>
      db.get('SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?',
        [vc.id, guild.id], (e, r) => e ? rej(e) : res(r)));
    if (!tempRow) return err('This channel is not managed by the bot.');

    const managers = await new Promise((res, rej) =>
      db.all('SELECT manager_id FROM user_managers WHERE owner_id = ?',
        [tempRow.owner_id], (e, rows) => e ? rej(e) : res(rows.map(r => r.manager_id))));

    if (tempRow.owner_id !== userId && !managers.includes(userId))
      return err('You must be the owner or a manager.');

    const permitted = [], skipped = [];
    for (const target of targets) {
      if (target.id === userId) { skipped.push(`<@${target.id}>`); continue; }
      try {
        await vc.permissionOverwrites.edit(target.id, { Connect: true, Speak: true, ViewChannel: true });
        permitted.push(`<@${target.id}>`);
      } catch { skipped.push(`<@${target.id}>`); }
    }

    const msg = [
      permitted.length ? `Permitted: ${permitted.join(', ')}` : null,
      skipped.length   ? `Skipped: ${skipped.join(', ')}` : null,
    ].filter(Boolean).join(' — ');

    return styledSend(message, { title: 'Success', emoji: e.permitUser.trim(), msg });
  },
};
