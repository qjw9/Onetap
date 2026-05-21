const { TextDisplayBuilder, ContainerBuilder, MessageFlags, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'task',
  async execute(message, args, client, db) {
    const sendReply = (content, ephemeral = false) => {
        const textComponent = new TextDisplayBuilder().setContent(content);
        const containerComponent = new ContainerBuilder().addTextDisplayComponents(textComponent);
        message.reply({
            flags: MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0),
            components: [containerComponent],
        });
    };
    const userId = message.author.id;
    const guildId = message.guild.id;

    const member = message.guild.members.cache.get(userId);
    const voiceChannel = member?.voice.channel;

    if (!voiceChannel) {
      return sendReply(`${e.error} You must be in a voice channel to use this command.`);
    }

    // Get owner of voice channel
    const tempChannelRow = await new Promise((resolve, reject) => {
      db.get(`SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?`,
        [voiceChannel.id, guildId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
    });

    if (!tempChannelRow) {
      return sendReply(`${e.error} This voice channel is not managed by the bot.`);
    }

    if (tempChannelRow.owner_id !== userId) {
      return sendReply(`${e.error} You must be the voice channel owner to use this command.`);
    }

    // Check if user is admin or has a tasker role
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

    const taskSettingsRow = await new Promise((resolve, reject) => {
      db.get(`SELECT tasklogs, taskers FROM task_settings WHERE guild_id = ?`, [guildId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!taskSettingsRow?.tasklogs) {
      return sendReply('⚠️ Tasklogs channel is not set. Use `.v set-tasklogs` to configure it.');
    }

    const taskerRoleIds = taskSettingsRow.taskers ? taskSettingsRow.taskers.split(',') : [];
    const isTasker = taskerRoleIds.some(roleId => member.roles.cache.has(roleId));

    if (!(isAdmin || isTasker)) {
      return sendReply(`${e.error} You need to be an admin or have a tasker role to use this command.`);
    }

    // Collect members in voice channel
    const voiceMembers = voiceChannel.members;

    // Separate other taskers (exclude command user)
    const otherTaskers = voiceMembers.filter(m =>
      m.id !== userId && taskerRoleIds.some(roleId => m.roles.cache.has(roleId))
    );

    // Remaining members (not tasker and not command user)
    const remainingMembers = voiceMembers.filter(m =>
      m.id !== userId && !taskerRoleIds.some(roleId => m.roles.cache.has(roleId))
    );

    // Compose embed for tasklogs channel
    const taskReportContent = [
        `# 🎯 Task Report`,
        `**Tasker:** <@${userId}>`,
        `**Other Taskers:** ${otherTaskers.size > 0 ? otherTaskers.map(m => `<@${m.id}>`).join(', ') : 'None'}`,
        `**In Voice:** ${remainingMembers.size > 0 ? remainingMembers.map(m => `<@${m.id}>`).join(', ') : 'None'}`,
        `*Guild: ${message.guild.name} | Channel: ${voiceChannel.name}*`
    ].join('\n');

    const textComponent = new TextDisplayBuilder().setContent(taskReportContent);
    const containerComponent = new ContainerBuilder().addTextDisplayComponents(textComponent);
      

    // Create buttons
    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('task_accept')
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('task_deny')
          .setLabel('Deny')
          .setStyle(ButtonStyle.Danger)
      );

    // Fetch tasklogs channel
    const tasklogsChannel = message.guild.channels.cache.get(taskSettingsRow.tasklogs);
    if (!tasklogsChannel) {
      return sendReply('⚠️ Tasklogs channel configured does not exist or I cannot access it.');
    }

    try {
      await tasklogsChannel.send({ flags: MessageFlags.IsComponentsV2, components: [containerComponent, buttons] });

      // Confirm to command user
      sendReply(`${e.success} Task successfully sent to tasklogs channel.`, true);
    } catch (error) {
      console.error('Error sending tasklog embed:', error);
      sendReply('⚠️ Failed to send task report to the tasklogs channel.');
    }
  }
};
