const { TextDisplayBuilder, ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'bl-list',
  async execute(message, args, client, db) {
    db.all('SELECT blacklisted_id FROM blacklist_users WHERE owner_id = ? AND guild_id = ?',
      [message.author.id, message.guild.id], (dbErr, rows) => {
        if (dbErr || !rows.length) {
          const text = new TextDisplayBuilder().setContent('ℹ️ You have not blacklisted any users yet.');
          return message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [new ContainerBuilder().addTextDisplayComponents(text)] });
        }
        const list = rows.map(r => `<:point:1484325853625057400>  <@${r.blacklisted_id}>`).join('\n');
        const header = new TextDisplayBuilder().setContent(`# 🚫 Your Blacklist`);
        const sep    = new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
        const body   = new TextDisplayBuilder().setContent(list);
        message.channel.send({
          flags: MessageFlags.IsComponentsV2,
          components: [new ContainerBuilder().addTextDisplayComponents(header).addSeparatorComponents(sep).addTextDisplayComponents(body)],
        });
      });
  },
};
