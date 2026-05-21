const { TextDisplayBuilder, ContainerBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'event',
  async execute(message, args, client, configDB, eventDB) {
    const sendReply = (content, channel = message.channel) => {
        const textComponent = new TextDisplayBuilder().setContent(content);
        const containerComponent = new ContainerBuilder().addTextDisplayComponents(textComponent);
        channel.send({
            flags: MessageFlags.IsComponentsV2,
            components: [containerComponent],
        });
    };

    const userId = message.author.id;
    const guildId = message.guild.id;
    const member = message.guild.members.cache.get(userId);
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      return sendReply(`${e.error} You must be connected to a voice channel to use this command.`);
    }

    configDB.get(
      'SELECT event_role, event_category, event_channel FROM event_manager WHERE guild_id = ?',
      [guildId],
      async (err, row) => {
        if (err) {
          console.error(err);
          return sendReply(`${e.error} Database error occurred while fetching event data.`);
        }

        if (!row) {
          return sendReply(`${e.error} No event data found for this server.`);
        }

        const eventRole = String(row.event_role);
        const eventCategoryId = row.event_category;
        const eventLogChannelId = row.event_channel;

        if (!eventCategoryId || isNaN(eventCategoryId)) {
          return sendReply(`${e.error} Invalid event category ID in the database.`);
        }

        try {
          const tempChannelRow = await new Promise((resolve, reject) => {
            configDB.get(
              'SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?',
              [voiceChannel.id, guildId],
              (err, row) => {
                if (err) reject(err);
                else resolve(row);
              }
            );
          });

          const channelOwnerId = tempChannelRow?.owner_id;
          const isOwner = channelOwnerId === userId;
          const isEventManager = member.roles.cache.has(eventRole);
          const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

          if (!isOwner || (!isEventManager && !isAdmin)) {
            return sendReply(`${e.error} You must be the voice channel owner **and** either an event manager or have admin permissions.`);
          }

          const eventCategory = await message.guild.channels.fetch(eventCategoryId);
          if (!eventCategory || eventCategory.type !== 4) {
            console.error(`${e.error} Invalid category type: ${eventCategory?.type}`);
            return sendReply(`${e.error} Invalid or missing event category.`);
          }

          await voiceChannel.setParent(eventCategoryId);
          await voiceChannel.permissionOverwrites.edit(message.guild.roles.everyone, {
            Speak: false
          });

          const replyContent = [
            `**${e.success} Event Channel Updated**`,
            'The voice channel has been moved to the event category and speak permissions have been disabled.',
            `**Event Category:** ${eventCategory.name}`,
            `**Speak Permissions:** Disabled for everyone`,
            `*Requested by ${message.author.tag}*`
          ].join('\n');

          sendReply(replyContent);

          if (eventLogChannelId) {
            const logChannel = await message.guild.channels.fetch(eventLogChannelId).catch(() => null);
            if (logChannel && logChannel.isTextBased()) {
              const voiceMembers = [...voiceChannel.members.values()];
              const memberNames = voiceMembers.map(m => m.displayName).join('\n') || 'No members';
              const memberCount = voiceMembers.length;

              const eventManagersInVC = voiceMembers.filter(m => m.roles.cache.has(eventRole));
              const hostMentions = eventManagersInVC.length > 0
                ? eventManagersInVC.map(m => `<@${m.id}>`).join(', ')
                : 'None';

              const logContent = [
                `**📢 Event Started**`,
                `An event has been started in **${voiceChannel.name}**.`, 
                `**Hosters (Event Managers):** ${hostMentions}`,
                `**Participants:**\n${memberNames}`,
                `**Total Members:** ${memberCount}`
              ].join('\n');

              sendReply(logContent, logChannel);
            }
          }

        } catch (error) {
          console.error('Failed to update event:', error.message);
          return sendReply(`${e.error} Failed to update the event channel.`);
        }
      }
    );
  }
};
