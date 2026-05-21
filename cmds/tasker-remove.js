const { TextDisplayBuilder, ContainerBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'tasker-remove',
  async execute(message, args, client, db) {
    const sendReply = (content) => {
        const textComponent = new TextDisplayBuilder().setContent(content);
        const containerComponent = new ContainerBuilder().addTextDisplayComponents(textComponent);
        message.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [containerComponent],
        });
    };
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return sendReply(`${e.error} You need Administrator permissions to use this command.`);
    }

    const guildId = message.guild.id;
    let role = message.mentions.roles.first();

    if (!role && args[0]) {
      try {
        role = await message.guild.roles.fetch(args[0]);
      } catch {
        return sendReply(`${e.error} Invalid role ID or mention.`);
      }
    }

    if (!role) {
      return sendReply(`${e.error} Please mention a role or provide a valid role ID.`);
    }

    db.get(`SELECT taskers FROM task_settings WHERE guild_id = ?`, [guildId], (err, row) => {
      if (err) {
        console.error(err);
        return sendReply('⚠️ Database error occurred.');
      }

      let currentTaskers = row?.taskers ? row.taskers.split(',') : [];

      if (!currentTaskers.includes(role.id)) {
        return sendReply('⚠️ This role is not listed as a tasker.');
      }

      currentTaskers = currentTaskers.filter(id => id !== role.id);
      const updated = currentTaskers.join(',');

      db.run(`UPDATE task_settings SET taskers = ? WHERE guild_id = ?`, [updated, guildId], (err2) => {
        if (err2) {
          console.error(err2);
          return sendReply('⚠️ Failed to update tasker roles in the database.');
        }

        sendReply(`${e.success} Role <@&${role.id}> has been removed from taskers.`);
      });
    });
  }
};
