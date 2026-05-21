'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const { Client, GatewayIntentBits, Collection, ActivityType, ChannelType, REST, Routes } = require('discord.js');
const sqlite3  = require('sqlite3').verbose();
const fs       = require('fs');
const path     = require('path');
const https    = require('https');
const http     = require('http');

const e = require('./emojis');

if (!process.env.DISCORD_TOKEN) {
  console.error('No DISCORD_TOKEN found. Set it in your .env file.');
  process.exit(1);
}

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('[MongoDB] Connected'))
    .catch(err => console.error('[MongoDB] Connection error:', err.message));
} else {
  console.warn('[MongoDB] MONGODB_URI not set — voice stats/leaderboard commands disabled.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

const configDB = new sqlite3.Database('./config.db', (err) => {
  if (err) { console.error('config.db error:', err.message); process.exit(1); }
  console.log('Connected to config.db');
});

const taskDB = new sqlite3.Database('./task.db', (err) => {
  if (err) { console.error('task.db error:', err.message); process.exit(1); }
  console.log('Connected to task.db');
});

configDB.serialize(() => {
  configDB.run(`CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    room_id TEXT,
    prefix TEXT DEFAULT '.v',
    apply_logs_channel TEXT,
    hide_role TEXT
  )`);
  configDB.run(`CREATE TABLE IF NOT EXISTS temp_channels (
    channel_id TEXT PRIMARY KEY,
    owner_id TEXT,
    guild_id TEXT
  )`);
  configDB.run(`CREATE TABLE IF NOT EXISTS user_managers (owner_id TEXT, manager_id TEXT, PRIMARY KEY (owner_id, manager_id))`);
  configDB.run(`CREATE TABLE IF NOT EXISTS whitelist_users (owner_id TEXT, whitelisted_id TEXT, guild_id TEXT, PRIMARY KEY (owner_id, whitelisted_id, guild_id))`);
  configDB.run(`CREATE TABLE IF NOT EXISTS blacklist_users (owner_id TEXT, blacklisted_id TEXT, guild_id TEXT, PRIMARY KEY (owner_id, blacklisted_id, guild_id))`);
  configDB.run(`CREATE TABLE IF NOT EXISTS event_manager (guild_id TEXT PRIMARY KEY, event_name TEXT, event_role TEXT, event_category TEXT, event_channel TEXT)`);
  configDB.run(`CREATE TABLE IF NOT EXISTS task_settings (guild_id TEXT PRIMARY KEY, taskers TEXT, managers TEXT, tasklogs TEXT)`);
  configDB.run(`CREATE TABLE IF NOT EXISTS music_bots (bot_id TEXT, guild_id TEXT, join_cmd TEXT DEFAULT '!join', PRIMARY KEY (bot_id, guild_id))`);
  configDB.run(`CREATE TABLE IF NOT EXISTS music_config (guild_id TEXT PRIMARY KEY, channel_id TEXT)`);
  configDB.run(`CREATE TABLE IF NOT EXISTS anti_abuse (owner_id TEXT, guild_id TEXT, enabled INTEGER DEFAULT 0, PRIMARY KEY (owner_id, guild_id))`);
  configDB.run(`CREATE TABLE IF NOT EXISTS rejected_roles (owner_id TEXT, role_id TEXT, guild_id TEXT, PRIMARY KEY (owner_id, role_id, guild_id))`);

  const migrate = (sql) => configDB.run(sql, () => {});
  migrate(`ALTER TABLE guild_config ADD COLUMN apply_logs_channel TEXT`);
  migrate(`ALTER TABLE guild_config ADD COLUMN hide_role TEXT`);
  migrate(`ALTER TABLE guild_config ADD COLUMN voicestats_channel TEXT`);
  migrate(`ALTER TABLE guild_config ADD COLUMN rules_banner TEXT`);
  migrate(`ALTER TABLE guild_config ADD COLUMN rules_help_channel TEXT`);
  migrate(`ALTER TABLE guild_config ADD COLUMN rules_ticket_channel TEXT`);
  migrate(`ALTER TABLE guild_config ADD COLUMN rules_voice_channel TEXT`);
  migrate(`ALTER TABLE guild_config ADD COLUMN fallin_channel_id TEXT`);
  migrate(`ALTER TABLE guild_config ADD COLUMN leaderboard_channel_id TEXT`);
  migrate(`ALTER TABLE guild_config ADD COLUMN leaderboard_msg_id TEXT`);
  migrate(`ALTER TABLE guild_config ADD COLUMN voice_logs_channel TEXT`);
  migrate(`ALTER TABLE music_bots ADD COLUMN join_cmd TEXT DEFAULT '!join'`);
});

taskDB.serialize(() => {
  taskDB.run(`CREATE TABLE IF NOT EXISTS task_counts (
    server_id TEXT NOT NULL,
    tasker_id TEXT NOT NULL,
    number_of_tasks INTEGER DEFAULT 0,
    PRIMARY KEY (server_id, tasker_id)
  )`);
});

const commandsPath = path.join(__dirname, 'cmds');
const commandFiles = fs.existsSync(commandsPath)
  ? fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))
  : [];

for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsPath, file));
    if (!command.name || typeof command.execute !== 'function') continue;
    client.commands.set(command.name, command);
    console.log(`Loaded command: ${command.name}`);
  } catch (err) {
    console.error(`Error loading ${file}:`, err.message);
  }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.existsSync(eventsPath)
  ? fs.readdirSync(eventsPath).filter(f => f.endsWith('.js') && f !== 'button.js')
  : [];

for (const file of eventFiles) {
  try {
    const event = require(path.join(eventsPath, file));
    if (!event.name || typeof event.execute !== 'function') continue;
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client, configDB));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client, configDB));
    }
    console.log(`Loaded event: ${event.name}`);
  } catch (err) {
    console.error(`Error loading event ${file}:`, err.message);
  }
}

const buttonEvent = require('./events/button.js');
client.on(buttonEvent.name, (...args) => {
  buttonEvent.execute(...args, client, configDB, taskDB);
});

const axios = require('axios');

async function fetchAsBase64(url, retries = 4) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          // Must spoof a browser UA — Discord CDN blocks bot UAs for GIF downloads
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': 'https://discord.com/',
        },
        maxRedirects: 5,
      });
      return Buffer.from(response.data).toString('base64');
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
}

async function syncEmojis(appId, token) {
  const { emojiAssets } = require('./emojis');
  const rest = new REST({ version: '10' }).setToken(token);

  let existing = [];
  try {
    const res = await rest.get(Routes.applicationEmojis(appId));
    existing = res.items || [];
  } catch (err) {
    console.error('[Emoji Sync] Could not fetch existing emojis:', err.message);
    return;
  }

  const existingNames = new Set(existing.map(em => em.name));
  const toUpload = emojiAssets.filter(a => !existingNames.has(a.name));

  if (toUpload.length === 0) {
    console.log('[Emoji Sync] All emojis already uploaded.');
    return;
  }

  console.log(`[Emoji Sync] Uploading ${toUpload.length} missing emojis...`);

  const failed = [];

  for (const asset of toUpload) {
    try {
      const imageData = await fetchAsBase64(asset.url);
      // Detect animated from flag OR .gif extension in URL
      const isAnimated = asset.animated === true || asset.url.endsWith('.gif');
      const mimeType   = isAnimated ? 'image/gif' : 'image/png';
      await rest.post(Routes.applicationEmojis(appId), {
        body: { name: asset.name, image: `data:${mimeType};base64,${imageData}` },
      });
      console.log(`[Emoji Sync] Uploaded: ${asset.name} (${isAnimated ? 'animated' : 'static'})`);
      await new Promise(r => setTimeout(r, 700));
    } catch (err) {
      console.warn(`[Emoji Sync] Failed: ${asset.name} — ${err.message}`);
      failed.push(asset.name);
    }
  }

  if (failed.length > 0) {
    console.warn(`[Emoji Sync] ${failed.length} emojis could not be auto-uploaded (CDN access denied).`);
    console.warn(`[Emoji Sync] Upload these manually to your application emojis: ${failed.join(', ')}`);
    console.warn(`[Emoji Sync] Developer Portal → Your App → Emojis`);
  }

  console.log('[Emoji Sync] Done.');
}

const STATUS_MESSAGES = ['.kawai', 'IN LOVE', 'enjoy ur tap'];
let activityIndex = 0;

function updateActivity() {
  client.user.setPresence({
    activities: [{ name: STATUS_MESSAGES[activityIndex], type: ActivityType.Custom, state: 'Be Yourself' }],
    status: 'idle',
  });
  activityIndex = (activityIndex + 1) % STATUS_MESSAGES.length;
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  updateActivity();
  setInterval(updateActivity, 30_000);

  if (process.env.EMOJIS === 'true') {
    await syncEmojis(client.user.id, process.env.DISCORD_TOKEN);
  }
});

setInterval(() => {
  configDB.all(
    'SELECT guild_id, voicestats_channel FROM guild_config WHERE voicestats_channel IS NOT NULL',
    [],
    async (err, rows) => {
      if (err || !rows) return;
      for (const row of rows) {
        const guild   = client.guilds.cache.get(row.guild_id);
        if (!guild) continue;
        const channel = guild.channels.cache.get(row.voicestats_channel);
        if (!channel) continue;
        try {
          const inVoice = guild.channels.cache
            .filter(c => c.type === ChannelType.GuildVoice && c.members.size > 0)
            .reduce((acc, c) => acc + c.members.size, 0);
          await channel.setName(`🔊 In Voice: ${inVoice}`);
        } catch {}
      }
    }
  );
}, 5 * 60_000);

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!');
}).listen(11267, () => console.log('[KeepAlive] HTTP on port 11267'));

process.on('unhandledRejection', err => console.error('[UNHANDLED REJECTION]', err));
process.on('uncaughtException',  err => console.error('[UNCAUGHT EXCEPTION]',  err));

module.exports = { client, configDB };

client.login(process.env.DISCORD_TOKEN);