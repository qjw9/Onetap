const { TextDisplayBuilder, ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'man-list',
  async execute(message, args, client, db) {
    db.all('SELECT manager_id FROM user_managers WHERE owner_id = ?',
      [message.author.id], async (dbErr, rows) => {
        if (dbErr) {
          const text = new TextDisplayBuilder().setContent(`${e.error} Database error.`);
          return message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [new ContainerBuilder().addTextDisplayComponents(text)] });
        }

        if (!rows.length) {
          const text = new TextDisplayBuilder().setContent(`ℹ️ You have no managers set yet.`);
          return message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [new ContainerBuilder().addTextDisplayComponents(text)] });
        }

        const list = rows.map(r => {
          const member = message.guild.members.cache.get(r.manager_id);
          return `<:point:1484325853625057400>  <@${r.manager_id}> ${member ? `— ${member.user.tag}` : ''}`;
        }).join('\n');

        const header = new TextDisplayBuilder().setContent(`# 🛡️ Your Managers`);
        const sep    = new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
        const body   = new TextDisplayBuilder().setContent(list);

        message.channel.send({
          flags: MessageFlags.IsComponentsV2,
          components: [new ContainerBuilder().addTextDisplayComponents(header).addSeparatorComponents(sep).addTextDisplayComponents(body)],
        });
      });
  },
};
