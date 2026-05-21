const { TextDisplayBuilder, ContainerBuilder, MessageFlags } = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'set-event-logs',
  usage: '.set-event-logs <channel-id>',
  
  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   * @param {import('discord.js').Client} client
   * @param {import('sqlite3').Database} configDB
   */
  async execute(message, args, client, configDB) {
    const sendReply = (content) => {
        const textComponent = new TextDisplayBuilder().setContent(content);
        const containerComponent = new ContainerBuilder().addTextDisplayComponents(textComponent);
        message.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [containerComponent],
        });
    };

    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return sendReply(`${e.error} You need to be an admin to set the event logs channel!`);
    }

    const channelId = args[0];
    if (!channelId || isNaN(channelId)) {
      return sendReply(`${e.error} Please provide a valid channel ID.`);
    }

    const guildId = message.guild.id;

    try {
      configDB.get(
        'SELECT 1 FROM event_manager WHERE guild_id = ?',
        [guildId],
        (err, row) => {
          if (err) {
            console.error(`${e.error} DB Error:`, err.message);
            return sendReply(`${e.error} Database error occurred.`);
          }

          const query = row
            ? 'UPDATE event_manager SET event_channel = ? WHERE guild_id = ?'
            : 'INSERT INTO event_manager (guild_id, event_channel) VALUES (?, ?)';

          const params = row
            ? [channelId, guildId]
            : [guildId, channelId];

          configDB.run(query, params, (err) => {
            if (err) {
              console.error(`${e.error} Failed to save log channel:`, err.message);
              return sendReply(`${e.error} An error occurred while saving the event logs channel.`);
            }

            const successMessage = `${e.success} **Event Logs Set**\nThe event logs channel has been set to <#${channelId}>.`;
            sendReply(successMessage);
          });
        }
      );
    } catch (err) {
      console.error(`${e.error} Event Manager Error:`, err.message);
      return sendReply(`${e.error} An error occurred while setting the event logs channel.`);
    }
  },
};
