const {
  TextDisplayBuilder,
  ContainerBuilder,
  MessageFlags,
  PermissionsBitField,
} = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'music-add',
  async execute(message, args, client, db) {
    const sendReply = (content) => {
      const text = new TextDisplayBuilder().setContent(content);
      const container = new ContainerBuilder().addTextDisplayComponents(text);
      return message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
    };

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return sendReply(`${e.error} You need **Administrator** permission to use this command.`);

    const botId = args[0];
    const joinCmd = args[1] || '!join';

    if (!botId || !/^\d{17,19}$/.test(botId))
      return sendReply(`${e.error} Please provide a valid bot ID.\n-# Usage: \`.v music add <botID> [joinCommand]\`\n-# Example: \`.v music add 123456789 !join\``);

    const guildId = message.guild.id;

    // Ensure join_cmd column exists
    db.run(`ALTER TABLE music_bots ADD COLUMN join_cmd TEXT DEFAULT '!join'`, () => {});

    db.get(`SELECT bot_id FROM music_bots WHERE bot_id = ? AND guild_id = ?`, [botId, guildId], (err, row) => {
      if (err) return sendReply(`${e.error} Database error.`);

      if (row) {
        db.run(`UPDATE music_bots SET join_cmd = ? WHERE bot_id = ? AND guild_id = ?`, [joinCmd, botId, guildId], (err2) => {
          if (err2) return sendReply(`${e.error} Failed to update.`);
          return sendReply(`${e.success} Updated join command for <@${botId}> to \`${joinCmd}\`.`);
        });
        return;
      }

      db.run(`INSERT INTO music_bots (bot_id, guild_id, join_cmd) VALUES (?, ?, ?)`, [botId, guildId, joinCmd], (err2) => {
        if (err2) {
          // Fallback without join_cmd column
          db.run(`INSERT INTO music_bots (bot_id, guild_id) VALUES (?, ?)`, [botId, guildId], (err3) => {
            if (err3) return sendReply(`${e.error} Failed to add the bot.`);
            return sendReply(`${e.success} Music bot <@${botId}> added. Use \`.v music add ${botId} ${joinCmd}\` again to set the join command.`);
          });
          return;
        }
        return sendReply(`${e.success} Music bot <@${botId}> added with join command \`${joinCmd}\`.`);
      });
    });
  },
};
