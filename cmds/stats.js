const {
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');
const e = require('../emojis');
const VoiceTime = require('../models/VoiceTime');

// Helper to calculate session time from the Map (optional, but good for live updates)
// We access the map exported from the voiceStateUpdate event
let voiceSessions;
try {
  voiceSessions = require('../events/voiceStateUpdate').voiceSessions;
} catch {
  voiceSessions = new Map(); // Fallback if event file isn't loaded yet
}

function formatTime(seconds) {
  if (!seconds || seconds < 60) return `${seconds || 0}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

module.exports = {
  name: 'stats',
  async execute(message, args, client, db) {
    const target = message.mentions.users.first() || message.author;
    const member = await message.guild.members.fetch(target.id).catch(() => null);
    if (!member) return;

    const guildId = message.guild.id;
    const userId = target.id;

    // 1. Fetch data from MongoDB
    const data = await VoiceTime.findOne({ guildId, userId }) || {
      totalSeconds: 0,
      weekSeconds: 0,
      monthSeconds: 0,
      streakDays: 0,
      bestStreak: 0,
    };

    // 2. Calculate live session time (if user is currently in voice)
    const sessionKey = `${userId}-${guildId}`;
    let liveSeconds = 0;
    
    if (voiceSessions && voiceSessions.has(sessionKey)) {
      liveSeconds = Math.floor((Date.now() - voiceSessions.get(sessionKey)) / 1000);
    }

    // 3. Combine DB time + Live time
    const total = (data.totalSeconds || 0) + liveSeconds;
    const week = (data.weekSeconds || 0) + liveSeconds;
    const month = (data.monthSeconds || 0) + liveSeconds;
    const streak = data.streakDays || 0;
    const best = data.bestStreak || 0;
    const isLive = liveSeconds > 0;

    // 4. Build the Container
    const streakEmoji = streak >= 7 ? '<a:fire:1486808333439729814> ' : streak >= 3 ? '<a:flash:1486809016679141507> ' : '<:calendrier:1486810210558542023> ';

    const container = new ContainerBuilder();

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# <a:voice:1486809160556216574>  Voice Stats\n-# <@${userId}> ${isLive ? ' Currently in voice' : ''}`
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### <:time:1486808097732169780>  Time\n` +
        `**Total:** ${formatTime(total)}\n` +
        `**This Week:** ${formatTime(week)}\n` +
        `**This Month:** ${formatTime(month)}`
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${streakEmoji} Streak\n` +
        `**Current:** ${streak} day${streak !== 1 ? 's' : ''}\n` +
        `**Best:** ${best} day${best !== 1 ? 's' : ''}`
      )
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# Stats for **${message.guild.name}** • <t:${Math.floor(Date.now() / 1000)}:R>`
      )
    );

    await message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
  },
};