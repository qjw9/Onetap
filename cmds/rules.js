const {
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  MediaGalleryBuilder,
  PermissionsBitField,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');
const e = require('../emojis');

const BANNER_URL = 'https://timg.eu.cc/NQ-vfWjrle.png';

module.exports = {
  name: 'rules',
  async execute(message, args, client, db) {
    // Permission Check
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      const text = new TextDisplayBuilder()
        .setContent(`${e.error} You need **Administrator** permission to use this command.`);
      return message.channel.send({ flags: MessageFlags.IsComponentsV2, components: [new ContainerBuilder().addTextDisplayComponents(text)] });
    }
    if (args[0]?.toLowerCase() === 'set' && args[1]) {
      const newUrl = args[1].trim();
      if (!newUrl.startsWith('http')) {
        return message.channel.send({ content: `${e.error} Please provide a valid image URL.` });
      }
      db.run(`
        INSERT INTO guild_config (guild_id, rules_banner)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET rules_banner = excluded.rules_banner
      `, [message.guild.id, newUrl], (err) => {
        if (err) return message.channel.send({ content: `${e.error} Database error.` });
        message.channel.send({ content: `${e.success} Rules banner updated!` });
      });
      return;
    }
    const updateChannel = (type, column) => {
      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
      if (!channel) return message.channel.send({ content: `${e.error} Please mention a valid channel.\n-# Usage: \`.v rules ${type} #channel\`` });

      db.run(`
        INSERT INTO guild_config (guild_id, ${column})
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET ${column} = excluded.${column}
      `, [message.guild.id, channel.id], (err) => {
        if (err) {
          console.error(err);
          return message.channel.send({ content: `${e.error} Database error. (Did you add the columns?)` });
        }
        message.channel.send({ content: `${e.success} ${type.charAt(0).toUpperCase() + type.slice(1)} channel set to ${channel}!` });
      });
      return;
    };

    // Command routing
    if (args[0]?.toLowerCase() === 'help') return updateChannel('help', 'rules_help_channel');
    if (args[0]?.toLowerCase() === 'ticket') return updateChannel('ticket', 'rules_ticket_channel');
    if (args[0]?.toLowerCase() === 'voice') return updateChannel('voice', 'rules_voice_channel');
    const config = await new Promise((resolve) => {
      db.get(`SELECT rules_banner, rules_help_channel, rules_ticket_channel, rules_voice_channel FROM guild_config WHERE guild_id = ?`,
        [message.guild.id], (err, row) => resolve(row || {}));
    });

    const bannerUrl = config.rules_banner || BANNER_URL;
    const helpChannel = config.rules_help_channel || '1485404867357966528';
    const ticketChannel = config.rules_ticket_channel || helpChannel;
    const voiceChannel = config.rules_voice_channel || helpChannel;

    const rulesList = [
      `<a:star:1490836818986274888>⇝**__Follow the Discord TOS and The Discord Community Guidelines__**.`,
      `<a:star:1490836818986274888>⇝**__ Room dialek t9ed trejecte ayi hed kif ma kan__**.`,
      `<a:star:1490836818986274888>⇝**__ Room dialk public mno3 toxicité ila la knet locked ola smitha (name+18)__**`,
      `<a:star:1490836818986274888>⇝**__Room dialk locked (ur room ur rules)__**.`,
      `<a:star:1490836818986274888>⇝**__Room dialk mno3 tsamih 3la chi membre / staff / role / lounge__**.`,
      `<a:star:1490836818986274888>⇝**__Memno3 abuse dial move/mute. Ila disrespect report f <#${helpChannel}> awla ticket b clip__**.`,
      `<a:star:1490836818986274888>⇝**__Ayi wahed ma respectash rules → Warn 1 / Warn 2 / Jail 3 days / Ban__**.`,
      `<a:star:1490836818986274888>⇝**__The most important rule: Have fun__**`,
      `<a:star:1490836818986274888>⇝**__Memno3 tag spam ola mass ping. Khass tkoun 3andak reason__**.`,
      `<a:star:1490836818986274888>⇝**__No excessive voice changer__**.`,
      `<a:star:1490836818986274888>⇝**__Memno3 tsawro chi wahed f voice/stream bla idn__**.`,
      `<a:star:1490836818986274888>⇝**__Respect privacy: no leaking__**.`,
    ];

    const container = new ContainerBuilder();

    // Banner
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(item => item.setURL(bannerUrl))
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));

    // Header
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ・One Tap Rules – ${message.guild.name}`),
      new TextDisplayBuilder().setContent(` *__Special rules for One Tap room creation and management__*`)
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large));

    // Rules with Separators
    for (let i = 0; i < rulesList.length; i++) {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(rulesList[i]));
      if (i < rulesList.length - 1) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      }
    }

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

    // Buttons
    const buttonRow = new ActionRowBuilder();

    buttonRow.addComponents(
      new ButtonBuilder()
        .setLabel('Need Help')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${message.guild.id}/${voiceChannel}`)
        .setEmoji('<:NAME:1490841661738319944>')
    );

    buttonRow.addComponents(
      new ButtonBuilder()
        .setLabel('Ticket Support')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${message.guild.id}/${ticketChannel}`)
        .setEmoji('<:NAME:1490841661738319944>')
    );

    container.addActionRowComponents(buttonRow);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# © 2025 ${message.guild.name} • All rights reserved`));

    await message.channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    });
  },
};