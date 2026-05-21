"use strict";

const {
  ChannelType,
  TextDisplayBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  OverwriteType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MediaGalleryBuilder,
} = require("discord.js");

const e = require("../emojis");
const axios = require("axios");
const VoiceTime = require("../models/VoiceTime");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { updateLeaderboard } = require("../utils/leaderboard");
const { sendLog } = require("../utils/logger");


const voiceDb = new sqlite3.Database(
  path.resolve(__dirname, "../voice_time.db"),
  (err) => {
    if (err) console.error("Failed to open voice_time.db:", err.message);
  },
);

const voiceSessions = new Map();
const cooldown = new Set();
const antiAbuseRequests = new Map();
const antiAbuseApproved = new Set();


function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function saveVoiceTime(userId, guildId, seconds) {
  if (seconds < 10) return;
  try {
    const today = getTodayStr();
    const doc = await VoiceTime.findOne({ guildId, userId }).lean();

    let streakDays = doc?.streakDays || 0;
    let bestStreak = doc?.bestStreak || 0;
    const lastActive = doc?.lastActiveDay || null;

    if (lastActive) {
      const diff = Math.round(
        (new Date(today) - new Date(lastActive)) / 86_400_000,
      );
      if (diff === 1) {
        streakDays++;
        if (streakDays > bestStreak) bestStreak = streakDays;
      } else if (diff > 1) streakDays = 1;
    } else {
      streakDays = 1;
      bestStreak = Math.max(1, bestStreak);
    }

    const now = new Date();
    const weekKey = `${now.getFullYear()}-W${Math.ceil(now.getDate() / 7)}`;
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

    await VoiceTime.findOneAndUpdate(
      { guildId, userId },
      {
        $inc: { totalSeconds: seconds },
        $set: {
          weekSeconds:
            doc?.weekReset === weekKey
              ? (doc.weekSeconds || 0) + seconds
              : seconds,
          monthSeconds:
            doc?.monthReset === monthKey
              ? (doc.monthSeconds || 0) + seconds
              : seconds,
          weekReset: weekKey,
          monthReset: monthKey,
          streakDays,
          bestStreak,
          lastActiveDay: today,
        },
      },
      { upsert: true },
    );
  } catch (err) {
    console.error("[VoiceTime save error]", err.message);
  }
}


const guildConfigCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCachedConfig(configDB, guildId) {
  const cached = guildConfigCache.get(guildId);
  if (cached && Date.now() - cached.time < CACHE_TTL)
    return Promise.resolve(cached.data);
  return new Promise((resolve) => {
    configDB.get(
      `SELECT room_id, rules_ticket_channel, rules_voice_channel,
              fallin_channel_id, leaderboard_channel_id, leaderboard_msg_id,
              voice_logs_channel
       FROM guild_config WHERE guild_id = ?`,
      [guildId],
      (_, row) => {
        if (row) guildConfigCache.set(guildId, { data: row, time: Date.now() });
        resolve(row || null);
      },
    );
  });
}

function invalidateConfigCache(guildId) {
  guildConfigCache.delete(guildId);
}

// Fire-and-forget voice status
function setVoiceStatus(channelId, status) {
  axios
    .put(
      `https://discord.com/api/v10/channels/${channelId}/voice-status`,
      { status },
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    )
    .catch(() => {});
}


const SEP_NONE = new SeparatorBuilder()
  .setDivider(false)
  .setSpacing(SeparatorSpacingSize.Small);
const SEP_LINE = new SeparatorBuilder()
  .setDivider(true)
  .setSpacing(SeparatorSpacingSize.Small);


function buildAntiAbuseDM(joinerMember, vc, joinerId) {
  const joinerMention = `<@${joinerId}>`;
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## __${joinerMention}__ Want to join your voice <#${vc.id}>`,
      ),
    )
    .addSeparatorComponents(SEP_LINE)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# >  **User:** ${joinerMention}\n` +
          `-# >  **Channel:** <#${vc.id}>\n` +
          `-# >  **Time:** <t:${Math.floor(Date.now() / 1000)}:R>`,
      ),
    )
    .addSeparatorComponents(SEP_LINE)
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`anti_abuse_accept_${joinerId}_${vc.id}`)
          .setLabel("Accept")
          .setEmoji("<a:success:1499899743424217148>")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`anti_abuse_deny_${joinerId}_${vc.id}`)
          .setLabel("Deny")
          .setEmoji("<a:reject:1494781666064072714>")
          .setStyle(ButtonStyle.Danger),
      ),
    );
}

function buildHelpView(guildId, guildName) {
  let content = `# Command List\n`;

  const allCmds = [
    { name: "lock",                     emoji: e.lock,            desc: "Lock your channel." },
    { name: "unlock",                   emoji: e.unlock,          desc: "Unlock your channel." },
    { name: "permit @user",             emoji: e.permitUser,      desc: "Allow a user to join." },
    { name: "deny @user",               emoji: e.denyUser,        desc: "Block a user from joining." },
    { name: "kick @user",               emoji: e.trash,           desc: "Kick a user from your room." },
    { name: "limit <0-99>",             emoji: e.limit,           desc: "Set a user limit (0 = unlimited)." },
    { name: "name <text>",              emoji: e.rename,          desc: "Rename your channel." },
    { name: "claim",                    emoji: e.crown,           desc: "Claim ownership of an empty room." },
    { name: "transfer @user",           emoji: e.transfer,        desc: "Give ownership to someone else." },
    { name: "hide",                     emoji: e.hide,            desc: "Hide your channel from everyone." },
    { name: "unhide",                   emoji: "<:unhide:1491865105967878424>", desc: "Make your channel visible again." },
    { name: "status <text>",            emoji: e.status,          desc: "Set a voice status message." },
    { name: "owner",                    emoji: e.crown,           desc: "Show who owns this channel." },
    { name: "info",                     emoji: e.info,            desc: "View full channel info." },
    { name: "tlock",                    emoji: e.tlock,           desc: "Lock the text channel." },
    { name: "tunlock",                  emoji: e.tunlock,         desc: "Unlock the text channel." },
    { name: "rrject <roleID>",          emoji: e.rrject,          desc: "Block a role from connecting." },
    { name: "rpermit <roleID>",         emoji: e.rpermit,         desc: "Allow a role to connect." },
    { name: "anti-abuse on/off/status", emoji: e.antiAbuseStatus, desc: "Toggle anti-abuse protection." },
    { name: "wl-add @user",             emoji: e.wlAdd,           desc: "Add a user to your whitelist." },
    { name: "wl-remove @user",          emoji: e.wlRemove,        desc: "Remove a user from your whitelist." },
    { name: "wl-list",                  emoji: e.wlList,          desc: "Show your whitelisted users." },
    { name: "bl-add @user",             emoji: e.blAdd,           desc: "Add a user to your blacklist." },
    { name: "bl-remove @user",          emoji: e.blRemove,        desc: "Remove a user from your blacklist." },
    { name: "bl-list",                  emoji: e.blList,          desc: "Show your blacklisted users." },
    { name: "man-add @user",            emoji: e.manAdd,          desc: "Add a manager to co-manage your room." },
    { name: "man-remove @user",         emoji: e.manRemove,       desc: "Remove a manager." },
    { name: "man-list",                 emoji: e.manList,         desc: "List all your managers." },
    { name: "man-clear",                emoji: e.manClear,        desc: "Remove all managers at once." },
  ];

  for (const cmd of allCmds) {
    content += `\n${cmd.emoji} **|** **__.v ${cmd.name}__** — ${cmd.desc}\n`;
  }

  content += `\n-# Copyright 2026 ${guildName} · All rights reserved`;

  const container = new ContainerBuilder()
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems((item) =>
        item.setURL("https://timg.eu.cc/zetb5njO4x.png"),
      ),
    )
    .addSeparatorComponents(SEP_LINE)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
    .addSeparatorComponents(SEP_LINE)
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        // ✅ FIX: "Panel" — no emoji, no color (Secondary = grey)
        new ButtonBuilder()
          .setCustomId("help_back_to_panel")
          .setLabel("Panel")
          .setStyle(ButtonStyle.Secondary),
      ),
    );

  return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

// ── Build: Main Panel ─────────────────────────────────────────────────────────
function buildPanelContainer(
  userId,
  guildId,
  guildName,
  ticketChannelId,
  voiceSupportId,
) {
  const fallbackUrl = `https://discord.com/channels/${guildId}`;
  const voiceUrl = voiceSupportId
    ? `https://discord.com/channels/${guildId}/${voiceSupportId}`
    : fallbackUrl;
  const ticketUrl = ticketChannelId
    ? `https://discord.com/channels/${guildId}/${ticketChannelId}`
    : fallbackUrl;

  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# <a:welocm:1482515839746965610>  *__<@${userId}>__*`,
      ),
    )
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems((item) =>
        item.setURL("https://timg.eu.cc/7rimLaYZYd.png"),
      ),
    )
    
    .addSeparatorComponents(SEP_LINE)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        ` · __For voice assistance, join a support voice channel__`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Need Help")
          .setEmoji("🆘")
          .setStyle(ButtonStyle.Link)
          .setURL(voiceUrl),
      ),
    )
    .addSeparatorComponents(SEP_NONE)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        ` · __To report any issues on the server, please open a ticket__`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Ticket Support")
          .setEmoji("🎫")
          .setStyle(ButtonStyle.Link)
          .setURL(ticketUrl),
      ),
    )
    .addSeparatorComponents(SEP_LINE)
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("lock")
          .setEmoji(e.lock.trim())
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("unlock")
          .setEmoji(e.unlock.trim())
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("claim")
          .setEmoji(e.crown.trim())
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("setVoiceLimit")
          .setEmoji(e.limit.trim())
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("deny")
          .setEmoji(e.denyUser.trim())
          .setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSeparatorComponents(SEP_NONE)
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("permit")
          .setEmoji(e.permitUser.trim())
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("trash")
          .setEmoji(e.trash.trim())
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("name")
          .setEmoji(e.rename.trim())
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("transfer")
          .setEmoji(e.transfer.trim())
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("info")
          .setEmoji(e.info.trim())
          .setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSeparatorComponents(SEP_LINE)
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("features_menu")
          .setPlaceholder("Select a feature to toggle.")
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("Soundboard — ON")
              .setValue("soundboard_on")
              .setEmoji(e.sbOn.trim()),
            new StringSelectMenuOptionBuilder()
              .setLabel("Soundboard — OFF")
              .setValue("soundboard_off")
              .setEmoji(e.sbOff.trim()),
            new StringSelectMenuOptionBuilder()
              .setLabel("Camera — ON")
              .setValue("camera_on")
              .setEmoji(e.camOn.trim()),
            new StringSelectMenuOptionBuilder()
              .setLabel("Camera — OFF")
              .setValue("camera_off")
              .setEmoji(e.camOff.trim()),
            new StringSelectMenuOptionBuilder()
              .setLabel("Activities — ON")
              .setValue("activities_on")
              .setEmoji(e.actOn.trim()),
            new StringSelectMenuOptionBuilder()
              .setLabel("Activities — OFF")
              .setValue("activities_off")
              .setEmoji(e.actOff.trim()),
          ),
      ),
    )
    .addSeparatorComponents(SEP_LINE)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `__Click the button below to see all voice commands__ ·:·`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        
        new ButtonBuilder()
          .setCustomId("show_voice_help")
          .setLabel("Help")
          .setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSeparatorComponents(SEP_LINE)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# Copyright 2026 ${guildName} · All rights reserved`,
      ),
    );
}


module.exports = {
  name: "voiceStateUpdate",

  async execute(oldState, newState, client, configDB) {
    if (!newState.guild && !oldState.guild) return;

    const guild = newState.guild || oldState.guild;
    const member = newState.member || oldState.member;
    const guildId = guild.id;
    const userId = member?.id;
    if (!guildId || !userId) return;

    const sessionKey = `${userId}-${guildId}`;
    const joinedVoice = !oldState.channelId && newState.channelId;
    const leftVoice = oldState.channelId && !newState.channelId;

    if (joinedVoice) {
      voiceSessions.set(sessionKey, Date.now());
    } else if (leftVoice) {
      const joinedAt = voiceSessions.get(sessionKey);
      if (joinedAt) {
        voiceSessions.delete(sessionKey);
        saveVoiceTime(userId, guildId, Math.floor((Date.now() - joinedAt) / 1000));
      }
    }

    const row = await getCachedConfig(configDB, guildId);
    if (!row) return;

    const tempRoomId = row.room_id;

    if (joinedVoice && newState.channelId !== tempRoomId) {
      const tempRow = await new Promise((res) =>
        configDB.get(
          "SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?",
          [newState.channelId, guildId],
          (_, r) => res(r),
        ),
      );
      if (tempRow) {
        sendLog({
          guild, configDB, type: "join", actor: member,
          channel: guild.channels.cache.get(newState.channelId),
          extra: `Owner: <@${tempRow.owner_id}>`,
        }).catch(() => {});
      }
    }

    if (leftVoice && oldState.channelId !== tempRoomId) {
      const tempRow = await new Promise((res) =>
        configDB.get(
          "SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?",
          [oldState.channelId, guildId],
          (_, r) => res(r),
        ),
      );
      if (tempRow) {
        sendLog({
          guild, configDB, type: "leave", actor: member,
          channel: guild.channels.cache.get(oldState.channelId),
        }).catch(() => {});
      }
    }

   
    if (newState.channelId && newState.channelId !== tempRoomId) {
      const tempRow = await new Promise((res) =>
        configDB.get(
          "SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?",
          [newState.channelId, guildId],
          (_, r) => res(r),
        ),
      );

      if (tempRow && tempRow.owner_id !== userId) {
        const vc = guild.channels.cache.get(newState.channelId);
        if (vc) {
          const abuseRow = await new Promise((res) =>
            configDB.get(
              "SELECT enabled FROM anti_abuse WHERE owner_id = ? AND guild_id = ?",
              [tempRow.owner_id, guildId],
              (_, r) => res(r),
            ),
          );

          const everyoneOW = vc.permissionOverwrites.cache.get(guild.roles.everyone.id);
          const isLocked = everyoneOW?.deny.has(PermissionFlagsBits.Connect) || false;
          const isLimitOne = vc.userLimit === 1;
          const ownerInVC = vc.members.has(tempRow.owner_id);

          if (abuseRow?.enabled === 1 && ownerInVC && (isLimitOne || isLocked)) {
            const requestKey = `${userId}-${vc.id}`;
            if (antiAbuseApproved.has(requestKey)) return;

            const fallinCh = row.fallin_channel_id
              ? guild.channels.cache.get(row.fallin_channel_id)
              : null;
            try {
              if (fallinCh) await newState.setChannel(fallinCh);
              else await newState.disconnect();
            } catch {}

            sendLog({
              guild, configDB, type: "abuse", actor: member, channel: vc,
              extra: `Owner: <@${tempRow.owner_id}>`,
            }).catch(() => {});

            if (!antiAbuseRequests.has(requestKey)) {
              antiAbuseRequests.set(requestKey, { ownerId: tempRow.owner_id, guildId, channelId: vc.id });
              try {
                const ownerUser = await client.users.fetch(tempRow.owner_id).catch(() => null);
                if (ownerUser) {
                  const dm = buildAntiAbuseDM(member, vc, userId);
                  await ownerUser.send({ flags: MessageFlags.IsComponentsV2, components: [dm] }).catch(() => {});
                }
              } catch {}
              setTimeout(() => antiAbuseRequests.delete(requestKey), 300_000);
            }
            return;
          }
        }
      }
    }

   
    if (newState.channelId === tempRoomId && oldState.channelId !== tempRoomId) {
      if (cooldown.has(userId)) return;
      cooldown.add(userId);
      setTimeout(() => cooldown.delete(userId), 3000);

      try {
        const triggerChannel = guild.channels.cache.get(tempRoomId);
        const parentId = triggerChannel?.parentId ?? null;

        const vc = await guild.channels.create({
          name: ` ${member.displayName}`,
          type: ChannelType.GuildVoice,
          parent: parentId,
          lockPermissions: true,
        });

        if (!newState.channelId) {
          vc.delete("User disconnected").catch(() => {});
          return;
        }
        try {
          await newState.setChannel(vc);
        } catch (err) {
          console.error("Move failed:", err.message);
          vc.delete("Move failed").catch(() => {});
          return;
        }

        configDB.run(
          "INSERT OR REPLACE INTO temp_channels (channel_id, owner_id, guild_id) VALUES (?, ?, ?)",
          [vc.id, userId, guildId],
        );

        setVoiceStatus(vc.id, "🌙 enjoy ur time <a:enjoy:1491053471682527392>");

        sendLog({ guild, configDB, type: "create", actor: member, channel: vc }).catch(() => {});

        invalidateConfigCache(guildId);
        updateLeaderboard(guild, configDB, client).catch(() => {});

        (async () => {
          try {
            const overwrites = [];
            if (parentId) {
              const cat = guild.channels.cache.get(parentId);
              cat?.permissionOverwrites.cache.forEach((o) => {
                overwrites.push({ id: o.id, allow: o.allow, deny: o.deny, type: o.type });
              });
            }

            const [wl, bl] = await Promise.all([
              new Promise((r) =>
                configDB.all(
                  "SELECT whitelisted_id FROM whitelist_users WHERE owner_id = ? AND guild_id = ?",
                  [userId, guildId], (_, rows) => r(rows || []),
                ),
              ),
              new Promise((r) =>
                configDB.all(
                  "SELECT blacklisted_id FROM blacklist_users WHERE owner_id = ? AND guild_id = ?",
                  [userId, guildId], (_, rows) => r(rows || []),
                ),
              ),
            ]);

            const rejectedRoles = await new Promise((r) =>
              configDB.all(
                "SELECT role_id FROM rejected_roles WHERE owner_id = ? AND guild_id = ?",
                [userId, guildId], (_, rows) => r(rows || []),
              ),
            );

            for (const w of wl)
              overwrites.push({ id: w.whitelisted_id, allow: [PermissionFlagsBits.Connect], type: OverwriteType.Member });
            for (const b of bl)
              overwrites.push({ id: b.blacklisted_id, deny: [PermissionFlagsBits.Connect], type: OverwriteType.Member });
            for (const rr of rejectedRoles)
              overwrites.push({ id: rr.role_id, deny: [PermissionFlagsBits.Connect], type: OverwriteType.Role });

            overwrites.push(
              {
                id: userId,
                allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ViewChannel],
                type: OverwriteType.Member,
              },
              {
                id: client.user.id,
                allow: [
                  PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.ManageRoles,
                ],
                type: OverwriteType.Member,
              },
            );

            await vc.permissionOverwrites.set(overwrites);
          } catch (err) {
            console.error("[Perms Error]", err.message);
          }

          try {
            if (!guild.channels.cache.has(vc.id)) return;
            await new Promise(res => setTimeout(res, 400));
            if (!guild.channels.cache.has(vc.id)) return;

            const container = buildPanelContainer(
              userId, guildId, guild.name,
              row.rules_ticket_channel || null,
              row.rules_voice_channel || null,
            );

            const panelMsg = await vc.send({
              flags: MessageFlags.IsComponentsV2,
              components: [container],
            });
            if (!panelMsg) return;

            const collector = panelMsg.createMessageComponentCollector({
              filter: (i) =>
                i.message.id === panelMsg.id &&
                (i.customId === "show_voice_help" || i.customId === "help_back_to_panel"),
              time: 3_600_000,
            });

            collector.on("collect", async (interaction) => {
              try {
         
                if (interaction.user.id !== userId) {
                  return interaction.deferUpdate().catch(() => {});
                }
                // Use interaction.update() — one single API call, instant response
                if (interaction.customId === "show_voice_help") {
                  const help = buildHelpView(guildId, guild.name);
                  return interaction.update({ flags: help.flags, components: help.components }).catch(() => {});
                } else if (interaction.customId === "help_back_to_panel") {
                  const restored = buildPanelContainer(
                    userId, guildId, guild.name,
                    row.rules_ticket_channel || null,
                    row.rules_voice_channel || null,
                  );
                  return interaction.update({ flags: MessageFlags.IsComponentsV2, components: [restored] }).catch(() => {});
                }
              } catch (err) {
                console.error("[Collector]", err.message);
              }
            });
          } catch (err) {
            console.error("[Panel Send Error]", err.code, err.message);
          }
        })();

        setTimeout(async () => {
          if (guild.channels.cache.has(vc.id) && vc.members.size === 0) {
            try {
              await vc.delete("Empty after 3s");
              configDB.run("DELETE FROM temp_channels WHERE channel_id = ?", [vc.id]);
            } catch (err) {
              if (err.code !== 10003) console.error("Auto-delete:", err.message);
            }
          }
        }, 3000);
      } catch (err) {
        console.error("Error creating temp VC:", err);
      }
    }

 
    if (oldState.channelId) {
      configDB.get(
        "SELECT owner_id FROM temp_channels WHERE channel_id = ?",
        [oldState.channelId],
        async (_, tempRow) => {
          if (!tempRow) return;

          const vc = guild.channels.cache.get(oldState.channelId);
          if (!vc) {
            configDB.run("DELETE FROM temp_channels WHERE channel_id = ?", [oldState.channelId]);
            return;
          }

          if (vc.members.size === 0) {
            setVoiceStatus(vc.id, "");
            sendLog({
              guild, configDB, type: "delete", actor: member, channel: vc,
              extra: `Owner: <@${tempRow.owner_id}>`,
            }).catch(() => {});

            try {
              await vc.delete("Temp VC empty");
            } catch (err) {
              if (err.code !== 10003) console.error("Delete temp VC:", err.message);
            } finally {
              configDB.run("DELETE FROM temp_channels WHERE channel_id = ?", [oldState.channelId]);

              for (const [key] of antiAbuseRequests) {
                if (key.endsWith(`-${oldState.channelId}`)) antiAbuseRequests.delete(key);
              }
              for (const key of antiAbuseApproved) {
                if (key.endsWith(`-${oldState.channelId}`)) antiAbuseApproved.delete(key);
              }

              invalidateConfigCache(guildId);
              updateLeaderboard(guild, configDB, client).catch(() => {});
            }
          }
        },
      );
    }
  },
};

module.exports.voiceDb           = voiceDb;
module.exports.voiceSessions     = voiceSessions;
module.exports.antiAbuseRequests = antiAbuseRequests;
module.exports.antiAbuseApproved = antiAbuseApproved;
module.exports.buildInlinePanel  = buildPanelContainer;
module.exports.buildHelpView     = buildHelpView;
