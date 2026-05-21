const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionsBitField,
  ButtonBuilder,
  ButtonStyle,
  MediaGalleryBuilder,
} = require('discord.js');
const e = require('../emojis');

const POINT = '<:point:1484325853625057400>';

async function styledReply(interaction, { title, emoji, msg, ephemeral = true }) {
  const header = new TextDisplayBuilder().setContent(`# ${emoji} ${title}`);
  const sep    = new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
  const body   = new TextDisplayBuilder().setContent(`${POINT}  ____${msg}____ ⁘`);
  const container = new ContainerBuilder()
    .addTextDisplayComponents(header)
    .addSeparatorComponents(sep)
    .addTextDisplayComponents(body);
  const flags = ephemeral
    ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    : MessageFlags.IsComponentsV2;
  try {
    if (interaction.replied || interaction.deferred) return await interaction.editReply({ flags, components: [container] });
    return await interaction.reply({ flags, components: [container] });
  } catch (_) {}
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client, db) {
    if (!interaction.guild) return;
    const { member, guild } = interaction;

    async function getOwnerId(channelId) {
      return new Promise(resolve =>
        db.get('SELECT owner_id FROM temp_channels WHERE channel_id = ?',
          [channelId], (err, row) => resolve(row?.owner_id || null)));
    }

    async function isManagerOf(ownerId, managerId) {
      return new Promise(resolve =>
        db.get('SELECT 1 FROM user_managers WHERE owner_id = ? AND manager_id = ?',
          [ownerId, managerId], (err, row) => resolve(!!row)));
    }

    async function isAuthorized(channelId, memberId) {
      const ownerId = await getOwnerId(channelId);
      if (!ownerId) return { authorized: false, ownerId: null };
      const isOwner   = ownerId === memberId;
      const isManager = await isManagerOf(ownerId, memberId);
      return { authorized: isOwner || isManager, ownerId, isOwner };
    }

    async function lockChannel(interaction) {
      const vc = interaction.member.voice.channel;
      if (!vc) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'You must be in a voice channel.' });
      const { authorized, ownerId } = await isAuthorized(vc.id, member.id);
      if (!authorized) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'You are not authorized to lock this channel.' });
      try {
        await vc.permissionOverwrites.edit(guild.roles.everyone, { Connect: false, Speak: true });
        if (ownerId) { const o = await guild.members.fetch(ownerId).catch(() => null); if (o) await vc.permissionOverwrites.edit(o, { Connect: true, Speak: true }); }
        return styledReply(interaction, { title: 'Success', emoji: e.lock, msg: 'Channel has been locked' });
      } catch { return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'Failed to lock the channel.' }); }
    }

    async function unlockChannel(interaction) {
      const vc = interaction.member.voice.channel;
      if (!vc) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'You must be in a voice channel.' });
      const { authorized } = await isAuthorized(vc.id, member.id);
      if (!authorized) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'You are not authorized to unlock this channel.' });
      try {
        await vc.permissionOverwrites.edit(guild.roles.everyone, { Connect: true, Speak: true });
        return styledReply(interaction, { title: 'Success', emoji: e.unlock, msg: 'Channel has been unlocked' });
      } catch { return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'Failed to unlock the channel.' }); }
    }

    async function claimChannel(interaction) {
      const vc = interaction.member.voice.channel;
      if (!vc) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'You must be in a voice channel to claim it.' });
      db.get('SELECT owner_id FROM temp_channels WHERE channel_id = ?', [vc.id], async (dbErr, row) => {
        if (!row) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'This is not a managed temp channel.' });
        if (row.owner_id === member.id) return styledReply(interaction, { title: 'Info', emoji: e.crown, msg: 'You are already the owner of this channel.' });
        const ownerMember = guild.members.cache.get(row.owner_id);
        if (ownerMember?.voice?.channelId === vc.id) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: `The current owner <@${row.owner_id}> is still connected.` });
        db.run('UPDATE temp_channels SET owner_id = ? WHERE channel_id = ?', [member.id, vc.id], (err) => {
          if (err) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'Failed to claim ownership.' });
          styledReply(interaction, { title: 'Success', emoji: e.crown, msg: `You have claimed ownership of **${vc.name}**` });
        });
      });
    }

    async function clearPanelMessages(interaction) {
      const vc = interaction.member.voice.channel;
      if (!vc) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'You must be in a voice channel.' });
      const { authorized } = await isAuthorized(vc.id, member.id);
      if (!authorized) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'You are not authorized to use trash.' });
      try {
        await interaction.deferReply({ ephemeral: true });
        const fetched = await interaction.channel.messages.fetch({ limit: 100 });
        const sorted  = [...fetched.sort((a, b) => a.createdTimestamp - b.createdTimestamp).values()];
        const [, ...rest] = sorted;
        await Promise.all(rest.map(msg => msg.delete().catch(() => null)));
        return styledReply(interaction, { title: 'Success', emoji: e.trash, msg: 'Messages have been cleared' });
      } catch { return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'Failed to clear messages.' }); }
    }

    async function openModal(interaction) {
      const vc = interaction.member.voice.channel;
      if (!vc) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'You must be in a voice channel.' });
      const { authorized } = await isAuthorized(vc.id, member.id);
      if (!authorized) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'You are not authorized.' });
      const modal = new ModalBuilder().setCustomId(`${interaction.customId}_modal`);
      if (interaction.customId === 'permit' || interaction.customId === 'deny') {
        modal.setTitle(interaction.customId === 'permit' ? 'Permit a User' : 'Deny a User');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('target_user').setLabel('User ID or mention').setStyle(TextInputStyle.Short).setRequired(true)));
      } else if (interaction.customId === 'setVoiceLimit') {
        modal.setTitle('Set Voice Channel User Limit');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('voice_limit').setLabel('User limit (0–99)').setStyle(TextInputStyle.Short).setRequired(true)));
      } else if (interaction.customId === 'name') {
        modal.setTitle('Rename Voice Channel');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('voice_name').setLabel('New channel name').setStyle(TextInputStyle.Short).setRequired(true)));
      }
      return interaction.showModal(modal);
    }

    async function handleModalSubmit(interaction) {
      const vc = interaction.member.voice.channel;
      if (!vc) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'You must be in a voice channel.' });
      const { authorized, ownerId, isOwner } = await isAuthorized(vc.id, member.id);
      if (!authorized) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'You are not authorized.' });
      if (interaction.customId === 'permit_modal' || interaction.customId === 'deny_modal') {
        const raw = interaction.fields.getTextInputValue('target_user').trim();
        const targetId = raw.replace(/[<@!>]/g, '');
        if (!/^\d{17,19}$/.test(targetId)) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'Please enter a valid user ID or mention.' });
        const targetMember = guild.members.cache.get(targetId);
        if (!targetMember) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'User not found in this server.' });
        if (interaction.customId === 'permit_modal') {
          try { await vc.permissionOverwrites.edit(targetMember, { Connect: true, Speak: true, ViewChannel: true }); return styledReply(interaction, { title: 'Success', emoji: e.permitUser, msg: `<@${targetId}> has been permitted to join` }); }
          catch { return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'Failed to permit this user.' }); }
        }
        if (interaction.customId === 'deny_modal') {
          if (targetId === ownerId && !isOwner) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'Managers cannot deny the owner.' });
          try { await vc.permissionOverwrites.edit(targetMember, { Connect: false, Speak: false, ViewChannel: false }); return styledReply(interaction, { title: 'Success', emoji: e.denyUser, msg: `<@${targetId}> has been denied access` }); }
          catch { return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'Failed to deny this user.' }); }
        }
      }
      if (interaction.customId === 'setVoiceLimit_modal') {
        const limit = parseInt(interaction.fields.getTextInputValue('voice_limit').trim(), 10);
        if (isNaN(limit) || limit < 0 || limit > 99) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'Please enter a number between 0 and 99.' });
        try { await vc.setUserLimit(limit); const msg = limit === 0 ? 'User limit removed' : `User limit set to **${limit}**`; return styledReply(interaction, { title: 'Success', emoji: e.limit, msg }); }
        catch { return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'Failed to set user limit.' }); }
      }
      if (interaction.customId === 'name_modal') {
        const newName = interaction.fields.getTextInputValue('voice_name').trim();
        if (!newName || newName.length > 100) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'Invalid channel name (1–100 characters).' });
        try { await vc.setName(newName); return styledReply(interaction, { title: 'Success', emoji: e.rename, msg: `Channel renamed to **${newName}**` }); }
        catch { return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'Failed to rename the channel.' }); }
      }
    }

    async function handleFeatureToggle(interaction, flag, enable, featureName, emoji) {
      const vc = interaction.member.voice.channel;
      if (!vc) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'You must be in a voice channel.' });
      const { authorized } = await isAuthorized(vc.id, member.id);
      if (!authorized) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'You are not authorized.' });
      try {
        await vc.permissionOverwrites.edit(guild.roles.everyone, { [flag]: enable });
        const state = enable ? 'enabled' : 'disabled';
        return styledReply(interaction, { title: 'Success', emoji, msg: `**${featureName}** has been ${state} for everyone` });
      } catch { return styledReply(interaction, { title: 'Error', emoji: e.error, msg: `Failed to toggle ${featureName}.` }); }
    }

    async function handleInfoButton(interaction) {
      const vc = interaction.member.voice.channel;
      if (!vc) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'You must be in a voice channel.' });

      db.get('SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?',
        [vc.id, guild.id], async (err, row) => {
          let ownerMention = 'Not managed by bot';
          if (row) {
            try {
              const ownerMember = await guild.members.fetch(row.owner_id);
              ownerMention = ownerMember.toString();
            } catch { ownerMention = `<@${row.owner_id}>`; }
          }

          const { PermissionsBitField: PB, OverwriteType: OT } = require('discord.js');
          const connectedMembers = vc.members.map(m => m.toString());
          const deniedMembers = [];
          for (const [id, overwrite] of vc.permissionOverwrites.cache) {
            if (overwrite.type === OT.Member && overwrite.deny.has(PB.Flags.Connect)) {
              try { const dm = await guild.members.fetch(id); deniedMembers.push(dm.toString()); }
              catch { deniedMembers.push(`<@${id}>`); }
            }
          }

          const content = [
            `### ${e.info} Info: **${vc.name}**`,
            `${e.crown} **Owner:** ${ownerMention}`,
            `📎 **Channel ID:** \`${vc.id}\``,
            ``,
            `${e.permitUser} **Members in voice:**`,
            connectedMembers.length > 0 ? connectedMembers.join('\n') : '*None*',
            ``,
            `${e.denyUser} **Denied Members:**`,
            deniedMembers.length > 0 ? deniedMembers.join('\n') : '*None*',
          ].join('\n');

          const text = new TextDisplayBuilder().setContent(content);
          const container = new ContainerBuilder().addTextDisplayComponents(text);
          return interaction.reply({
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            components: [container],
          }).catch(() => {});
        });
    }

    async function handleTransferButton(interaction) {
      const vc = interaction.member.voice.channel;
      if (!vc) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'You must be in a voice channel.' });

      const { authorized, ownerId, isOwner } = await isAuthorized(vc.id, member.id);
      if (!authorized || !isOwner) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'Only the channel owner can transfer ownership.' });

      // Ask for a user ID via modal
      const { ModalBuilder: MB, TextInputBuilder: TIB, TextInputStyle: TIS, ActionRowBuilder: ARB } = require('discord.js');
      const modal = new MB().setCustomId('transfer_modal').setTitle('Transfer Ownership');
      modal.addComponents(new ARB().addComponents(new TIB().setCustomId('transfer_target').setLabel('User ID or @mention').setStyle(TIS.Short).setRequired(true)));
      return interaction.showModal(modal).catch(() => {});
    }

    if (interaction.isCommand()) {
      switch (interaction.commandName) {
        case 'lock': return lockChannel(interaction);
        case 'unlock': return unlockChannel(interaction);
        case 'claim': return claimChannel(interaction);
        case 'permit':
        case 'deny':
        case 'setVoiceLimit':
        case 'name': return openModal(interaction);
      }
    }

    else if (interaction.isButton()) {
      const { customId } = interaction;
      const voiceButtons = ['lock','unlock','claim','permit','deny','setVoiceLimit','name','trash','transfer','info'];
      if (voiceButtons.includes(customId)) {
        switch (customId) {
          case 'lock': return lockChannel(interaction);
          case 'unlock': return unlockChannel(interaction);
          case 'claim': return claimChannel(interaction);
          case 'trash': return clearPanelMessages(interaction);
          case 'permit':
          case 'deny':
          case 'setVoiceLimit':
          case 'name': return openModal(interaction);
          case 'transfer': return handleTransferButton(interaction);
          case 'info': return handleInfoButton(interaction);
        }
      }

      if (customId.startsWith('apply_accept_') || customId.startsWith('apply_deny_')) {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
        const isAccept = customId.startsWith('apply_accept_');
        const parts = customId.split('_');
        const targetUserId = parts[2];
        const posValue = parts.slice(3).join('_');
        const applyCmd = client.commands?.get('apply');
        const pos = applyCmd?.POSITIONS?.find(p => p.value === posValue);
        const posLabel = pos?.label || posValue.replace(/_/g, ' ');
        const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
        if (isAccept && targetMember) {
          const guildIcon = guild.iconURL({ size: 128 });
          const dmContainer = new ContainerBuilder();
          if (guildIcon) dmContainer.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(i => i.setURL(guildIcon)));
          dmContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🎉 Congratulations!\n-# Your application has been accepted`));
          dmContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large));
          dmContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${guild.name}** welcomes you to the team!\nYou have been accepted as **${posLabel}**.\n\n-# Please wait for further instructions.`));
          await targetMember.send({ flags: MessageFlags.IsComponentsV2, components: [dmContainer] }).catch(() => {});
        }
        const reviewedContainer = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`${isAccept ? '✅' : '❌'} Application **${isAccept ? 'Accepted' : 'Denied'}**\n-# <@${targetUserId}> for **${posLabel}** • Reviewed by ${interaction.user.tag}`));
        return interaction.update({ flags: MessageFlags.IsComponentsV2, components: [reviewedContainer] });
      }
    }

    else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'apply_position') {
        const positionValue = interaction.values[0];
        const applyCmd = client.commands?.get('apply');
        const pos = applyCmd?.POSITIONS?.find(p => p.value === positionValue);
        const posLabel = pos?.label || positionValue.replace(/_/g, ' ');
        const modal = new ModalBuilder().setCustomId(`apply_modal_${positionValue}`).setTitle(`Apply for ${posLabel}`);
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('apply_fullname').setLabel('Full Name').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('apply_age').setLabel('Age').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('apply_experience').setLabel('Staff Team Experience').setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('apply_why').setLabel('Why Staff Team?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('apply_hours').setLabel('Available Hours (e.g. 5-8 hours/day)').setStyle(TextInputStyle.Short).setRequired(true))
        );
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'features_menu') {
        const value = interaction.values[0];
        const { PermissionFlagsBits } = require('discord.js');
        const map = {
          soundboard_on:  [PermissionFlagsBits.UseSoundboard, true,  'Soundboard', e.sbOn],
          soundboard_off: [PermissionFlagsBits.UseSoundboard, false, 'Soundboard', e.sbOff],
          camera_on:      [PermissionFlagsBits.Stream, true,  'Camera', e.camOn],
          camera_off:     [PermissionFlagsBits.Stream, false, 'Camera', e.camOff],
          activities_on:  [PermissionFlagsBits.UseEmbeddedActivities, true, 'Activities', e.actOn],
          activities_off: [PermissionFlagsBits.UseEmbeddedActivities, false,'Activities', e.actOff],
        };
        const entry = map[value];
        if (entry) return handleFeatureToggle(interaction, entry[0], entry[1], entry[2], entry[3]);
        return interaction.deferUpdate().catch(() => {});
      }
    }

    else if (interaction.isModalSubmit()) {
      if (['permit_modal','deny_modal','setVoiceLimit_modal','name_modal'].includes(interaction.customId)) return handleModalSubmit(interaction);

      if (interaction.customId === 'transfer_modal') {
        const vc = interaction.member.voice.channel;
        if (!vc) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'You must be in a voice channel.' });
        const raw = interaction.fields.getTextInputValue('transfer_target').trim();
        const targetId = raw.replace(/[<@!>]/g, '');
        if (!/^\d{17,19}$/.test(targetId)) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'Please enter a valid user ID or mention.' });
        const targetMember = guild.members.cache.get(targetId);
        if (!targetMember) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'User not found in this server.' });
        if (!targetMember.voice?.channel || targetMember.voice.channel.id !== vc.id)
          return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'That user must be in the same voice channel as you.' });
        db.run('UPDATE temp_channels SET owner_id = ? WHERE channel_id = ? AND guild_id = ?',
          [targetId, vc.id, guild.id], (err) => {
            if (err) return styledReply(interaction, { title: 'Error', emoji: e.error, msg: 'Database error during transfer.' });
            return styledReply(interaction, { title: 'Success', emoji: e.crown, msg: `Ownership transferred to <@${targetId}>` });
          });
        return;
      }

      if (interaction.customId.startsWith('apply_modal_')) {
        const posValue = interaction.customId.replace('apply_modal_', '');
        const applyCmd = client.commands?.get('apply');
        const pos = applyCmd?.POSITIONS?.find(p => p.value === posValue);
        const posLabel = pos?.label || posValue.replace(/_/g, ' ');
        const fullname = interaction.fields.getTextInputValue('apply_fullname');
        const age = interaction.fields.getTextInputValue('apply_age');
        const exp = interaction.fields.getTextInputValue('apply_experience');
        const why = interaction.fields.getTextInputValue('apply_why');
        const hours = interaction.fields.getTextInputValue('apply_hours');

        const buildApp = () => {
          const c = new ContainerBuilder();
          c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 📋 Staff Application — ${posLabel}\n-# <@${interaction.user.id}> • <t:${Math.floor(Date.now()/1000)}:R>`));
          c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large));
          c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Position:** ${posLabel}\n**Full Name:** ${fullname}\n**Age:** ${age}`));
          c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
          c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Experience:**\n${exp}`));
          c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
          c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Why join:**\n${why}\n\n**Available Hours:** ${hours}`));
          c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
          c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# User ID: \`${interaction.user.id}\` • ${guild.name}`));
          return c;
        };

        const acceptRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`apply_accept_${interaction.user.id}_${posValue}`).setLabel('✅ Accept').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`apply_deny_${interaction.user.id}_${posValue}`).setLabel('❌ Deny').setStyle(ButtonStyle.Danger)
        );

        const configDB = require('../index').configDB;
        const guildConfig = await new Promise(resolve => configDB.get('SELECT apply_logs_channel FROM guild_config WHERE guild_id = ?', [guild.id], (err, row) => resolve(row))).catch(() => null);
        const logsChannel = guildConfig?.apply_logs_channel ? guild.channels.cache.get(guildConfig.apply_logs_channel) : null;
        if (logsChannel) await logsChannel.send({ flags: MessageFlags.IsComponentsV2, components: [buildApp(), acceptRow] });

        return interaction.reply({
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`✅ **Application submitted!**\n-# Your application for **${posLabel}** has been received.\n-# We'll review it and get back to you soon!`))],
        });
      }
    }
  },
};