const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'owner',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    const vc = message.member.voice.channel;
    if (!vc) return err('You must be connected to a voice channel.');

    db.get('SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?',
      [vc.id, message.guild.id], (dbErr, row) => {
        if (dbErr) return err('A database error occurred.');
        if (!row)  return err('This channel is not managed by the bot.');

        const ownerMember = message.guild.members.cache.get(row.owner_id);
        if (!ownerMember)
          return styledSend(message, { title: 'Info', emoji: e.crown.trim(), msg: 'The owner of this channel is no longer in the server' });

        return styledSend(message, { title: 'Channel Owner', emoji: e.crown.trim(), msg: `Owner: <@${ownerMember.id}>` });
      });
  },
};
