const {
  EmbedBuilder,
} = require('discord.js');
const axios = require('axios');
const e = require('../emojis');

module.exports = {
  name: 'voice',
  async execute(message, args, client, db) {
    
    // Token setup (Fixed to match your working .v ui command)
    const USER_TOKEN = process.env.USERTOKEN;
    if (!USER_TOKEN) return message.reply(`${e.error} USERTOKEN is missing in .env`);
    const headers = { 'Authorization': USER_TOKEN };

    // Get User ID
    let userId = args[0];
    if (!userId) return message.reply(`${e.error} Provide a user ID or mention.`);
    if (userId.startsWith('<@') && userId.endsWith('>')) {
      userId = userId.replace(/<@!?/g, '').replace(/>/g, '');
    }

    // Loading message as an Embed
    const loadingEmbed = new EmbedBuilder()
      .setDescription(`<a:generate:1487817221769265194>  Checking voice`)
      .setColor('#2b2d31');
      
    const loadingMsg = await message.reply({ embeds: [loadingEmbed] });

    try {
      // 1. Fetch mutual guilds via User Token
      const guildsRes = await axios.get(`https://discord.com/api/v10/users/@me/guilds`, { headers });
      const mutualGuilds = guildsRes.data;
      
      if (!mutualGuilds || mutualGuilds.length === 0) {
        return loadingMsg.edit({ embeds: [new EmbedBuilder().setColor('#2b2d31').setDescription(`${e.error} No mutual servers found.`)] });
      }

      let foundVoiceState = null;
      let foundGuildInfo = null;

      // 2. Search for the user's voice state in all mutual guilds
      for (const guild of mutualGuilds) {
        try {
          const vsRes = await axios.get(`https://discord.com/api/v10/guilds/${guild.id}/voice-states/${userId}`, { headers });
          if (vsRes.data && vsRes.data.channel_id) {
            foundVoiceState = vsRes.data;
            foundGuildInfo = guild;
            break; // Found them, stop searching
          }
        } catch (err) {
          // 404 means they aren't in a voice channel in THIS specific guild, ignore and continue
          if (err.response?.status !== 404) {
             console.error(`[Voice] Error checking guild ${guild.id}:`, err.message);
          }
        }
      }

      // 3. If not found in any voice channel
      if (!foundVoiceState) {
        const notFoundEmbed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setDescription(`${e.error} **<@${userId}> is not in a voice channel** in any mutual server.`);
        return loadingMsg.edit({ embeds: [notFoundEmbed] });
      }

      // 4. Fetch extra details (User info, Channel info, and other people in the room)
      const [userRes, channelRes, guildVoiceStatesRes] = await Promise.all([
        axios.get(`https://discord.com/api/v10/users/${userId}`, { headers }),
        axios.get(`https://discord.com/api/v10/channels/${foundVoiceState.channel_id}`, { headers }),
        axios.get(`https://discord.com/api/v10/guilds/${foundGuildInfo.id}/voice-states`, { headers })
      ]);

      const userData = userRes.data;
      const channelData = channelRes.data;
      
      // Find who else is in the same channel
      const membersInRoom = guildVoiceStatesRes.data
        .filter(vs => vs.channel_id === foundVoiceState.channel_id && vs.user_id !== userId)
        .map(vs => `<@${vs.user_id}>`);

      // Determine status icons (Using your exact custom emojis)
      const statusIcons = [];
      if (foundVoiceState.mute) statusIcons.push('<:muted:1491123720897429645>  Server Muted');
      if (foundVoiceState.deaf) statusIcons.push('<:deafen:1491123781899391196>  Server Deafened');
      if (foundVoiceState.self_mute) statusIcons.push('<:muted:1491123720897429645>  Self Muted');
      if (foundVoiceState.self_deaf) statusIcons.push('<:deafen:1491123781899391196>  Self Deafened');
      if (foundVoiceState.self_stream) statusIcons.push('<:streaming:1491124028381859850>  Streaming');
      if (statusIcons.length === 0) statusIcons.push('<:mikee:1491124454598639656>  Talking/Active');

      // URLs
      const avatarUrl = userData.avatar 
        ? `https://cdn.discordapp.com/avatars/${userId}/${userData.avatar}.png?size=256` 
        : 'https://discord.com/assets/1f0bfc0865d324c2587920a7d80c609b.png';
      const serverIconUrl = foundGuildInfo.icon 
        ? `https://cdn.discordapp.com/icons/${foundGuildInfo.id}/${foundGuildInfo.icon}.png?size=128` 
        : null;

      // 5. Build Beautiful Embed v2
      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setAuthor({ 
          name: `${userData.global_name || userData.username} is in a Voice Channel`, 
          iconURL: avatarUrl 
        })
        .setThumbnail(avatarUrl)
        .addFields(
          { 
            name: '<a:voice:1483668492397052135>  Voice Channel', 
            value: `### ${channelData.name}\n${statusIcons.join(' | ')}`, 
            inline: false 
          },
          { 
            name: '<:channel:1491124700003438765>  Server', 
            value: `**${foundGuildInfo.name}**`, 
            inline: true 
          },
          { 
            name: '<:users:1491124833508131017>  Members in Room', 
            value: membersInRoom.length > 0 ? membersInRoom.slice(0, 10).join(', ') + (membersInRoom.length > 10 ? ` +${membersInRoom.length - 10} more` : '') : 'Alone', 
            inline: true 
          }
        )
        .setFooter({ text: `User ID: ${userId} • Guild ID: ${foundGuildInfo.id}` })
        .setTimestamp();

      // Add server icon as the big image on the right if it exists
      if (serverIconUrl) {
        embed.setImage(serverIconUrl);
      }

      await loadingMsg.edit({ content: null, embeds: [embed] });

    } catch (err) {
      console.error('[Voice Error]', err?.response?.data || err.message);
      const errorEmbed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setDescription(`${e.error} Failed to fetch voice state. Check token/console.`);
      await loadingMsg.edit({ embeds: [errorEmbed] });
    }
  },
};