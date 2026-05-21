const {
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  MediaGalleryBuilder,
} = require('discord.js');
const e = require('../emojis');
const BOT_OWNER_ID = '1287172309785776278';

module.exports = {
  name: 'servers',
  async execute(message, args, client) {
    if (message.author.id !== BOT_OWNER_ID) {
      const denied = new TextDisplayBuilder()
        .setContent(`${e.error} This command is restricted to the **bot owner** only.`);
      const container = new ContainerBuilder().addTextDisplayComponents(denied);
      return message.channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [container],
      });
    }

    const guilds = [...client.guilds.cache.values()];

    if (guilds.length === 0) {
      const empty = new TextDisplayBuilder().setContent(`${e.error} The bot is not in any servers.`);
      const container = new ContainerBuilder().addTextDisplayComponents(empty);
      return message.channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [container],
      });
    }
    const serverLines = guilds.map((guild, i) => {
      const memberCount = guild.memberCount ?? '?';
      return `**${i + 1}.** ${guild.name}\n-# ID: \`${guild.id}\` • Members: **${memberCount}**`;
    }).join('\n\n');
    const title = new TextDisplayBuilder()
      .setContent(`# 🌐 Bot Servers`);

    const stats = new TextDisplayBuilder()
      .setContent(`> Total servers: **${guilds.length}**`);

    const sep1 = new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Large);

    const list = new TextDisplayBuilder()
      .setContent(serverLines);

    const sep2 = new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small);

    const footer = new TextDisplayBuilder()
      .setContent(`-# Requested by <@${message.author.id}>`);

    const container = new ContainerBuilder()
      .addTextDisplayComponents(title, stats)
      .addSeparatorComponents(sep1)
      .addTextDisplayComponents(list)
      .addSeparatorComponents(sep2)
      .addTextDisplayComponents(footer);

    await message.channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    });
  },
};
