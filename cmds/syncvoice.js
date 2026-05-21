const { TextDisplayBuilder, ContainerBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'syncvoice',
  usage: '.v syncvoice <user_id>',
  async execute(message, args, client, db) {
    const sendReply = (content) => {
        const textComponent = new TextDisplayBuilder().setContent(content);
        const containerComponent = new ContainerBuilder().addTextDisplayComponents(textComponent);
        message.channel.send({
            flags: MessageFlags.IsComponentsV2,
            components: [containerComponent],
        });
    };

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return sendReply(`${e.error} You do not have permission to use this command.`);
    }

    const guildId = message.guild.id;

    if (!args[0]) {
      return sendReply(`${e.error} Please provide a user ID.`);
    }

    const userId = args[0];
    const member = message.guild.members.cache.get(userId);

    if (!member) {
      return sendReply(`${e.error} User not found in this server.`);
    }

    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) {
      return sendReply(`${e.error} The user is not connected to a voice channel.`);
    }

    db.get(
      `SELECT * FROM temp_channels WHERE channel_id = ? AND guild_id = ?`,
      [voiceChannel.id, guildId],
      (err, row) => {
        if (err) {
          console.error(err);
          return sendReply(`${e.error} A database error occurred.`);
        }

        if (row) {
          return sendReply(`${e.error} This voice channel is already managed by the bot.`);
        }

        db.run(
          `INSERT INTO temp_channels (guild_id, channel_id, owner_id) VALUES (?, ?, ?)`,
          [guildId, voiceChannel.id, userId],
          (insertErr) => {
            if (insertErr) {
              console.error(insertErr);
              return sendReply(`${e.error} Failed to add voice channel to the database.`);
            }

            return sendReply(`${e.success} Voice channel synced successfully. Owner set to <@${userId}>.`);
          }
        );
      }
    );
  }
};
