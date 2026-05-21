const {
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionsBitField,
} = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'checkvoice',
  async execute(message, args, client, db) {
    const sendReply = (content) => {
      const text = new TextDisplayBuilder().setContent(content);
      const container = new ContainerBuilder().addTextDisplayComponents(text);
      return message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
    };

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return sendReply(`${e.error} You need **Administrator** permission to use this command.`);

    const target = message.mentions.users.first() ||
      (args[0] ? await client.users.fetch(args[0]).catch(() => null) : null);

    if (!target)
      return sendReply(`${e.error} Please mention a user or provide their ID.\n-# Usage: \`.v checkvoice @user\``);

    const loadingMsg = await message.channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`🔍 Scanning **${client.guilds.cache.size}** servers for <@${target.id}>...`)
      )],
    });

    const found = [];

    for (const guild of client.guilds.cache.values()) {
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (member?.voice?.channel) {
        found.push({
          guildName: guild.name,
          guildId: guild.id,
          channelName: member.voice.channel.name,
          channelId: member.voice.channel.id,
          memberCount: member.voice.channel.members.size,
          muted: member.voice.selfMute || member.voice.serverMute,
          deafened: member.voice.selfDeaf || member.voice.serverDeaf,
        });
      }
    }

    await loadingMsg.delete().catch(() => {});

    const container = new ContainerBuilder();

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# 🎙️ Voice Check — <@${target.id}>\n` +
        `-# Scanned **${client.guilds.cache.size}** mutual servers`
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large)
    );

    if (found.length === 0) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`❌ User is **not** in any voice channel across all mutual servers.`)
      );
    } else {
      for (let i = 0; i < found.length; i++) {
        const f = found[i];
        const status = [
          f.muted ? '🔇 Muted' : null,
          f.deafened ? '🔕 Deafened' : null,
        ].filter(Boolean).join(' • ') || '🎙️ Active';

        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### ${f.guildName}\n` +
            `-# 🔊 ${f.channelName} • ${f.memberCount} member(s)\n` +
            `-# ${status}\n` +
            `-# Channel ID: \`${f.channelId}\``
          )
        );

        if (i < found.length - 1) {
          container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
          );
        }
      }
    }

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Requested by <@${message.author.id}>`)
    );

    await message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
  },
};
