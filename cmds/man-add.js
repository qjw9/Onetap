const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'man-add',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    const userArg = args[0];
    if (!userArg) return err('Please provide a user mention or ID.\\nUsage: `.v man-add @user`');

    const userId = userArg.match(/^<@!?(\d+)>$/)?.[1] || (userArg.match(/^\d{17,19}$/) ? userArg : null);
    if (!userId) return err('Please provide a valid user mention or ID.');

    db.all('SELECT * FROM user_managers WHERE owner_id = ?', [message.author.id], (dbErr, rows) => {
      if (dbErr) return err('Database error occurred.');
      if (rows.length >= 6) return err('Maximum number of managers (6) reached.');

      db.get('SELECT * FROM user_managers WHERE owner_id = ? AND manager_id = ?',
        [message.author.id, userId], (err2, row) => {
          if (row) return err('This user is already your manager.');
          db.run('INSERT INTO user_managers (owner_id, manager_id) VALUES (?, ?)',
            [message.author.id, userId], (err3) => {
              if (err3) return err('Failed to add manager.');
              styledSend(message, { title: 'Success', emoji: e.success.trim(), msg: `<@${userId}> has been added as your manager` });
            });
        });
    });
  },
};
