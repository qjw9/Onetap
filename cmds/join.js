const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionsBitField,
  ChannelType,
} = require('discord.js');

const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

function getPersistentJoins(client) {
  if (!client._persistentVoiceJoins) client._persistentVoiceJoins = new Map();
  return client._persistentVoiceJoins;
}

module.exports = {
  name: 'join',
  aliases: ['joinvc', 'stayvc'],
  async execute(message, args, client) {
    const sep = new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

    const sendReply = (desc, isError = false) => {
      const text = new TextDisplayBuilder().setContent(`${isError ? '<a:error:1483619894993092700> ' : '<a:success:1483619816291041430> '} ${desc}`);
      return message.reply({
        flags: MessageFlags.IsComponentsV2,
        components: [new ContainerBuilder().addTextDisplayComponents(text)],
      });
    };

    if (!message.guild) return sendReply('This command can only be used in a server.', true);

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return sendReply('You need **Administrator** permission to use this command.', true);
    }

    if (!args[0]) {
      const title  = new TextDisplayBuilder().setContent('## <a:voice:1483668492397052135>  Join Command\n> Make the bot join a voice channel and stay permanently.');
      const detail = new TextDisplayBuilder().setContent(
        '**:: Usage ::**\n`.v join #channel` or `.v join <channel_id>`\n\n' +
        '**:: Example ::**\n`.v join #Music` — bot joins and never leaves\n\n' +
        '**:: Notes ::**\n' +
        '> The bot will stay in the channel until you use `.v join leave` or the bot restarts.\n' +
        '> If disconnected by someone, it reconnects automatically within seconds.'
      );
      const container = new ContainerBuilder()
        .addTextDisplayComponents(title)
        .addSeparatorComponents(sep)
        .addTextDisplayComponents(detail);
      return message.reply({ flags: MessageFlags.IsComponentsV2, components: [container] });
    }

    const persistentJoins = getPersistentJoins(client);

    if (['leave', 'stop', 'disconnect', 'dc'].includes(args[0].toLowerCase())) {
      const existing = persistentJoins.get(message.guild.id);
      if (!existing) return sendReply('The bot is not persistently joined to any channel in this server.', true);

      try {
        const conn = getVoiceConnection(message.guild.id);
        if (conn) conn.destroy();
      } catch {}

      persistentJoins.delete(message.guild.id);

      const title = new TextDisplayBuilder().setContent('## Disconnected');
      const body  = new TextDisplayBuilder().setContent(
        `**Channel:** <#${existing.channelId}>\n` +
        `**Disconnected by:** <@${message.author.id}>\n\n` +
        `-# The bot will no longer auto-rejoin this channel.`
      );
      const container = new ContainerBuilder()
        .addTextDisplayComponents(title)
        .addSeparatorComponents(sep)
        .addTextDisplayComponents(body);
      return message.reply({ flags: MessageFlags.IsComponentsV2, components: [container] });
    }

    const channelInput = args[0];
    const channelId    = channelInput.replace(/[<#>]/g, '');

    let voiceChannel;
    try {
      voiceChannel = await message.guild.channels.fetch(channelId);
    } catch {
      voiceChannel = message.guild.channels.cache.find(
        c => c.type === ChannelType.GuildVoice &&
             c.name.toLowerCase() === args.join(' ').toLowerCase()
      ) || null;
    }

    if (!voiceChannel) return sendReply('Voice channel not found. Please mention it or provide its ID.', true);
    if (voiceChannel.type !== ChannelType.GuildVoice && voiceChannel.type !== ChannelType.GuildStageVoice) {
      return sendReply('That is not a voice channel. Please provide a **voice** channel.', true);
    }

    const botPerms = voiceChannel.permissionsFor(message.guild.members.me);
    if (!botPerms.has(PermissionsBitField.Flags.Connect)) {
      return sendReply(`I don't have **Connect** permission in <#${voiceChannel.id}>.`, true);
    }
    if (!botPerms.has(PermissionsBitField.Flags.ViewChannel)) {
      return sendReply(`I don't have **View Channel** permission in <#${voiceChannel.id}>.`, true);
    }

    const existing = persistentJoins.get(message.guild.id);
    if (existing) {
      try {
        const oldConn = getVoiceConnection(message.guild.id);
        if (oldConn) oldConn.destroy();
      } catch {}
    }

    let connection;
    try {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId:   message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf:  true,
        selfMute:  true,
      });
    } catch (err) {
      console.error('[join] Failed to join voice channel:', err);
      return sendReply('Failed to join the channel. Check my permissions and try again.', true);
    }

    persistentJoins.set(message.guild.id, {
      channelId: voiceChannel.id,
      connection,
    });

    // FIX: Auto-rejoin with null safety — voiceChannel can become stale in the closure
    connection.on('stateChange', async (oldState, newState) => {
      if (newState.status === 'destroyed' || newState.status === 'disconnected') {
        const stillPersistent = persistentJoins.get(message.guild.id);
        // FIX: Use optional chaining — voiceChannel.id could throw if voiceChannel is null
        if (!stillPersistent || stillPersistent.channelId !== voiceChannel?.id) return;

        console.log(`[join] Disconnected from ${voiceChannel?.name ?? 'unknown'} in ${message.guild.name} — rejoining in 3s...`);

        setTimeout(async () => {
          // FIX: Re-check persistence INSIDE the timeout — user may have run `.v join leave` during the 3s wait
          const check = persistentJoins.get(message.guild.id);
          if (!check || check.channelId !== voiceChannel?.id) return;

          try {
            // FIX: Re-fetch the channel fresh instead of using the stale closure reference
            // This prevents "Cannot read properties of null (reading 'id')" at line 156
            const freshChannel = await message.guild.channels.fetch(voiceChannel.id).catch(() => null);

            // FIX: If the channel no longer exists, clear the persistent join and bail out
            if (!freshChannel) {
              console.warn(`[join] Channel ${voiceChannel.id} no longer exists — clearing persistent join.`);
              persistentJoins.delete(message.guild.id);
              return;
            }

            const newConn = joinVoiceChannel({
              channelId: freshChannel.id,
              guildId:   message.guild.id,
              adapterCreator: message.guild.voiceAdapterCreator,
              selfDeaf:  true,
              selfMute:  true,
            });
            persistentJoins.set(message.guild.id, { channelId: freshChannel.id, connection: newConn });
            console.log(`[join] Rejoined ${freshChannel.name} in ${message.guild.name}`);
          } catch (e) {
            console.error('[join] Auto-rejoin failed:', e.message);
          }
        }, 3000);
      }
    });

    const title = new TextDisplayBuilder().setContent('## <a:voice:1483668492397052135>  Joined Voice Channel');
    const body  = new TextDisplayBuilder().setContent(
      `**Channel:** <#${voiceChannel.id}>\n` +
      `**Set by:** <@${message.author.id}>\n\n` +
      `> The bot is now permanently joined and will auto-rejoin if disconnected.\n` +
      `-# Use \`.v join leave\` to disconnect the bot.`
    );
    const container = new ContainerBuilder()
      .addTextDisplayComponents(title)
      .addSeparatorComponents(sep)
      .addTextDisplayComponents(body);
    return message.reply({ flags: MessageFlags.IsComponentsV2, components: [container] });
  },
};