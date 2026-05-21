/**
 * cmds/utility/rolescreat.js
 *
 * .v rolescreat <TargetServerID> <SourceServerID>
 *
 * LOGIC:
 *   1. READ roles from Target Server (using USER_TOKEN).
 *   2. WRITE roles to Source Server (using BOT).
 *   3. Bot deletes old roles in Source and creates copies from Target.
 *
 * REQUIREMENTS:
 *   - USER_TOKEN must be in the TARGET server (Arg 1).
 *   - BOT must be in the SOURCE server (Arg 2) with Administrator.
 */

require('dotenv').config();

const {
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    PermissionsBitField,
} = require('discord.js');
const https = require('https');
const WRITE_DELAY  = 700; // Slower to ensure all roles create without rate limits
const DELETE_DELAY = 400;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildMsg(lines) {
    const c = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(lines.join('\n'))
    );
    return { flags: MessageFlags.IsComponentsV2, components: [c] };
}
const send = (ch, lines)      => ch.send(buildMsg(lines));
const edit = (msg, lines)     => msg.edit(buildMsg(lines)).catch(() => null);
function discordGet(path, token, isUser = false) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'discord.com',
            path:     `/api/v10${path}`,
            method:   'GET',
            headers: {
                Authorization:  isUser ? token : `Bot ${token}`,
                'User-Agent':   'Mozilla/5.0 (compatible; role-clone/1.0)',
                'Content-Type': 'application/json',
            },
        }, (res) => {
            let raw = '';
            res.on('data', (c) => (raw += c));
            res.on('end', () => {
                try {
                    const json = JSON.parse(raw);
                    if (res.statusCode === 429)
                        return sleep((json.retry_after || 1) * 1000)
                            .then(() => discordGet(path, token, isUser))
                            .then(resolve).catch(reject);
                    if (res.statusCode >= 400)
                        return reject(new Error(`API ${res.statusCode} ${path}: ${json.message || raw}`));
                    resolve(json);
                } catch {
                    reject(new Error(`Parse error ${path}: ${raw.slice(0, 200)}`));
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}
module.exports = {
    name:        'rolescreat',
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
            return message.channel.send(buildMsg(['❌ **Administrator only.**']));

        const [targetId, sourceId] = args;

        if (!targetId || !sourceId) {
            return message.channel.send(buildMsg([
                '## ⚙️ Role Clone — Usage',
                '```',
                '.v rolescreat <TargetServerID> <SourceServerID>',
                '```',
                '> **Target:** ID to copy FROM (User Token).',
                '> **Source:** ID to copy TO (Bot).',
            ]));
        }

        const USER_TOKEN = process.env.USER_TOKEN;
        if (!USER_TOKEN)
            return message.channel.send(buildMsg(['❌ `USER_TOKEN` is missing in .env']));
        let sourceGuild;
        try {
            sourceGuild = client.guilds.cache.get(sourceId) || await client.guilds.fetch(sourceId);
        } catch {
            return message.channel.send(buildMsg(['❌ Bot is not in the **Source Server** (Arg 2).']));
        }

        const botMember = sourceGuild.members.cache.get(client.user.id)
            || await sourceGuild.members.fetch(client.user.id).catch(() => null);
            
        if (!botMember?.permissions.has(PermissionsBitField.Flags.Administrator))
            return message.channel.send(buildMsg(['❌ Bot needs **Administrator** in the Source server.']));
        const statusMsg = await send(message.channel, [
            '## 🔄 Role Clone',
            `> **Read From:** \`${targetId}\``,
            `> **Write To:** \`${sourceGuild.name}\``,
            '',
            '⏳ Fetching roles...',
        ]);

        let targetRoles;
        try {
            const data = await discordGet(`/guilds/${targetId}/roles`, USER_TOKEN, true);
            targetRoles = data;
        } catch (err) {
            return edit(statusMsg, [
                '❌ Failed to fetch roles from Target Server.',
                `> ${err.message}`,
            ]);
        }
        await edit(statusMsg, [
            `✅ Found **${targetRoles.length}** roles in Target.`,
            '',
            '🗑️ Deleting old roles in Source...',
        ]);

        await sourceGuild.roles.fetch();
        const botHighest = botMember.roles.highest.position;
        let deletedCount = 0;

        // Sort DESCENDING (highest position first) to delete safely
        const rolesToDelete = [...sourceGuild.roles.cache.values()].sort((a, b) => b.position - a.position);

        for (const role of rolesToDelete) {
            // Skip @everyone, managed roles (bots/nitro), and roles higher than the bot
            if (role.name === '@everyone' || role.managed || role.position >= botHighest) continue;
            
            try {
                await role.delete('Role Clone Wipe');
                deletedCount++;
                await sleep(DELETE_DELAY);
            } catch (e) {
                console.error(`[Delete Error] ${role.name}: ${e.message}`);
            }
        }

        await edit(statusMsg, [
            `🗑️ Deleted **${deletedCount}** roles.`,
            '',
            '⏳ Creating new roles...',
        ]);
        // Filter: Remove @everyone and Managed Roles (Nitro, Bots)
        // Sort: DESCENDING (highest position first)
        const rolesToCreate = targetRoles
            .filter(r => r.name !== '@everyone' && !r.managed)
            .sort((a, b) => b.position - a.position);
        
        let createdCount = 0;
        let failedCount = 0;

        for (const tRole of rolesToCreate) {
            try {
                await sourceGuild.roles.create({
                    name:        tRole.name,
                    color:       parseInt(tRole.color) || 0,
                    hoist:       tRole.hoist,
                    mentionable: tRole.mentionable,
                    permissions: BigInt(tRole.permissions),
                    // Icons and Emojis removed to prevent errors
                    reason:      `Cloned from Target`,
                });
                
                createdCount++;
                await sleep(WRITE_DELAY);
            } catch (err) {
                failedCount++;
                console.error(`[Create Error] Role "${tRole.name}": ${err.message}`);
            }

            // Update status every 5 roles
            if (createdCount % 5 === 0) {
                await edit(statusMsg, [
                    `🗑️ Deleted **${deletedCount}** roles.`,
                    '',
                    `⏳ Creating roles... **${createdCount}/${rolesToCreate.length}**`,
                    `*(Failed: ${failedCount})*`,
                ]);
            }
        }
        await edit(statusMsg, [
            '## ✅ Role Clone Complete',
            `> **Server:** ${sourceGuild.name}`,
            '',
            `**Deleted:** ${deletedCount} old roles`,
            `**Created:** ${createdCount} new roles`,
            ...(failedCount > 0 ? [`**Failed/Skipped:** ${failedCount}`] : []),
            `-# Finished <t:${Math.floor(Date.now() / 1000)}:T>`,
        ]);
    },
};