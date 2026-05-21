'use strict';

const {
  PermissionsBitField,
  ChannelType,
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'auto-setup',
  async execute(message, args, client, db) {
    const SEP = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

    const sendReply = (content) => {
      const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
      return message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
    };

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return sendReply(`${e.error} You need **Administrator** permission to use this command.`);
    }

    const guild = message.guild;
    const MAIN_CATEGORY_NAME    = 'One Tap';
    const TRIGGER_VC_NAME       = '・One Tap :';
    const TEXT_NAME             = 'interface';
    const LB_NAME               = '📊・leaderboard';
    const LOGS_NAME             = '📋・logs';

    const FALLIN_CATEGORY_NAME  = '・One Tap :';
    const FALLIN_VC_NAME        = '🛑・Fallin +18';

    try {
      let mainCategory = guild.channels.cache.find(
        c => c.name === MAIN_CATEGORY_NAME && c.type === ChannelType.GuildCategory
      );
      if (!mainCategory) {
        mainCategory = await guild.channels.create({
          name: MAIN_CATEGORY_NAME,
          type: ChannelType.GuildCategory,
        });
      }
      let triggerVC = guild.channels.cache.find(
        c => c.name === TRIGGER_VC_NAME && c.parentId === mainCategory.id && c.type === ChannelType.GuildVoice
      );
      if (!triggerVC) {
        triggerVC = await guild.channels.create({
          name:   TRIGGER_VC_NAME,
          type:   ChannelType.GuildVoice,
          parent: mainCategory.id,
        });
      }
      let textChannel = guild.channels.cache.find(
        c => c.name === TEXT_NAME && c.parentId === mainCategory.id && c.type === ChannelType.GuildText
      );
      if (!textChannel) {
        textChannel = await guild.channels.create({
          name:   TEXT_NAME,
          type:   ChannelType.GuildText,
          parent: mainCategory.id,
        });
      }
      let lbChannel = guild.channels.cache.find(
        c => c.name === LB_NAME && c.parentId === mainCategory.id && c.type === ChannelType.GuildText
      );
      if (!lbChannel) {
        lbChannel = await guild.channels.create({
          name:   LB_NAME,
          type:   ChannelType.GuildText,
          parent: mainCategory.id,
        });
      }
      let logsChannel = guild.channels.cache.find(
        c => c.name === LOGS_NAME && c.parentId === mainCategory.id && c.type === ChannelType.GuildText
      );
      if (!logsChannel) {
        logsChannel = await guild.channels.create({
          name:   LOGS_NAME,
          type:   ChannelType.GuildText,
          parent: mainCategory.id,
        });
      }
      let fallinCategory = guild.channels.cache.find(
        c => c.name === FALLIN_CATEGORY_NAME && c.type === ChannelType.GuildCategory
      );
      if (!fallinCategory) {
        fallinCategory = await guild.channels.create({
          name: FALLIN_CATEGORY_NAME,
          type: ChannelType.GuildCategory,
        });
      }
      let fallinVC = guild.channels.cache.find(
        c => c.name === FALLIN_VC_NAME && c.parentId === fallinCategory.id && c.type === ChannelType.GuildVoice
      );
      if (!fallinVC) {
        fallinVC = await guild.channels.create({
          name:   FALLIN_VC_NAME,
          type:   ChannelType.GuildVoice,
          parent: fallinCategory.id,
        });
      }
      await new Promise((res, rej) => {
        db.get(`SELECT * FROM guild_config WHERE guild_id = ?`, [guild.id], (err, row) => {
          if (err) return rej(err);
          if (row) {
            db.run(
              `UPDATE guild_config
               SET room_id = ?, fallin_channel_id = ?, leaderboard_channel_id = ?, voice_logs_channel = ?
               WHERE guild_id = ?`,
              [triggerVC.id, fallinVC.id, lbChannel.id, logsChannel.id, guild.id],
              (dbErr) => dbErr ? rej(dbErr) : res()
            );
          } else {
            db.run(
              `INSERT INTO guild_config (guild_id, room_id, fallin_channel_id, leaderboard_channel_id, voice_logs_channel)
               VALUES (?, ?, ?, ?, ?)`,
              [guild.id, triggerVC.id, fallinVC.id, lbChannel.id, logsChannel.id],
              (dbErr) => dbErr ? rej(dbErr) : res()
            );
          }
        });
      });
      const msgs = await textChannel.messages.fetch({ limit: 50 });
      const botMsgs = msgs.filter(m => m.author.id === client.user.id);
      if (botMsgs.size > 0) await textChannel.bulkDelete(botMsgs, true).catch(() => {});

      // Build the exact same beautiful panel as the one sent in voice channels
      const { buildInlinePanel, buildHelpView } = require('../events/voiceStateUpdate');
      const panelContainer = buildInlinePanel(null, guild.id, guild.name, null, null);

      const panelMsg = await textChannel.send({ flags: MessageFlags.IsComponentsV2, components: [panelContainer] });

      // Collect show_voice_help / help_back_to_panel — anyone in the interface can use these
      const collector = panelMsg.createMessageComponentCollector({
        filter: (i) =>
          i.message.id === panelMsg.id &&
          (i.customId === 'show_voice_help' || i.customId === 'help_back_to_panel'),
        time: 0, // no timeout — stays alive forever
      });

      collector.on('collect', async (interaction) => {
        try {
          await interaction.deferUpdate();
          if (interaction.customId === 'show_voice_help') {
            await panelMsg.edit(buildHelpView(guild.id, guild.name));
          } else if (interaction.customId === 'help_back_to_panel') {
            const restored = buildInlinePanel(null, guild.id, guild.name, null, null);
            await panelMsg.edit({ flags: MessageFlags.IsComponentsV2, components: [restored] });
          }
        } catch {}
      });
      const { buildLeaderboardEmbed } = require('../utils/leaderboard');
      const lbEmbed = buildLeaderboardEmbed([], guild.name);
      const lbMsg   = await lbChannel.send({ flags: MessageFlags.IsComponentsV2, components: [lbEmbed] });
      db.run('UPDATE guild_config SET leaderboard_msg_id = ? WHERE guild_id = ?', [lbMsg.id, guild.id]);
      const successContainer = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `# ${e.success} Setup Complete!\n\n` +
          `> **__Main Category__** — \`${MAIN_CATEGORY_NAME}\`\n` +
          `> ・ Trigger VC: <#${triggerVC.id}>\n` +
          `> ・ Interface: <#${textChannel.id}>\n` +
          `> ・ Leaderboard: <#${lbChannel.id}>\n` +
          `> ・ Logs: <#${logsChannel.id}>\n\n` +
          `> **__Fallin Category__** — \`${FALLIN_CATEGORY_NAME}\`\n` +
          `> ・ Fallin +18: <#${fallinVC.id}>`
        ))
        .addSeparatorComponents(SEP())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `-# © 2026 ℤ𝕎𝔸𝔽ℝ𝕀𝕐𝔸. All rights reserved.`
        ));

      return message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [successContainer] });

    } catch (error) {
      console.error('[Auto-Setup Error]', error);
      return sendReply(`${e.error} An error occurred during setup. Please check my permissions and try again.\n\`${error.message}\``);
    }
  },
};
