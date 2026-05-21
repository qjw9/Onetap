'use strict';

const {
  PermissionsBitField,
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const e        = require('../emojis');
const VoiceTime = require('../models/VoiceTime');

const musicCooldowns = new Set();

function formatTime(seconds) {
  if (!seconds || seconds < 60) return `${seconds || 0}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

async function safeReply(interaction, content) {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(content);
    } else {
      await interaction.reply(content);
    }
  } catch {}
}

function quickEmbed(text) {
  return {
    flags:      MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    components: [new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(text)
    )],
  };
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client, configDB, taskDB) {
    if (interaction.isStringSelectMenu() && interaction.customId === 'apply_position') {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

      const position = interaction.values[0].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      const modal = new ModalBuilder()
        .setCustomId(`apply_modal_${interaction.values[0]}`)
        .setTitle(`Apply for ${position}`);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('apply_age').setLabel('Your Age')
            .setStyle(TextInputStyle.Short).setPlaceholder('e.g. 18').setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('apply_timezone').setLabel('Your Timezone')
            .setStyle(TextInputStyle.Short).setPlaceholder('e.g. GMT+1, EST, CET').setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('apply_experience').setLabel('Your Experience')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Tell us about your previous experience...').setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('apply_why').setLabel('Why do you want to join?')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Why do you want to be part of our team?').setRequired(true)
        )
      );

      return interaction.showModal(modal).catch(() => {});
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith('apply_modal_')) {
      const positionKey = interaction.customId.replace('apply_modal_', '');
      const position    = positionKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      const age        = interaction.fields.getTextInputValue('apply_age');
      const timezone   = interaction.fields.getTextInputValue('apply_timezone');
      const experience = interaction.fields.getTextInputValue('apply_experience');
      const why        = interaction.fields.getTextInputValue('apply_why');

      const APPLICATION_CHANNEL_ID = 'YOUR_CHANNEL_ID_HERE';
      const appChannel = interaction.guild.channels.cache.get(APPLICATION_CHANNEL_ID);

      if (appChannel) {
        const SEP = new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
        const container = new ContainerBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# 📋 New Application — ${position}\n-# From <@${interaction.user.id}> • <t:${Math.floor(Date.now() / 1000)}:F>`
          ))
          .addSeparatorComponents(SEP)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Position:** ${position}`))
          .addSeparatorComponents(SEP)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Age:** ${age}\n**Timezone:** ${timezone}`))
          .addSeparatorComponents(SEP)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Experience:**\n${experience}`))
          .addSeparatorComponents(SEP)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Why join:**\n${why}`))
          .addSeparatorComponents(SEP)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `-# User ID: \`${interaction.user.id}\` • ${interaction.user.tag}`
          ));

        await appChannel.send({ flags: MessageFlags.IsComponentsV2, components: [container] }).catch(() => {});
      }

      const reply = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `✅ **Application submitted!**\n-# Your application for **${position}** has been received.`
        )
      );
      return interaction.reply({
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        components: [reply],
      }).catch(() => {});
    }

    if (!interaction.isButton()) return;
    const { customId, guild, member } = interaction;
    if (!guild) return;
    if (customId.startsWith('help_') || customId === 'show_help_menu') {
      return interaction.deferUpdate().catch(() => {});
    }
    if (customId.startsWith('anti_abuse_accept_')) {
      try {
        // Format: anti_abuse_accept_{joinerId}_{channelId}
        const rest      = customId.replace('anti_abuse_accept_', '');
        const lastUnd   = rest.lastIndexOf('_');
        const joinerId  = rest.substring(0, lastUnd);
        const channelId = rest.substring(lastUnd + 1);

        const { antiAbuseRequests, antiAbuseApproved } = require('./voiceStateUpdate');
        const requestKey = `${joinerId}-${channelId}`;

        // Verify the interaction is from the channel owner
        const reqData = antiAbuseRequests.get(requestKey);
        if (!reqData || reqData.ownerId !== interaction.user.id) {
          return interaction.reply(quickEmbed(`${e.error} You are not the owner of this channel.`)).catch(() => {});
        }

        // Mark as approved so they can join without being kicked
        antiAbuseApproved.add(requestKey);
        antiAbuseRequests.delete(requestKey);

        // Give the joiner Connect permission on the channel
        const vc = guild.channels.cache.get(channelId);
        if (vc) {
          await vc.permissionOverwrites.edit(joinerId, { Connect: true }).catch(() => {});
        }

        // Disable the buttons on the DM message
        await interaction.update({
          components: [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `<a:success:1499899743424217148> You accepted <@${joinerId}> to join your channel.`
              )
            ),
          ],
        }).catch(() => {});

      } catch (err) {
        console.error('[AntiAbuse Accept]', err.message);
        return interaction.reply(quickEmbed(`${e.error} Something went wrong.`)).catch(() => {});
      }
      return;
    }
    if (customId.startsWith('anti_abuse_deny_')) {
      try {
        const rest      = customId.replace('anti_abuse_deny_', '');
        const lastUnd   = rest.lastIndexOf('_');
        const joinerId  = rest.substring(0, lastUnd);
        const channelId = rest.substring(lastUnd + 1);

        const { antiAbuseRequests } = require('./voiceStateUpdate');
        const requestKey = `${joinerId}-${channelId}`;

        const reqData = antiAbuseRequests.get(requestKey);
        if (!reqData || reqData.ownerId !== interaction.user.id) {
          return interaction.reply(quickEmbed(`${e.error} You are not the owner of this channel.`)).catch(() => {});
        }

        // Keep the request alive so re-joins are still blocked
        // (just confirm the deny to owner)
        await interaction.update({
          components: [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `<a:reject:1494781666064072714> You denied <@${joinerId}>. They will keep being disconnected if they try to join.`
              )
            ),
          ],
        }).catch(() => {});

      } catch (err) {
        console.error('[AntiAbuse Deny]', err.message);
        return interaction.reply(quickEmbed(`${e.error} Something went wrong.`)).catch(() => {});
      }
      return;
    }
    if (customId.startsWith('music_getbot_')) {
      const guildId = customId.replace('music_getbot_', '');
      const userId  = interaction.user.id;

      const cooldownKey = `music_${userId}_${guildId}`;
      if (musicCooldowns.has(cooldownKey)) return interaction.deferUpdate().catch(() => {});
      musicCooldowns.add(cooldownKey);
      setTimeout(() => musicCooldowns.delete(cooldownKey), 5000);

      const memberObj    = await interaction.guild.members.fetch(userId).catch(() => null);
      const voiceChannel = memberObj?.voice?.channel;

      if (!voiceChannel) {
        return interaction.reply(quickEmbed(`${e.error} You must be in a voice channel first.`)).catch(() => {});
      }

      const bots = await new Promise((resolve) => {
        configDB.all(
          `SELECT bot_id, COALESCE(join_cmd, '!join') as join_cmd FROM music_bots WHERE guild_id = ?`,
          [guildId],
          (err, rows) => {
            if (err) {
              configDB.all(`SELECT bot_id FROM music_bots WHERE guild_id = ?`, [guildId],
                (err2, rows2) => resolve((rows2 || []).map(r => ({ ...r, join_cmd: '!join' }))));
            } else {
              resolve(rows || []);
            }
          }
        );
      });

      if (bots.length === 0) {
        return interaction.reply(quickEmbed(`${e.error} No music bots registered yet.`)).catch(() => {});
      }

      const freeBots = [], sameChannelBot = [];
      for (const row of bots) {
        const botMember = await interaction.guild.members.fetch(row.bot_id).catch(() => null);
        if (!botMember) continue;
        const inVC = botMember.voice?.channelId;
        if (!inVC)                     freeBots.push({ member: botMember, joinCmd: row.join_cmd || '!join' });
        else if (inVC === voiceChannel.id) sameChannelBot.push({ member: botMember, joinCmd: row.join_cmd || '!join' });
      }

      let selectedBot = null, selectedCmd = '!join';
      if (freeBots.length > 0) {
        const pick = freeBots[Math.floor(Math.random() * freeBots.length)];
        selectedBot = pick.member; selectedCmd = pick.joinCmd;
      } else if (sameChannelBot.length > 0) {
        selectedBot = sameChannelBot[0].member; selectedCmd = sameChannelBot[0].joinCmd;
      } else {
        return interaction.deferUpdate().catch(() => {});
      }

      await interaction.reply({
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        components: [new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`${e.success} Summoning <@${selectedBot.id}> to your voice channel!`)
        )],
      }).catch(() => {});

      const configRow = await new Promise(resolve =>
        configDB.get(`SELECT channel_id FROM music_config WHERE guild_id = ?`, [guildId],
          (err, row) => resolve(row)));
      const targetChannel = configRow
        ? interaction.guild.channels.cache.get(configRow.channel_id) || interaction.channel
        : interaction.channel;

      await targetChannel.send(`${selectedCmd} <#${voiceChannel.id}>`).catch(() => {});
      return;
    }
    if (customId.startsWith('voice_rank_')) {
      try {
        const userId   = interaction.user.id;
        const guildId  = interaction.guild.id;
        const userData = await VoiceTime.findOne({ guildId, userId }) || { totalSeconds: 0 };
        const rank     = await VoiceTime.countDocuments({
          guildId, totalSeconds: { $gt: userData.totalSeconds }
        }) + 1;

        const content = `### 📊 Your Voice Rank\n**Rank:** #${rank}\n**Time:** ${formatTime(userData.totalSeconds)}`;
        return interaction.reply({
          flags:      MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(content))],
        }).catch(() => {});
      } catch (err) {
        console.error('voice_rank button error:', err);
        return interaction.reply({ content: `${e.error} Failed to fetch your rank.`, ephemeral: true }).catch(() => {});
      }
    }
    if (customId !== 'task_accept' && customId !== 'task_deny') return;

    const taskSettings = await new Promise((resolve, reject) => {
      configDB.get(
        `SELECT taskers, managers FROM task_settings WHERE guild_id = ?`,
        [guild.id],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    }).catch(() => null);

    if (!taskSettings) {
      return safeReply(interaction, { content: 'Task settings not configured.', ephemeral: true });
    }

    const managersIds = (taskSettings.managers || '').split(',').filter(Boolean);
    const isAdmin     = member.permissions.has(PermissionsBitField.Flags.Administrator);
    const isManager   = managersIds.includes(member.id);

    if (!isAdmin && !isManager) {
      return safeReply(interaction, { content: 'You do not have permission to use this button.', ephemeral: true });
    }

    const embed = interaction.message.embeds[0];
    if (!embed) return safeReply(interaction, { content: 'Embed data missing.', ephemeral: true });

    const taskerField = embed.fields.find(f => f.name.toLowerCase() === 'tasker');
    if (!taskerField) return safeReply(interaction, { content: 'Cannot find Tasker field.', ephemeral: true });

    const mentionMatch = taskerField.value.match(/<@!?(\d+)>/);
    if (!mentionMatch) return safeReply(interaction, { content: 'Cannot parse Tasker ID.', ephemeral: true });

    const taskerId = mentionMatch[1];

    try {
      if (customId === 'task_accept') {
        await new Promise((resolve, reject) => {
          taskDB.run(
            `INSERT INTO task_counts (server_id, tasker_id, number_of_tasks)
             VALUES (?, ?, 1)
             ON CONFLICT(server_id, tasker_id) DO UPDATE SET number_of_tasks = number_of_tasks + 1`,
            [guild.id, taskerId],
            (err) => (err ? reject(err) : resolve())
          );
        });
        await safeReply(interaction, { content: `${e.success} Task accepted for <@${taskerId}>.`, ephemeral: true });
      } else {
        await safeReply(interaction, { content: `${e.error} Task denied.`, ephemeral: true });
      }
      await interaction.message.edit({ components: [] }).catch(() => {});
    } catch (error) {
      console.error('Error processing button:', error);
      await safeReply(interaction, { content: `${e.error} Error processing interaction.`, ephemeral: true });
    }
  },
};
