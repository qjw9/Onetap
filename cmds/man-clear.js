const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, TextDisplayBuilder, ContainerBuilder, MessageFlags } = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'man-clear',
  async execute(message, args, client, db) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_clear').setLabel('Yes, clear all').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cancel_clear').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    const text = new TextDisplayBuilder().setContent('⚠️ Are you sure you want to clear **all** your managers? This cannot be undone.');
    const msg = await message.channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [new ContainerBuilder().addTextDisplayComponents(text), row],
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: i => i.user.id === message.author.id,
      time: 15000, max: 1,
    });

    collector.on('collect', interaction => {
      if (interaction.customId === 'confirm_clear') {
        db.run('DELETE FROM user_managers WHERE owner_id = ?', [message.author.id], (dbErr) => {
          const t = new TextDisplayBuilder().setContent(dbErr
            ? `${e.error} Failed to clear managers.`
            : `${e.success} All your managers have been cleared.`);
          interaction.update({ components: [new ContainerBuilder().addTextDisplayComponents(t)] });
        });
      } else {
        const t = new TextDisplayBuilder().setContent('❎ Manager clear cancelled.');
        interaction.update({ components: [new ContainerBuilder().addTextDisplayComponents(t)] });
      }
    });

    collector.on('end', collected => {
      if (!collected.size) {
        const t = new TextDisplayBuilder().setContent('⌛ Timed out. Manager clear cancelled.');
        msg.edit({ components: [new ContainerBuilder().addTextDisplayComponents(t)] });
      }
    });
  },
};
