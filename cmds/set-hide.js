const {
  TextDisplayBuilder,
  ContainerBuilder,
  MessageFlags,
  PermissionsBitField,
} = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'set-hide',
  async execute(message, args, client, db) {
    const sendReply = (content) => {
      const text = new TextDisplayBuilder().setContent(content);
      return message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [new ContainerBuilder().addTextDisplayComponents(text)] });
    };

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return sendReply(`${e.error} You need **Administrator** permission.`);

    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
    if (!role)
      return sendReply(`${e.error} Please mention a role.\n-# Usage: \`.v set-hide @role\``);

    db.run(
      `UPDATE guild_config SET hide_role = ? WHERE guild_id = ?`,
      [role.id, message.guild.id],
      (err) => {
        if (err) return sendReply(`${e.error} Database error.`);
        return sendReply(`${e.success} Members with <@&${role.id}> can now use \`.v hide\` and \`.v unhide\`.`);
      }
    );
  },
};
