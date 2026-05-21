const {
  TextDisplayBuilder,
  ContainerBuilder,
  MessageFlags,
  ChannelType,
  PermissionsBitField,
} = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'voicestats',
  async execute(message, args, client, db) {
    const sendReply = (content) => {
      const text = new TextDisplayBuilder().setContent(content);
      return message.channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [new ContainerBuilder().addTextDisplayComponents(text)],
      });
    };

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return sendReply(`${e.error} You need **Administrator** permission.`);

    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);

    if (!channel)
      return sendReply(`${e.error} Please mention a channel.\n-# Usage: \`.v voicestats #channel\``);

    if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildText)
      return sendReply(`${e.error} Please mention a valid voice or text channel.`);

    const guildId = message.guild.id;

    // Save to DB
    db.run(`
      INSERT INTO guild_config (guild_id, voicestats_channel)
      VALUES (?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET voicestats_channel = excluded.voicestats_channel
    `, [guildId, channel.id], (err) => {
      if (err) return sendReply(`${e.error} Database error.`);
    });

    // Do first update immediately
    updateVoiceStats(message.guild, channel);

    return sendReply(`${e.success} Voice stats channel set to ${channel}.\n-# Updates every 5 minutes.`);
  },
};

async function updateVoiceStats(guild, channel) {
  try {
    const inVoice = guild.channels.cache.filter(
      c => c.type === ChannelType.GuildVoice && c.members.size > 0
    ).reduce((acc, c) => acc + c.members.size, 0);

    await channel.setName(`🔊 In Voice: ${inVoice}`);
  } catch {}
}

module.exports.updateVoiceStats = updateVoiceStats;