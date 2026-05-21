const {
  TextDisplayBuilder,
  ContainerBuilder,
  MessageFlags,
  PermissionsBitField,
} = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'remove-hide',
  async execute(message, args, client, db) {
    const sendReply = (content) => {
      const text = new TextDisplayBuilder().setContent(content);
      return message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [new ContainerBuilder().addTextDisplayComponents(text)] });
    };

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return sendReply(`${e.error} You need **Administrator** permission.`);

    db.run(
      `UPDATE guild_config SET hide_role = NULL WHERE guild_id = ?`,
      [message.guild.id],
      (err) => {
        if (err) return sendReply(`${e.error} Database error.`);
        return sendReply(`${e.success} Hide role permission removed. No role can use \`.v hide\` anymore.`);
      }
    );
  },
};
