const {
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');
const e = require('../emojis');
// The bot will ONLY respond in these servers.
const ALLOWED_GUILD_IDS = [
  '1490825936210231526', // Your Main Server ID
];

// Helper to format duration nicely (e.g., "3 hours" or "1 hour")
function formatDuration(seconds) {
  if (!seconds || seconds < 60) return `${seconds || 0} seconds`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  
  // Handle pluralization logic
  const hStr = h === 1 ? "hour" : "hours";
  const mStr = m === 1 ? "minute" : "minutes";

  if (h > 0) return `${h} ${hStr}`;
  return `${m} ${mStr}`;
}

// Helper to generate the panel (so we can reuse it for the button)
async function generateLeaderboardPanel(guild, configDB) {
  // 1. Get all active temp channels from the database
  const tempChannelsRows = await new Promise((resolve) => {
    configDB.all(`SELECT channel_id, owner_id FROM temp_channels WHERE guild_id = ?`, [guild.id], (err, rows) => {
      resolve(rows || []);
    });
  });

  // 2. Filter and calculate "Age" (Time since creation)
  const activeChannels = [];

  for (const row of tempChannelsRows) {
    const channel = guild.channels.cache.get(row.channel_id);
    if (channel) {
      // Discord timestamps are in milliseconds
      const ageSeconds = Math.floor((Date.now() - channel.createdTimestamp) / 1000);
      
      // Try to find owner's display name
      const owner = await guild.members.fetch(row.owner_id).catch(() => null);
      
      activeChannels.push({
        name: channel.name,
        ownerTag: owner ? owner.user.username : 'Unknown',
        ownerId: row.owner_id,
        age: ageSeconds
      });
    }
  }

  // 3. Sort by Age (Longest duration at top)
  activeChannels.sort((a, b) => b.age - a.age);

  // 4. Build the Container
  const container = new ContainerBuilder();

  // Trophy Image (Top Right visual)
  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(item => item.setURL('https://timg.eu.cc/zeMvw5yI4Q.gif'))
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
  );

  // Header
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `# <a:lb:1490866363722371442>  Top Duration\n` +
      `> Tracking live persistence of voice channels.`
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large)
  );

  // Top 3 Logic (Matches your image layout)
  const medals = ['<a:MEDALGOLD:1490866463404462263> ', '<a:medalsilver:1490866556555755721> ', '<a:bronze:1490866618132332878> '];

  // If no channels are active
  if (activeChannels.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`> *No active temporary channels right now.*`)
    );
  } else {
    // Loop through top channels
    for (let i = 0; i < Math.min(activeChannels.length, 3); i++) {
      const data = activeChannels[i];
      const medal = medals[i];
      const formattedAge = formatDuration(data.age);

      // The layout matches your photo: Name > Owner > Age
      const content = 
        `${medal} **${data.name}**\n` +
        `> <a:crown:1490866848890359881>  Owner: **${data.ownerTag}**\n` +
        `> <:time:1490867007921459200>  Age: **${formattedAge}**`;

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(content)
      );

      // Add separator between ranks
      if (i < Math.min(activeChannels.length, 3) - 1) {
        container.addSeparatorComponents(
          new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        );
      }
    }
  }

  // Footer with timestamp
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );
  
  const now = new Date();
  const timestampStr = now.toLocaleString(); // e.g., "4/7/2026, 12:04:57 AM"
  
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# Last updated: ${timestampStr}`)
  );

  // Refresh Button
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`refresh_duration_${guild.id}`)
        .setLabel('Refresh')
        .setEmoji('<a:refreshe:1490867109196992592> ')
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return container;
}

module.exports = {
  name: 'topduration',
  async execute(message, args, client, configDB) {
    
    // Whitelist Check
    if (!ALLOWED_GUILD_IDS.includes(message.guild.id)) return;

    // Generate and send the panel
    const container = await generateLeaderboardPanel(message.guild, configDB);
    
    const sentMessage = await message.channel.send({ 
      flags: MessageFlags.IsComponentsV2, 
      components: [container] 
    });

    // Button Interaction Collector (for auto-update)
    const filter = i => i.customId === `refresh_duration_${message.guild.id}`;
    const collector = sentMessage.createMessageComponentCollector({ filter, time: 300_000 });

    collector.on('collect', async i => {
      await i.deferUpdate();
      
      // Re-generate the panel with new time data
      const newContainer = await generateLeaderboardPanel(message.guild, configDB);
      
      await i.editReply({ 
        flags: MessageFlags.IsComponentsV2, 
        components: [newContainer] 
      });
    });
  },
};