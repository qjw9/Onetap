const {
  TextDisplayBuilder,
  ContainerBuilder,
  MessageFlags,
  PermissionsBitField,
} = require('discord.js');
const e = require('../emojis');

module.exports = {
  name: 'dmall',
  aliases: ['spamall'],
  async execute(message, args, client, db) {
    const sendReply = (content) => {
      const text = new TextDisplayBuilder().setContent(content);
      return message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [new ContainerBuilder().addTextDisplayComponents(text)] });
    };

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return sendReply(`${e.error} You need **Administrator** permission.`);

    const msg = args.join(' ').trim();
    if (!msg)
      return sendReply(`${e.error} Please provide a message.\n-# Usage: \`.v dmall <message>\``);

    const statusMsg = await message.channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`📨 Fetching members and sending DMs...`)
      )],
    });

    await message.guild.members.fetch();
    const members = [...message.guild.members.cache.filter(m => !m.user.bot).values()];

    let sent = 0;
    let failed = 0;
    let processed = 0;

    const BATCH_SIZE = 10;
    for (let i = 0; i < members.length; i += BATCH_SIZE) {
      const batch = members.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (member) => {
        try {
          // Plain text DM — Components V2 does NOT work in DMs
          await member.send(
            `📢 **Message from ${message.guild.name}**\n\n${msg}\n\n*Sent by ${message.author.tag}*`
          );
          sent++;
        } catch {
          failed++;
        }
        processed++;
      }));

      if (processed % 50 === 0) {
        await statusMsg.edit({
          flags: MessageFlags.IsComponentsV2,
          components: [new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `📨 Sending DMs... **${processed}/${members.length}**\n-# ✅ ${sent} sent • ❌ ${failed} failed`
            )
          )],
        }).catch(() => {});
      }

      await new Promise(r => setTimeout(r, 100));
    }

    await statusMsg.edit({
      flags: MessageFlags.IsComponentsV2,
      components: [new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${e.success} DM campaign complete!\n-# ✅ Sent: **${sent}** • ❌ Failed: **${failed}** (DMs closed or blocked)`
        )
      )],
    });
  },
};
