# One Tap Bot

A Discord voice room management bot built with discord.js v14.

## Setup

1. Copy `.env.example` to `.env` and fill in your values
2. Run `npm install`
3. Run `node index.js`

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Your bot token from the Discord Developer Portal |
| `MONGODB_URI` | No | MongoDB connection string. Only needed for voice stats commands (`top`, `stats`, `Card`). Everything else works without it. |
| `EMOJIS` | No | Set to `true` to auto-upload the bot's custom emojis to its application on startup. Useful when running as a public bot. |

## MongoDB

MongoDB is **not required** to run the bot. It is only used by the voice time tracking commands:
- `.v top` — all-time leaderboard
- `.v topweek` — weekly leaderboard  
- `.v topmonth` — monthly leaderboard
- `.v stats` — personal voice stats
- `.v Card` — voice rank card

Everything else (voice rooms, panel, whitelist, blacklist, managers, tasks, events, music) runs on SQLite and works out of the box with no extra setup.

## Public Bot

To make this bot public:
1. Go to the Discord Developer Portal → your application → Bot
2. Enable "Public Bot"
3. Set `EMOJIS=true` in your `.env` so the bot uploads its emojis to its own application — this means any server that adds the bot will see the correct emojis without needing to add them manually

## Permissions

When generating an invite link, the bot needs these permissions:
- Manage Channels
- Manage Roles
- Move Members
- View Channels
- Send Messages
- Embed Links
- Read Message History

Privileged Intents required (enable in Developer Portal):
- Server Members Intent
- Message Content Intent
