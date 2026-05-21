const {
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');
const e = require('../emojis');
const VoiceTime = require('../models/VoiceTime');

function formatTime(seconds) {
  if (!seconds || seconds < 60) return `${seconds || 0}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `**${h}h** ${m}m`;
  return `**${m}m** ${Math.floor(seconds % 60)}s`;
}

module.exports = {
  name: 'top',
  async execute(message, args, client, db) {
    const guildId = message.guild.id;

    // 1. Fetch Top 10 from MongoDB
    const topUsers = await VoiceTime.find({ guildId })
      .sort({ totalSeconds: -1 })
      .limit(10);

    if (topUsers.length === 0) {
      const empty = new TextDisplayBuilder()
        .setContent(`${e.error} No voice activity recorded yet.`);
      return message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [new ContainerBuilder().addTextDisplayComponents(empty)] });
    }

    // 2. Build Container
    const container = new ContainerBuilder();

    // Header
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# <a:top1:1483986940054470757> Voice Leaderboard\n` +
        `> Top **10** active members in **${message.guild.name}**`
      )
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large)
    );

    // 3. Add Users with Beautiful Emojis
    const medals = ['🥇', '🥈', '🥉'];

    for (let i = 0; i < topUsers.length; i++) {
      const userData = topUsers[i];
      const rankEmoji = medals[i] || `#${i + 1}`;
      
      // Calculate total time (adding live session if implemented, else DB time)
      const time = formatTime(userData.totalSeconds);

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${rankEmoji} <@${userData.userId}>\n` +
          `> ⏱️ **Time:** ${time}`
        )
      );

      // Add separator between users (except last one)
      if (i < topUsers.length - 1) {
        container.addSeparatorComponents(
          new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
        );
      }
    }

    // Footer
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# 🏆 Last Updated: <t:${Math.floor(Date.now() / 1000)}:R>`
      )
    );

    // Button
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`voice_rank_${guildId}`)
          .setLabel('Show My Rank')
          .setEmoji('📊')
          .setStyle(ButtonStyle.Primary)
      )
    );

    await message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
  },
};