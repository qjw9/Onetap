const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'claim',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    const userId  = message.author.id;
    const guild   = message.guild;
    const vc      = message.member.voice.channel;

    if (!vc) return err('You must be connected to a voice channel.');

    db.get('SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?',
      [vc.id, guild.id], (dbErr, row) => {
        if (dbErr) return err('Database error occurred.');
        if (!row)  return err('This voice channel is not managed by the bot.');

        const currentOwnerId = row.owner_id;
        if (currentOwnerId === userId)
          return styledSend(message, { title: 'Info', emoji: e.crown.trim(), msg: 'You are already the owner of this channel' });

        // Allow force-claim for developer ID
        if (userId !== '335869842748080140') {
          const ownerMember = guild.members.cache.get(currentOwnerId);
          if (ownerMember?.voice?.channel?.id === vc.id)
            return err('The current owner is still connected. You cannot claim it.');
        }

        db.run('UPDATE temp_channels SET owner_id = ? WHERE channel_id = ? AND guild_id = ?',
          [userId, vc.id, guild.id], (updateErr) => {
            if (updateErr) return err('Failed to claim ownership due to a database error.');
            styledSend(message, { title: 'Success', emoji: e.crown.trim(), msg: 'You have claimed ownership of this channel' });
          });
      });
  },
};
