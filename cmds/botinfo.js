const {
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = require('discord.js');

const BOT_OWNER_ID = '1287172309785776278';

module.exports = {
  name: 'botinfo',
  async execute(message, args, client, db) {

    const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
    const totalChannels = client.guilds.cache.reduce((acc, g) => acc + g.channels.cache.size, 0);
    const memUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const memTotal = (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1);
    const nodeVersion = process.version;
    const uptime = client.uptime;

    const days = Math.floor(uptime / 86400000);
    const hours = Math.floor((uptime % 86400000) / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    const seconds = Math.floor((uptime % 60000) / 1000);
    const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    const avatarURL = client.user.displayAvatarURL({ size: 256, extension: 'png' });

    const container = new ContainerBuilder();

    // Bot avatar
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(avatarURL)
      )
    );

    // Title
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# ${client.user.username}\n-# \`${client.user.id}\``
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large)
    );

    // Stats
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Servers**\n${client.guilds.cache.size.toLocaleString()}`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Members**\n${totalMembers.toLocaleString()}`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Channels**\n${totalChannels.toLocaleString()}`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Uptime**\n${uptimeStr}`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Memory**\n${memUsage} MB / ${memTotal} MB`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Node.js**\n${nodeVersion}`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**discord.js**\nv${require('discord.js').version}`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Developed by <@${BOT_OWNER_ID}>`)
    );

    await message.channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    });
  },
};