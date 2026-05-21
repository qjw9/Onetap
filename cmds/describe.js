const {
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  PermissionsBitField,
} = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'describe',
  async execute(message, args, client) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      const text = new TextDisplayBuilder().setContent(`${e.error} You need **Administrator** permission.`);
      return message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [new ContainerBuilder().addTextDisplayComponents(text)] });
    }

    const botAvatar = client.user.displayAvatarURL({ size: 256, extension: 'png' });
    const guildName = message.guild.name;

    const container = new ContainerBuilder();

    // Bot avatar
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(botAvatar)
      )
    );

    // Title
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# ${client.user.username} — Now Available\n` +
        `-# Your personal voice room, instantly created.`
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large)
    );

    // What it does
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### How It Works`)
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `Join the **One Tap** voice channel and the bot instantly creates a private room just for you.\n` +
        `You are the owner — full control over who joins, channel settings, and more.\n` +
        `When everyone leaves, the room is automatically deleted.`
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large)
    );

    // Features
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### What You Can Do`)
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Room Control**\n` +
        `-# Lock, unlock, rename, set a user limit, hide or show your room.\n\n` +
        `**Access Management**\n` +
        `-# Permit or deny specific users and roles. Kick anyone from your room.\n\n` +
        `**Whitelist & Blacklist**\n` +
        `-# Auto-allow trusted users, auto-block unwanted ones every time you create a room.\n\n` +
        `**Managers**\n` +
        `-# Delegate control to up to 6 trusted users who can manage your room.\n\n` +
        `**Features**\n` +
        `-# Toggle soundboard, camera, and activities for everyone in your room.`
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large)
    );

    // Commands overview
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### Quick Command Reference`)
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `\`lock\` \`unlock\` \`permit\` \`deny\` \`kick\` \`limit\` \`name\` \`claim\` \`transfer\`\n` +
        `\`wl-add\` \`wl-remove\` \`bl-add\` \`bl-remove\` \`man-add\` \`man-remove\`\n` +
        `\`hide\` \`unhide\` \`cam-on\` \`cam-off\` \`sb-on\` \`sb-off\` \`status\``
      )
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# For the full list use \`.v help\``)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large)
    );

    // Footer
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# © 2026 ${message.guild.name} • Developed by <@1287172309785776278>`
      )
    );

    await message.channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    });
  },
};