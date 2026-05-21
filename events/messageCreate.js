const { TextDisplayBuilder, ContainerBuilder, MessageFlags } = require('discord.js');
const e = require('../emojis');

// Function to calculate Levenshtein distance
function levenshtein(a, b) {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = new Array(bn + 1);
  for (let i = 0; i <= bn; ++i) {
    matrix[i] = new Array(an + 1);
  }
  for (let i = 0; i <= an; ++i) {
    matrix[0][i] = i;
  }
  for (let j = 0; j <= bn; ++j) {
    matrix[j][0] = j;
  }
  for (let j = 1; j <= bn; ++j) {
    for (let i = 1; i <= an; ++i) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }
  return matrix[bn][an];
}

module.exports = {
    name: 'messageCreate',
    async execute(message, client, db) {
      if (message.author.bot || !message.guild) return;
  
      db.get(
        `SELECT prefix FROM guild_config WHERE guild_id = ?`,
        [message.guild.id],
        (err, row) => {
          const prefix = row?.prefix || '.v';
          if (!message.content.startsWith(prefix)) return;
  
          const args = message.content.slice(prefix.length).trim().split(/\s+/);
          let cmdName = args.shift().toLowerCase();

          // Try to find the command, allowing for multi-word commands (e.g., "man add")
          let command = client.commands.get(cmdName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(cmdName));

          if (!command && args.length > 0) {
            const secondWord = args[0].toLowerCase();
            const potentialCmdName = `${cmdName}-${secondWord}`;
            const potentialCommand = client.commands.get(potentialCmdName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(potentialCmdName));

            if (potentialCommand) {
              command = potentialCommand;
              cmdName = potentialCmdName;
              args.shift(); // Consume the second word
            }
          }
  
                    if (command) {
            try {
              command.execute(message, args, client, db);
            } catch (err) {
              console.error(err);
              message.channel.send({
                embeds: [
                  new require('discord.js').EmbedBuilder().setDescription(`${e.error} Error executing command.`).setColor('#f5eee2')
                ]
              });
            }
          } else {
            // If no command is found, try to suggest one.
            const commandNames = [...client.commands.keys()];
            let bestMatch = null;
            let minDistance = 3; // Set a threshold

            // Check for both single-word and potential multi-word commands
            const singleWordToTest = cmdName;
            const multiWordToTest = args.length > 0 ? `${cmdName}-${args[0].toLowerCase()}` : null;

            for (const name of commandNames) {
              // Check single word command
              let distance = levenshtein(singleWordToTest, name);
              if (distance < minDistance) {
                minDistance = distance;
                bestMatch = name;
              }

              // If a multi-word command is possible, check it
              if (multiWordToTest) {
                distance = levenshtein(multiWordToTest, name);
                if (distance < minDistance) {
                  minDistance = distance;
                  bestMatch = name;
                }
              }
            }

            // Suggest the command if a close enough match was found
            if (bestMatch) {
                const textComponent = new TextDisplayBuilder().setContent(`${e.error}   Did you mean \`${prefix} ${bestMatch.replace('-', ' ')}\`?`);
                const containerComponent = new ContainerBuilder().addTextDisplayComponents(textComponent);
                message.channel.send({
                    flags: MessageFlags.IsComponentsV2,
                    components: [containerComponent],
                });
            }
          }
        }
      );
    }
  };
  