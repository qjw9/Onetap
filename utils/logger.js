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

const SEP = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

// Map event type → emoji from emojis.js
const ICONS = {
  create:  e.success.trim(),
  delete:  e.error.trim(),
  lock:    e.lock.trim(),
  unlock:  e.unlock.trim(),
  join:    e.success.trim(),
  leave:   e.error.trim(),
  kick:    e.kick.trim(),
  permit:  e.permitUser.trim(),
  deny:    e.denyUser.trim(),
  abuse:   e.antiAbuse.trim(),
  tlock:   e.tlock.trim(),
  tunlock: e.tunlock.trim(),
};

const EVENT_LABELS = {
  create:  'Channel Created',
  delete:  'Channel Deleted',
  lock:    'Channel Locked',
  unlock:  'Channel Unlocked',
  join:    'Member Joined',
  leave:   'Member Left',
  kick:    'Member Kicked',
  permit:  'User Permitted',
  deny:    'User Denied',
  abuse:   'Anti-Abuse Triggered',
  tlock:   'Text Channel Locked',
  tunlock: 'Text Channel Unlocked',
};

/**
 * Send a beautiful embedv2 log to the configured voice_logs_channel.
 *
 * @param {Object} opts
 * @param {import('discord.js').Guild} opts.guild
 * @param {import('sqlite3').Database} opts.configDB
 * @param {'create'|'delete'|'lock'|'unlock'|'join'|'leave'|'kick'|'permit'|'deny'|'abuse'|'tlock'|'tunlock'} opts.type
 * @param {import('discord.js').GuildMember|null} opts.actor  - who triggered the event
 * @param {import('discord.js').GuildMember|null} opts.target - who was affected (if different)
 * @param {import('discord.js').GuildChannel|null} opts.channel
 * @param {string} [opts.extra] - optional extra detail line
 */
async function sendLog(opts) {
  const { guild, configDB, type, actor, target, channel, extra } = opts;

  try {
    const config = await new Promise(res =>
      configDB.get(
        'SELECT voice_logs_channel FROM guild_config WHERE guild_id = ?',
        [guild.id],
        (_, r) => res(r || null)
      )
    );
    if (!config?.voice_logs_channel) return;

    const logCh = guild.channels.cache.get(config.voice_logs_channel);
    if (!logCh) return;

    const icon  = ICONS[type]  || e.info.trim();
    const label = EVENT_LABELS[type] || type;
    const now   = Math.floor(Date.now() / 1000);

    const avatarUser = actor?.user || target?.user || null;
    const avatarUrl  = avatarUser?.displayAvatarURL({ size: 64 })
      || 'https://cdn.discordapp.com/embed/avatars/0.png';

    let lines = [`# ${icon} ${label}`];

    if (actor)                       lines.push(`> -# **By:** <@${actor.id}>`);
    if (target && target.id !== actor?.id)
                                     lines.push(`> -# **Target:** <@${target.id}>`);
    if (channel)                     lines.push(`> -# **Channel:** <#${channel.id}>`);
    if (extra)                       lines.push(`> -# ${extra}`);
    lines.push(`> -# **Time:** <t:${now}:R>`);

    const container = new ContainerBuilder();

    try {
      const section = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(lines.join('\n'))
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(avatarUrl)
        );
      container.addSectionComponents(section);
    } catch {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(lines.join('\n'))
      );
    }

    container
      .addSeparatorComponents(SEP())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# © 2026 ℤ𝕎𝔸𝔽ℝ𝕀𝕐𝔸. All rights reserved.`
        )
      );

    await logCh.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
  } catch (err) {
    console.error('[Logger Error]', err.message);
  }
}

module.exports = { sendLog };
