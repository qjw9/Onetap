const { TextDisplayBuilder, ContainerBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'tman-add',
  async execute(message, args, client, db) {
    const sendReply = (content) => {
        const textComponent = new TextDisplayBuilder().setContent(content);
        const containerComponent = new ContainerBuilder().addTextDisplayComponents(textComponent);
        message.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [containerComponent],
        });
    };
    // Check admin permission
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

    // Get current managers
    db.get(`SELECT managers FROM task_settings WHERE guild_id = ?`, [guildId], (err, row) => {
      if (err) {
        console.error('DB error:', err);
        return sendReply('⚠️ Database error occurred.');
      }

      let currentManagers = [];
      if (row?.managers) {
        currentManagers = row.managers.split(',');
        if (currentManagers.includes(role.id)) {
          return sendReply('⚠️ This role is already a manager.');
        }
      }

      currentManagers.push(role.id);
      const updatedManagers = currentManagers.join(',');

      db.run(`
        INSERT INTO task_settings (guild_id, managers)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET managers = excluded.managers
      `, [guildId, updatedManagers], (err2) => {
        if (err2) {
          console.error('DB error on insert/update:', err2);
          return sendReply('⚠️ Failed to update manager roles in the database.');
        }

        sendReply(`${e.success} Role <@&${role.id}> has been added as a task manager.`);
      });
    });
  }
};
