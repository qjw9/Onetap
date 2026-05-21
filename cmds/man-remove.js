const e = require('../emojis');
const { styledSend } = require('../utils/reply');

module.exports = {
  name: 'man-remove',
  async execute(message, args, client, db) {
    const err = (msg) => styledSend(message, { title: 'Error', emoji: e.error.trim(), msg });

    const userArg = args[0];
    if (!userArg) return err('Please provide a user mention or ID.');
    const managerId = userArg.match(/^<@!?(\d+)>$/)?.[1] || (userArg.match(/^\d{17,19}$/) ? userArg : null);
    if (!managerId) return err('Please provide a valid user mention or ID.');

    db.get('SELECT * FROM user_managers WHERE owner_id = ? AND manager_id = ?',
      [message.author.id, managerId], (dbErr, row) => {
        if (!row) return err('This user is not your manager.');
        db.run('DELETE FROM user_managers WHERE owner_id = ? AND manager_id = ?',
          [message.author.id, managerId], (err2) => {
            if (err2) return err('Failed to remove manager.');
            styledSend(message, { title: 'Success', emoji: e.success.trim(), msg: `<@${managerId}> has been removed from your managers` });
          });
      });
  },
};
