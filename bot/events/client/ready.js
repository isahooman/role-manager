const logger = require('../../components/util/logger.js');
const { ActivityType } = require('discord.js');
const { cache } = require('../../bot.js');
const configManager = require('../../../components/configManager');
const roleManager = require('../../components/util/role-manager');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.start(`Logged in as ${client.user.tag}!`);
    logger.debug('Bot is ready and online.');

    // Cache servers, channels, threads, roles and users on startup
    cache.cacheServers(client);
    cache.cacheChannels(client);
    cache.cacheThreads(client);
    cache.cacheRoles(client);

    // Cache members for each guild
    const memberCache = [];
    client.guilds.cache.forEach(guild => {
      memberCache.push(cache.cacheMembers(guild));
    });

    // Wait for all member caching to complete
    await Promise.all(memberCache);
    logger.info('All cache data collection completed');

    // Validate database roles after caching is complete
    try {
      const cleanup = await roleManager.validateDatabaseRoles(client);
      if (cleanup.removedServerManagers > 0 || cleanup.removedRoleManagers > 0) logger.info(`Database cleanup completed: ${cleanup.removedServerManagers} server managers and ${cleanup.removedRoleManagers} role managers removed`);
      else logger.debug('Database validation completed - no cleanup needed');
    } catch (error) {
      logger.error(`Failed to validate database roles: ${error.message}`);
    }

    // Set the bot status status
    const updateStatus = () => {
      const statuses = configManager.loadConfig('status');

      // Exclude empty types
      const nonEmptyTypes = Object.keys(statuses).filter(type =>
        statuses[type] && Array.isArray(statuses[type]) && statuses[type].length > 0,
      );

      // Check if any non-empty types are available
      if (nonEmptyTypes.length === 0) {
        logger.debug('All activity types empty. Skipping status update.');
        return;
      }

      // Select a random activity type
      const randomType = nonEmptyTypes[Math.floor(Math.random() * nonEmptyTypes.length)];
      const activity = statuses[randomType][Math.floor(Math.random() * statuses[randomType].length)];

      // Set the types
      let discordActivityType;
      switch (randomType) {
        case 'playing':
          discordActivityType = ActivityType.Playing;
          break;
        case 'streaming':
          discordActivityType = ActivityType.Streaming;
          break;
        case 'listening':
          discordActivityType = ActivityType.Listening;
          break;
        case 'watching':
          discordActivityType = ActivityType.Watching;
          break;
        default:
          discordActivityType = ActivityType.Playing;
      }

      // Log the status change
      logger.debug(`Updating status to: ${randomType} ${activity}`);

      // Update the bot's activity
      client.user.setActivity(activity, { type: discordActivityType });
    };

    // Update status on startup and then once every 3 minutes
    updateStatus();
    setInterval(updateStatus, 180000);
  },
};
