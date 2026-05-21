const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'name',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.rename.trim(), msg });

    if (!args.length) return err('Please provide the new voice channel name.\\nUsage: `.v name <new name>`');

    const newName = args.join(' ').trim();
    const userId  = message.author.id;
    const guild   = message.guild;
    const vc      = guild.members.cache.get(userId)?.voice?.channel;

    if (!vc) return err('You must be connected to a voice channel.');

    db.get('SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?',
      [vc.id, guild.id], (dbErr, row) => {
        if (dbErr || !row) return err('This channel is not managed by the bot.');

        const doRename = () =>
          vc.edit({ name: newName })
            .then(() => styledSend(message, { title: 'Success', emoji: e.rename.trim(), msg: `Channel has been renamed to **${newName}**` }))
            .catch(() => err('Failed to rename. Check my permissions.'));

        if (row.owner_id === userId) return doRename();

        db.get('SELECT 1 FROM user_managers WHERE owner_id = ? AND manager_id = ?',
          [row.owner_id, userId], (e2, manRow) => {
            if (manRow) return doRename();
            return err('You must be the owner or a manager to rename this channel.');
          });
      });
  },
};
