const { TextDisplayBuilder, ContainerBuilder, MessageFlags } = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'set-event-manager',
  usage: '.set-event-manager <role mention or ID>',

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
      return sendReply(`${e.error} You need to be an admin to set the event manager!`);
    }

    if (!args.length) {
      return sendReply(`${e.error} Please mention a role or provide a valid role ID.`);
    }

    const input = args[0];
    const role = message.mentions.roles.first() || message.guild.roles.cache.get(input);

    if (!role) {
      return sendReply(`${e.error} Could not find a valid role by mention or ID.`);
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
            ? 'UPDATE event_manager SET event_role = ? WHERE guild_id = ?'
            : 'INSERT INTO event_manager (event_role, guild_id) VALUES (?, ?)';

          const params = row
            ? [role.id, guildId]
            : [role.id, guildId];

          configDB.run(query, params, (err) => {
            if (err) {
              console.error(`${e.error} Failed to set event manager role:`, err.message);
              return sendReply(`${e.error} An error occurred while saving the event manager role.`);
            }

            const successMessage = `${e.success} **Event Manager Role Set**\nThe event manager role has been set to **${role.name}**.`;
            sendReply(successMessage);
          });
        }
      );
    } catch (err) {
      console.error(`${e.error} Event Manager Error:`, err.message);
      return sendReply(`${e.error} An error occurred while setting the event manager role.`);
    }
  },
};
