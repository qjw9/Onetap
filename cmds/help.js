const {
  MessageFlags,
  TextDisplayBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ThumbnailBuilder,
  SectionBuilder,
  ComponentType,
} = require('discord.js');

const BANNER = 'https://timg.eu.cc/7rimLaYZYd.png';

const EMOJIS = {
  previous: '<a:nextpre:1492125222260965528>  ',
  next: '<a:nextpre:1492125222260965528>  ',
  home: '<:home:1491836672428609798>  '
};

const helpData = {
  voice: {
    label: '◜__Voice Commands__◞',
    selectLabel: 'Voice Commands',
    commands: [
      { name: 'lock',           value: 'Lock your channel — only owner & managers can join.' },
      { name: 'unlock',         value: 'Unlock your channel for everyone.' },
      { name: 'permit',         value: 'Allow a specific user or role to join your channel.' },
      { name: 'deny',           value: 'Block a specific user or role from joining.' },
      { name: 'permall',        value: 'Allow multiple users to join at once.' },
      { name: 'rejectall',      value: 'Block multiple users from joining at once.' },
      { name: 'kick',           value: 'Remove a user from your channel.' },
      { name: 'limit',          value: 'Set a maximum user limit (0–99).' },
      { name: 'name',           value: 'Rename your voice channel.' },
      { name: 'claim',          value: 'Claim ownership if the owner has left.' },
      { name: 'transfer',       value: 'Transfer ownership to another user.' },
      { name: 'hide',           value: 'Hide your channel from regular members.' },
      { name: 'unhide',         value: 'Make your channel visible again.' },
      { name: 'cam-on',         value: 'Enable camera permission for everyone.' },
      { name: 'cam-off',        value: 'Disable camera permission for everyone.' },
      { name: 'sb-on',          value: 'Enable soundboard for everyone.' },
      { name: 'sb-off',         value: 'Disable soundboard for everyone.' },
      { name: 'activities-on',  value: 'Enable activities in your channel.' },
      { name: 'activities-off', value: 'Disable activities in your channel.' },
      { name: 'status',         value: 'Set a status message for your voice channel.' },
      { name: 'owner',          value: 'Show who owns the current voice channel.' },
      { name: 'info',           value: 'Show detailed info about your voice channel.' },
    ],
  },
  setup: {
    label: '◜__Setup Commands__◞',
    selectLabel: 'Setup Commands',
    commands: [
      { name: 'setup-room',          value: 'Set the trigger voice channel.' },
      { name: 'auto-setup',          value: 'Auto-create the full category and channels.' },
      { name: 'panel',               value: 'Manually send the voice control panel.' },
      { name: 'rules',               value: 'Send the One Tap rules panel.' },
      { name: 'rules set (url)',      value: 'Change rules banner image.' },
      { name: 'describe',            value: 'Send a bot announcement in the channel.' },
      { name: 'set-hide @role',      value: 'Set which role can use hide and unhide.' },
      { name: 'remove-hide',         value: 'Remove the hide role permission.' },
      { name: 'set-event-manager',   value: 'Set the event manager role.' },
      { name: 'set-event-category',  value: 'Set the category for event channels.' },
      { name: 'set-event-logs',      value: 'Set the channel for event logs.' },
      { name: 'music-send',          value: 'Send the music bot panel.' },
      { name: 'music-add <id>',      value: 'Register a music bot.' },
      { name: 'music-remove <id>',   value: 'Remove a registered music bot.' },
      { name: 'music-setchannel',    value: 'Set a private channel for music commands.' },
      { name: 'voicestats #channel', value: 'Set a channel that shows live voice user count.' },
      { name: 'announce <msg>',      value: 'DM all active voice room owners.' },
      { name: 'maintenance <msg>',   value: 'Send a maintenance notice to all servers (dev only).' },
    ],
  },
  manager: {
    label: '◜__Manager Commands__◞',
    selectLabel: 'Manager Commands',
    commands: [
      { name: 'man-add',    value: 'Add a trusted manager to your channel.' },
      { name: 'man-remove', value: 'Remove a manager from your list.' },
      { name: 'man-list',   value: 'View all your current managers.' },
      { name: 'man-clear',  value: 'Remove all managers at once.' },
    ],
  },
  whitelist: {
    label: '◜__Whitelist Commands__◞',
    selectLabel: 'Whitelist Commands',
    commands: [
      { name: 'wl-add',    value: 'Add a user to your whitelist.' },
      { name: 'wl-remove', value: 'Remove a user from your whitelist.' },
      { name: 'wl-list',   value: 'View all your whitelisted users.' },
    ],
  },
  blacklist: {
    label: '◜__Blacklist Commands__◞',
    selectLabel: 'Blacklist Commands',
    commands: [
      { name: 'bl-add',    value: 'Add a user to your blacklist.' },
      { name: 'bl-remove', value: 'Remove a user from your blacklist.' },
      { name: 'bl-list',   value: 'View all your blacklisted users.' },
    ],
  },
  stats: {
    label: '◜__Stats & Leaderboard__◞',
    selectLabel: 'Stats & Leaderboard',
    commands: [
      { name: 'top',      value: 'Top 10 voice members of all time.' },
      { name: 'topweek',  value: 'Top 10 voice members this week.' },
      { name: 'topmonth', value: 'Top 10 voice members this month.' },
      { name: 'uptime',   value: 'Show how long the bot has been online.' },
      { name: 'botinfo',  value: 'Show bot statistics and system information.' },
    ],
  },
  tasks: {
    label: '◜__Task Commands__◞',
    selectLabel: 'Task Commands',
    commands: [
      { name: 'taskconfig',    value: 'Show current task configuration.' },
      { name: 'set-tasklogs',  value: 'Set the channel where task logs are sent.' },
      { name: 'tasker-add',    value: 'Add a tasker role to the system.' },
      { name: 'tasker-remove', value: 'Remove a tasker role from the system.' },
      { name: 'tman-add',      value: 'Add a task manager role.' },
      { name: 'tman-remove',   value: 'Remove a task manager role.' },
      { name: 'task',          value: 'Send a task report with accept and deny buttons.' },
    ],
  },
};

function buildSelectMenu(disabled = false) {
  return new StringSelectMenuBuilder()
    .setCustomId('help-category-select')
    .setPlaceholder('Select a command category...')
    .setDisabled(disabled)
    .addOptions(
      Object.entries(helpData).map(([key, cat]) => ({
        label: cat.selectLabel,
        description: cat.description,
        value: key,
      }))
    );
}

function buildMainPayload(disabled = false) {
  const sep = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true);
  const banner = new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(BANNER));

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [
      {
        type: 17,
        components: [
          new TextDisplayBuilder().setContent('# __One Tap Help__').toJSON(),
          banner.toJSON(),
          sep.toJSON(),
          new TextDisplayBuilder().setContent(
            '> One Tap gives every member their own private temporary voice channel.\n\n' +
            '> Lock your room, manage who gets in, set limits, and toggle features.'
          ).toJSON(),
          sep.toJSON(),
          new ActionRowBuilder().addComponents(buildSelectMenu(disabled)).toJSON(),
        ],
      },
    ],
  };
}

function buildCategoryPayload(categoryKey, page = 0, disabled = false, guild = null) {
  const category = helpData[categoryKey];
  if (!category) return buildMainPayload(disabled);

  const sep = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true);
  const lightSep = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false);

  const totalPages = Math.ceil(category.commands.length / 5);
  const start = page * 5;
  const end = start + 5;
  const visibleCommands = category.commands.slice(start, end);

  const commandLines = visibleCommands
    .map(cmd => `<:point:1484325853625057400> \`.v ${cmd.name}\`\n\`⤿\` ${cmd.value}`)
    .join('\n');

  // Bot avatar URL
  let botAvatarURL = 'https://cdn.discordapp.com/embed/avatars/0.png';
  if (guild && guild.members && guild.members.me) {
    botAvatarURL = guild.members.me.displayAvatarURL({ extension: 'png', size: 128 });
  }

  // Section (type 9) = left text + right accessory (Thumbnail)
  // This is the ONLY proper way to get top-right image placement in Components V2
  const headerSection = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${category.label}\n> ${category.description}`)
    )
    .setThumbnailAccessory(
      new ThumbnailBuilder().setURL(botAvatarURL)
    );

  const innerComponents = [
    headerSection.toJSON(),
    sep.toJSON(),
    new TextDisplayBuilder().setContent(commandLines).toJSON(),
    sep.toJSON(),
  ];

  if (category.commands.length > 5) {
    innerComponents.push(
      new TextDisplayBuilder().setContent(`-# Page ${page + 1} of ${totalPages}`).toJSON()
    );
  }

  innerComponents.push(new ActionRowBuilder().addComponents(buildSelectMenu(disabled)).toJSON());

  // Pagination buttons
  const buttonRow = new ActionRowBuilder();

  const prevBtn = new ButtonBuilder()
    .setCustomId('prev_page')
    .setEmoji(EMOJIS.previous)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || page === 0);

  const homeBtn = new ButtonBuilder()
    .setCustomId('go_home')
    .setEmoji(EMOJIS.home)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(disabled);

  const nextBtn = new ButtonBuilder()
    .setCustomId('next_page')
    .setEmoji(EMOJIS.next)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || page >= totalPages - 1);

  if (category.commands.length > 5) {
    buttonRow.addComponents(prevBtn, homeBtn, nextBtn);
  } else {
    buttonRow.addComponents(homeBtn);
  }

  innerComponents.push(buttonRow.toJSON());

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [
      {
        type: 17,
        components: innerComponents,
      },
    ],
  };
}

module.exports = {
  name: 'help',
  async execute(message, args, client) {
    let currentCategory = null;
    let currentPage = 0;

    const sentMessage = await message.channel.send(buildMainPayload());

    const collector = sentMessage.createMessageComponentCollector({
      time: 300000,
      filter: i => i.user.id === message.author.id,
    });

    collector.on('collect', async interaction => {
      await interaction.deferUpdate();

      try {
        if (interaction.customId === 'help-category-select') {
          currentCategory = interaction.values[0];
          currentPage = 0;
          await interaction.editReply(buildCategoryPayload(currentCategory, currentPage, false, message.guild));
        }
        else if (interaction.customId === 'next_page') {
          currentPage++;
          await interaction.editReply(buildCategoryPayload(currentCategory, currentPage, false, message.guild));
        }
        else if (interaction.customId === 'prev_page') {
          currentPage--;
          await interaction.editReply(buildCategoryPayload(currentCategory, currentPage, false, message.guild));
        }
        else if (interaction.customId === 'go_home') {
          currentCategory = null;
          currentPage = 0;
          await interaction.editReply(buildMainPayload());
        }
      } catch (err) {
        console.error('[help collector error]', err.message);
      }
    });

    collector.on('end', async () => {
      try {
        if (!currentCategory) {
          await sentMessage.edit(buildMainPayload(true));
        } else {
          await sentMessage.edit(buildCategoryPayload(currentCategory, currentPage, true, message.guild));
        }
      } catch {}
    });
  },
};