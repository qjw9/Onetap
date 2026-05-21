'use strict';

const {
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  MessageFlags,
} = require('discord.js');

const e = require('../emojis');

// Build the rank emoji for a given position (1-10) using emojis.js
function getRankEmoji(rank) {
  const map = {
    1:  e.leaderboard.trim(),   // <a:top1:1496946027306024990>
    2:  e.rankTwo,
    3:  e.rankThree,
    4:  e.rankFour,
    5:  e.rankFive,
    6:  e.rankSix,
    7:  e.rankSeven,
    8:  e.rankEight,
    9:  e.rankNine,
    10: `${e.rankOne}${e.rankZero}`,  // one + zero for 10
  };
  return map[rank] || `**${rank}.**`;
}

const SEP_LINE  = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

function buildLeaderboardEmbed(channels, guildName) {
  const container = new ContainerBuilder();

  if (channels.length === 0) {
    container
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `# ${e.leaderboardNo.trim()} There is no Channel Yet.`
        )
      )
      .addSeparatorComponents(SEP_LINE())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# © 2026 ℤ𝕎𝔸𝔽ℝ𝕀𝕐𝔸. All rights reserved.`
        )
      );
    return container;
  }

  for (let i = 0; i < channels.length; i++) {
    const { vc, ownerId, ownerAvatar } = channels[i];
    const rank       = i + 1;
    const rankEmoji  = getRankEmoji(rank);
    const tsCreated  = Math.floor(vc.createdTimestamp / 1000);

    const textContent =
      `## ${rankEmoji} ${vc.name}\n` +
      `> <:channels:1507027735032238155> -# **Channel:** <#${vc.id}>\n` +
      `> <:ownervc:1507028103413764298> -# **Owner:** <@${ownerId}>\n` +
      `> <:time:1490867007921459200> -# **Created:** <t:${tsCreated}:R>`;

    try {
      const section = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(textContent))
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(
            ownerAvatar || `https://cdn.discordapp.com/embed/avatars/0.png`
          )
        );
      container.addSectionComponents(section);
    } catch {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(textContent)
      );
    }

    if (i < channels.length - 1) {
      container.addSeparatorComponents(SEP_LINE());
    }
  }

  container
    .addSeparatorComponents(SEP_LINE())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# Copyright © 2026 **${guildName}** .Network, Inc. All rights reserved`
      )
    );

  return container;
}

/**
 * Fetch active One Tap channels for the guild, sorted by creation time (oldest = #1).
 */
async function getActiveTapChannels(guild, configDB) {
  const rows = await new Promise(res =>
    configDB.all(
      'SELECT channel_id, owner_id FROM temp_channels WHERE guild_id = ?',
      [guild.id],
      (_, r) => res(r || [])
    )
  );

  const results = [];
  for (const row of rows) {
    const vc = guild.channels.cache.get(row.channel_id);
    if (!vc) continue;

    let ownerAvatar = null;
    try {
      const ownerMember = guild.members.cache.get(row.owner_id)
        || await guild.members.fetch(row.owner_id).catch(() => null);
      ownerAvatar = ownerMember?.user?.displayAvatarURL({ size: 64 }) || null;
    } catch {}

    results.push({ vc, ownerId: row.owner_id, ownerAvatar });
  }

  results.sort((a, b) => a.vc.createdTimestamp - b.vc.createdTimestamp);
  return results.slice(0, 10);
}

/**
 * Build & send or edit the leaderboard message in the configured channel.
 */
async function updateLeaderboard(guild, configDB, client) {
  try {
    const config = await new Promise(res =>
      configDB.get(
        'SELECT leaderboard_channel_id, leaderboard_msg_id FROM guild_config WHERE guild_id = ?',
        [guild.id],
        (_, r) => res(r || null)
      )
    );
    if (!config?.leaderboard_channel_id) return;

    const lbChannel = guild.channels.cache.get(config.leaderboard_channel_id);
    if (!lbChannel) return;

    const channels = await getActiveTapChannels(guild, configDB);
    const embed    = buildLeaderboardEmbed(channels, guild.name);
    const payload  = { flags: MessageFlags.IsComponentsV2, components: [embed] };

    if (config.leaderboard_msg_id) {
      try {
        const existing = await lbChannel.messages.fetch(config.leaderboard_msg_id);
        await existing.edit(payload);
        return;
      } catch {}
    }

    const sent = await lbChannel.send(payload);
    configDB.run(
      'UPDATE guild_config SET leaderboard_msg_id = ? WHERE guild_id = ?',
      [sent.id, guild.id]
    );
  } catch (err) {
    console.error('[Leaderboard Update Error]', err.message);
  }
}

module.exports = { updateLeaderboard, buildLeaderboardEmbed, getActiveTapChannels };
