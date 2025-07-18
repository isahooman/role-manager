const logger = require('../../components/util/logger.js');
const { cache } = require('../../bot.js');

module.exports = {
  name: 'roleDelete',
  execute(role) {
    logger.info(`Role deleted;
      Name: ${role.name},
      ID: ${role.id},
      Guild: ${role.guild.name} | ${role.guild.id},
      Deleted At: ${new Date().toISOString()}
    `);

    // Remove the role from the cache
    cache.removeRole(role.id);
  },
};
