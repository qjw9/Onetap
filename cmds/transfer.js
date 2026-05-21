const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { TextDisplayBuilder, ContainerBuilder, MessageFlags } = require('discord.js');
const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'transfer',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.crown.trim(), msg });

    const userId = message.author.id;
    const guild  = message.guild;
    const vc     = guild.members.cache.get(userId)?.voice?.channel;

    if (!vc) return err('You must be connected to a voice channel.');

    db.get('SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?',
      [vc.id, guild.id], async (dbErr, row) => {
        if (dbErr || !row) return err('This channel is not managed by the bot.');
        if (row.owner_id !== userId) return err('You are not the owner of this channel.');
        if (!args[0]) return err('Please mention the user to transfer ownership to.');

        const target = message.mentions.members.first() || guild.members.cache.get(args[0]);
        if (!target) return err('User not found in this server.');
        if (!target.voice.channel || target.voice.channel.id !== vc.id)
          return err('The user must be in the same voice channel as you.');

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('confirm_transfer').setLabel('Yes').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('cancel_transfer').setLabel('No').setStyle(ButtonStyle.Secondary)
        );

        const text = new TextDisplayBuilder().setContent(`⚠️ Transfer ownership to **${target.user.tag}**?`);
        const confirmMsg = await message.channel.send({
          flags: MessageFlags.IsComponentsV2,
          components: [new ContainerBuilder().addTextDisplayComponents(text), confirmRow],
        });

        const collector = confirmMsg.createMessageComponentCollector({
          componentType: ComponentType.Button, time: 15_000, max: 1,
        });

        collector.on('collect', interaction => {
          if (interaction.user.id !== userId)
            return interaction.reply({ content: `${e.error} Only the command author can confirm.`, ephemeral: true });

          if (interaction.customId === 'confirm_transfer') {
            db.run('UPDATE temp_channels SET owner_id = ? WHERE channel_id = ? AND guild_id = ?',
              [target.id, vc.id, guild.id], (updateErr) => {
                if (updateErr) {
                  const t = new TextDisplayBuilder().setContent(`${e.error} Database error during transfer.`);
                  return interaction.update({ components: [new ContainerBuilder().addTextDisplayComponents(t)] });
                }
                const t = new TextDisplayBuilder().setContent(`${e.success} Ownership transferred to **${target.user.tag}**.`);
                interaction.update({ components: [new ContainerBuilder().addTextDisplayComponents(t)] });
              });
          } else {
            const t = new TextDisplayBuilder().setContent('❎ Transfer cancelled.');
            interaction.update({ components: [new ContainerBuilder().addTextDisplayComponents(t)] });
          }
        });

        collector.on('end', collected => {
          if (!collected.size) {
            const t = new TextDisplayBuilder().setContent('⏰ No response. Transfer cancelled.');
            confirmMsg.edit({ components: [new ContainerBuilder().addTextDisplayComponents(t)] });
          }
        });
      });
  },
};
