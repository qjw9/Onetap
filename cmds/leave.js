const {
  TextDisplayBuilder,
  ContainerBuilder,
  MessageFlags,
} = require('discord.js');
const e = require('../emojis');
const BOT_OWNER_ID = '1287172309785776278';

module.exports = {
  name: 'leave',
  async execute(message, args, client) {
    const sendReply = (content) => {
      const text = new TextDisplayBuilder().setContent(content);
      const container = new ContainerBuilder().addTextDisplayComponents(text);
      return message.channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [container],
      });
    };
    if (message.author.id !== BOT_OWNER_ID) {
      return sendReply(`${e.error} This command is restricted to the **bot owner** only.`);
    }
    const guildId = args[0];
    if (!guildId) {
      return sendReply(`${e.error} Please provide a server ID.\n-# Usage: \`.v leave <serverID>\``);
    }
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return sendReply(`${e.error} No server found with ID \`${guildId}\`.\n-# Make sure the bot is actually in that server.`);
    }

    const guildName = guild.name;
    try {
      await guild.leave();
      return sendReply(`${e.success} Successfully left **${guildName}** (\`${guildId}\`).`);
    } catch (err) {
      console.error('Failed to leave guild:', err);
      return sendReply(`${e.error} Failed to leave **${guildName}**. Check console for details.`);
    }
  },
};
