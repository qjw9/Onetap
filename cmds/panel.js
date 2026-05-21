'use strict';

const { MessageFlags } = require('discord.js');
const e = require('../emojis');
const { styledSend } = require('../utils/reply');

let buildInlinePanel, buildHelpView;
try {
  const voiceModule = require('../events/voiceStateUpdate');
  buildInlinePanel = voiceModule.buildInlinePanel;
  buildHelpView    = voiceModule.buildHelpView;
} catch (err) {
  console.error('Failed to import from voiceStateUpdate.js:', err.message);
}

module.exports = {
  name: 'panel',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    if (!buildInlinePanel || !buildHelpView) {
      return err('System error: Panel modules failed to load. Check terminal logs.');
    }

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return err('You must be connected to a voice channel.');
    }

    try {
      const configRow = await new Promise(res =>
        db.get(
          'SELECT rules_ticket_channel, rules_voice_channel FROM guild_config WHERE guild_id = ?',
          [message.guild.id],
          (_, row) => res(row || {})
        )
      );

      const container = buildInlinePanel(
        message.author.id,
        message.guild.id,
        message.guild.name,
        configRow.rules_ticket_channel || null,
        configRow.rules_voice_channel  || null
      );

      const panelMsg = await message.channel.send({
        flags:      MessageFlags.IsComponentsV2,
        components: [container],
      }).catch(() => { throw new Error('I cannot send messages here.'); });

      if (!panelMsg) return;

      const collector = panelMsg.createMessageComponentCollector({
        filter: i =>
          i.message.id === panelMsg.id &&
          (i.customId === 'show_voice_help' || i.customId === 'help_back_to_panel'),
        time: 600_000,
      });

      collector.on('collect', async (interaction) => {
        try {
          // Only the channel owner can flip pages
          if (interaction.user.id !== message.author.id) {
            return interaction.deferUpdate().catch(() => {});
          }
          await interaction.deferUpdate();

          if (interaction.customId === 'show_voice_help') {
            const helpView = buildHelpView(message.guild.id, message.guild.name);
            await panelMsg.edit(helpView).catch(() => {});
          } else if (interaction.customId === 'help_back_to_panel') {
            const restored = buildInlinePanel(
              message.author.id,
              message.guild.id,
              message.guild.name,
              configRow.rules_ticket_channel || null,
              configRow.rules_voice_channel  || null
            );
            await panelMsg.edit({ flags: MessageFlags.IsComponentsV2, components: [restored] }).catch(() => {});
          }
        } catch (err) {
          console.error('[Panel Collector]', err.message);
        }
      });
    } catch (err) {
      console.error('[panel] Runtime Error:', err);
      return styledSend(message, { title: 'Error', emoji: e.error.trim(), msg: err.message });
    }
  },
};
