const { TextDisplayBuilder, ContainerBuilder, MessageFlags } = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'taskconfig',
  async execute(message, args, client, db) {
    const sendReply = (content) => {
        const textComponent = new TextDisplayBuilder().setContent(content);
        const containerComponent = new ContainerBuilder().addTextDisplayComponents(textComponent);
        message.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [containerComponent],
        });
    };

    const guildId = message.guild.id;

    db.get(`SELECT tasklogs, managers, taskers FROM task_settings WHERE guild_id = ?`, [guildId], (err, row) => {
      if (err) {
        console.error('DB error:', err);
        return sendReply('⚠️ Failed to retrieve task settings from the database.');
      }

      if (!row) {
        return sendReply('⚠️ No task settings found for this server yet.');
      }

      const tasklogChannel = row.tasklogs ? `<#${row.tasklogs}>` : 'Not Set';
      const managerRoles = row.managers
        ? row.managers.split(',').map(id => `<@&${id}>`).join(', ')
        : 'None';
      const taskerRoles = row.taskers
        ? row.taskers.split(',').map(id => `<@&${id}>`).join(', ')
        : 'None';

      const configMessage = `**📝 Task Configuration for \`${message.guild.name}\`**\n\n`
          + `**Task Log Channel:** ${tasklogChannel}\n`
          + `**${e.crown} Managers:** ${managerRoles}\n`
          + `**👷 Taskers:** ${taskerRoles}`;

      sendReply(configMessage);
    });
  }
};
