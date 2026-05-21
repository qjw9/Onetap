'use strict';

const {
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');

const SEP = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

/**
 * Build a styled Components-V2 payload with Discord separators.
 *
 * Format:
 *   # {emoji} {title}
 *   ─────────────────
 *   - __message line 1__
 *   - __message line 2__
 *   ─────────────────
 *   -# © 2026 ℤ𝕎𝔸𝔽ℝ𝕀𝕐𝔸. All rights reserved.
 */
function buildStyled({ title = 'Notice', emoji, msg, usage }) {
  let bodyText  = msg    || '';
  let usageText = usage  || '';

  if (!usageText && bodyText.includes('Usage:')) {
    const [before, after] = bodyText.split('Usage:');
    bodyText  = before;
    usageText = after;
  }

  bodyText = bodyText.replace(/\\n/g, '').trim();

  const bodyLines = bodyText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => `- __${l}__`)
    .join('\n');

  const usagePart = usageText
    ? `\n### Usage: __${usageText.trim()}__`
    : '';

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${emoji} ${title}`)
    )
    .addSeparatorComponents(SEP())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${bodyLines}${usagePart}`)
    )
    .addSeparatorComponents(SEP())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# © 2026 ℤ𝕎𝔸𝔽ℝ𝕀𝕐𝔸. All rights reserved.`)
    );

  return container;
}

/**
 * Send a styled reply to a button/slash interaction (ephemeral by default).
 */
async function styledReply(interaction, opts) {
  const container = buildStyled(opts);
  const flags = opts.ephemeral === false
    ? MessageFlags.IsComponentsV2
    : MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.editReply({ flags, components: [container] });
    }
    return await interaction.reply({ flags, components: [container] });
  } catch (_) {}
}

/**
 * Send a styled message to a text channel (prefix commands).
 */
async function styledSend(message, opts) {
  const container = buildStyled(opts);
  return message.channel.send({
    flags: MessageFlags.IsComponentsV2,
    components: [container],
  });
}

module.exports = { styledReply, styledSend, buildStyled };
