const { EmbedBuilder, Events, PermissionsBitField } = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client, db) {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'features_menu') return;
    if (!interaction.guild || !interaction.channel) return;

    const member = interaction.member;
    const channel = interaction.channel;
    const selected = interaction.values[0];

    const createEmbed = (desc) =>
      new EmbedBuilder().setDescription(desc).setColor('#f5eee2');

    async function isManagerOf(ownerId, managerId) {
      return new Promise((resolve) => {
        db.get(
          `SELECT 1 FROM user_managers WHERE owner_id = ? AND manager_id = ?`,
          [ownerId, managerId],
          (err, row) => {
            if (err) {
              console.error('DB Error (user_managers):', err);
              return resolve(false);
            }
            resolve(!!row);
          }
        );
      });
    }

    async function getOwnerId(channelId) {
      return new Promise((resolve) => {
        db.get(
          `SELECT owner_id FROM temp_channels WHERE channel_id = ?`,
          [channelId],
          (err, row) => {
            if (err) {
              console.error('DB Error (temp_channels):', err);
              return resolve(null);
            }
            resolve(row ? row.owner_id : null);
          }
        );
      });
    }

    async function isAuthorized(channelId, memberId) {
      const ownerId = await getOwnerId(channelId);
      if (!ownerId) return { authorized: false, ownerId: null };
      const isOwner = ownerId === memberId;
      const isManager = await isManagerOf(ownerId, memberId);
      return { authorized: isOwner || isManager, ownerId, isOwner };
    }

    const auth = await isAuthorized(channel.id, member.id);
    if (!auth.authorized) {
      return interaction.reply({
        ephemeral: true,
        embeds: [createEmbed(`${e.error} Only the voice channel owner or their managers can use this menu.`)],
      });
    }

    try {
      let response;

      switch (selected) {
        case 'soundboard_on':
          await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            [PermissionsBitField.Flags.UseSoundboard]: true,
          });
          response = `${e.sbOn} Soundboard enabled in this channel.`;
          break;

        case 'soundboard_off':
          await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            [PermissionsBitField.Flags.UseSoundboard]: false,
          });
          response = `${e.sbOff} Soundboard disabled in this channel.`;
          break;

        case 'camera_on':
          await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            [PermissionsBitField.Flags.Stream]: true,
          });
          response = `${e.camOn} Camera (stream) enabled in this channel.`;
          break;

        case 'camera_off':
          await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            [PermissionsBitField.Flags.Stream]: false,
          });
          response = `${e.camOff} Camera (stream) disabled in this channel.`;
          break;

        case 'activities_on':
          await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            [PermissionsBitField.Flags.UseExternalApps]: true,
          });
          response = `${e.actOn} Activities enabled in this channel.`;
          break;

        case 'activities_off':
          await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            [PermissionsBitField.Flags.UseExternalApps]: false,
          });
          response = `${e.actOff} Activities disabled in this channel.`;
          break;

        default:
          response = `${e.error} Unknown selection.`;
      }

      await interaction.reply({
        ephemeral: true,
        embeds: [createEmbed(response)],
      });

    } catch (err) {
      console.error(`${e.error} Feature menu error:`, err);
      await interaction.reply({
        ephemeral: true,
        embeds: [createEmbed(`${e.error} Something went wrong while applying the feature.`, 0xff0000)],
      });
    }
  }
};
