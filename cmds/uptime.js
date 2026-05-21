const {
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = require('discord.js');

module.exports = {
  name: 'uptime',
  async execute(message, args, client, db) {
    const startTimestamp = Math.floor((Date.now() - client.uptime) / 1000);
    const now = new Date();

    // Formatting for a cleaner look
    const fullDate = now.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const BANNER_URL = 'https://timg.eu.cc/7rimLaYZYd.png'; // Using your help banner for consistency

    const container = new ContainerBuilder();

    // 1. Header Banner
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(BANNER_URL)
      )
    );

    // 2. Title with Aesthetic Symbols
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## 々 SYSTEM UPTIME`)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    // 3. Status Section (Using Grid-style layout with emojis)
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**<a:online:1483620427157995621>  Connection Status**\n` +
        `\`<a:online:1483620427157995621> \` Online & Operational\n\n` +
        `**<a:online:1483620427157995621>  Time Since Last Reboot**\n` +
        `<t:${startTimestamp}:R> *(since <t:${startTimestamp}:f>)*`
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    );

    // 4. Detailed Timestamp Section
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**<:point:1484325853625057400> Current Session Time**\n` +
        `\`${fullDate}\``
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large)
    );

    // 5. Footer (Minimalist)
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-#  System maintained by <@1287172309785776278>`
      )
    );

    await message.channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [container.toJSON()],
    });
  },
};