const { TextDisplayBuilder, ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'wl-list',
  async execute(message, args, client, db) {
    db.all('SELECT whitelisted_id FROM whitelist_users WHERE owner_id = ? AND guild_id = ?',
      [message.author.id, message.guild.id], (dbErr, rows) => {
        if (dbErr || !rows.length) {
          const text = new TextDisplayBuilder().setContent('ℹ️ You have not whitelisted any users yet.');
          return message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [new ContainerBuilder().addTextDisplayComponents(text)] });
        }
        const list = rows.map(r => `<:point:1484325853625057400>  <@${r.whitelisted_id}>`).join('\n');
        const header = new TextDisplayBuilder().setContent(`# 📋 Your Whitelist`);
        const sep    = new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
        const body   = new TextDisplayBuilder().setContent(list);
        message.channel.send({
          flags: MessageFlags.IsComponentsV2,
          components: [new ContainerBuilder().addTextDisplayComponents(header).addSeparatorComponents(sep).addTextDisplayComponents(body)],
        });
      });
  },
};
