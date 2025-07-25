const logger = require('../../components/util/logger.js');
const { cache } = require('../../bot.js');

module.exports = {
  name: 'guildUnavailable',
  execute(guild) {
    logger.info(`Guild became unavailable;
      Guild Name: ${guild.name} | ${guild.id},
      Unavailable At: ${new Date().toISOString()},
    `);

    // Update the guild cache
    cache.removeGuild(guild);
  },
};
