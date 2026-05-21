const {
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionsBitField,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');
const e = require('../emojis');

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${Math.floor(seconds % 60)}s`;
}

function getMonthStart() {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
}

module.exports = {
  name: 'topmonth',
  async execute(message, args, client, db) {
    const sendReply = (content) => {
      const text = new TextDisplayBuilder().setContent(content);
      return message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [new ContainerBuilder().addTextDisplayComponents(text)] });
    };

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return sendReply(`${e.error} You need **Administrator** permission to use this command.`);

    const guildId = message.guild.id;
    const { voiceDb, voiceSessions } = require('../events/voiceStateUpdate');
    const monthStart = getMonthStart();

    const rows = await new Promise((resolve, reject) => {
      voiceDb.all(
        `SELECT user_id, month_seconds FROM voice_time WHERE guild_id = ? AND month_reset >= ? ORDER BY month_seconds DESC`,
        [guildId, monthStart],
        (err, rows) => (err ? reject(err) : resolve(rows || []))
      );
    });

    const now = Date.now();
    const liveMap = new Map();
    for (const [key, joinedAt] of voiceSessions.entries()) {
      const [uid, gid] = key.split('-');
      if (gid === guildId) liveMap.set(uid, Math.floor((now - joinedAt) / 1000));
    }

    const combined = new Map();
    for (const row of rows) combined.set(row.user_id, row.month_seconds || 0);
    for (const [uid, liveSec] of liveMap.entries()) combined.set(uid, (combined.get(uid) || 0) + liveSec);

    const sorted = [];
    for (const [uid, secs] of [...combined.entries()].sort((a, b) => b[1] - a[1])) {
      const member = await message.guild.members.fetch(uid).catch(() => null);
      if (member && !member.user.bot) sorted.push([uid, secs]);
      if (sorted.length >= 10) break;
    }

    if (sorted.length === 0) return sendReply(`${e.error} No voice activity this month.`);

    const monthName = new Date().toLocaleString('en', { month: 'long' });

    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# <a:top1:1483986940054470757> Monthly Voice Leaderboard\n-# Top **${sorted.length}** most active in **${monthName}** in **${message.guild.name}**`
      )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large));

    for (let i = 0; i < sorted.length; i++) {
      const [uid, secs] = sorted[i];
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`* __User__ : <@${uid}> ヤ\n* __Voice Time__ : ${formatTime(secs)} ヤ`)
      );
      if (i < sorted.length - 1) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      }
    }

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Resets 1st of each month • <t:${Math.floor(Date.now() / 1000)}:R>`)
    );
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`voice_rank_${guildId}`)
          .setLabel('Show My Rank')
          .setStyle(ButtonStyle.Secondary)
      )
    );

    await message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
  },
};
