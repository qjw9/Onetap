const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'rejectall',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.denyUser.trim(), msg });

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
      return err('Please mention at least one user.\\nUsage: `.v rejectall @user1 @user2`');

    const tempRow = await new Promise((res, rej) =>
      db.get('SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?',
        [vc.id, guild.id], (e, r) => e ? rej(e) : res(r)));
    if (!tempRow) return err('This channel is not managed by the bot.');

    const managers = await new Promise((res, rej) =>
      db.all('SELECT manager_id FROM user_managers WHERE owner_id = ?',
        [tempRow.owner_id], (e, rows) => e ? rej(e) : res(rows.map(r => r.manager_id))));

    const isOwner = tempRow.owner_id === userId;
    const isManager = managers.includes(userId);
    if (!isOwner && !isManager) return err('You must be the owner or a manager.');

    const denied = [], skipped = [];
    for (const target of targets) {
      if (target.id === userId)               { skipped.push(`<@${target.id}>`); continue; }
      if (!isOwner && target.id === tempRow.owner_id) { skipped.push(`<@${target.id}> (owner)`); continue; }
      if (!isOwner && managers.includes(target.id))   { skipped.push(`<@${target.id}> (manager)`); continue; }
      try {
        await vc.permissionOverwrites.edit(target.id, { Connect: false, Speak: false });
        if (target.voice?.channelId === vc.id) {
          const configRow = await new Promise((res, rej) =>
            db.get('SELECT room_id FROM guild_config WHERE guild_id = ?',
              [guild.id], (e, r) => e ? rej(e) : res(r)));
          if (configRow?.room_id) {
            const room = guild.channels.cache.get(configRow.room_id);
            if (room) await target.voice.setChannel(room).catch(() => {});
          } else {
            await target.voice.disconnect().catch(() => {});
          }
        }
        denied.push(`<@${target.id}>`);
      } catch { skipped.push(`<@${target.id}>`); }
    }

    const msg = [
      denied.length  ? `Denied: ${denied.join(', ')}` : null,
      skipped.length ? `Skipped: ${skipped.join(', ')}` : null,
    ].filter(Boolean).join(' — ');

    return styledSend(message, { title: 'Success', emoji: e.denyUser.trim(), msg });
  },
};
