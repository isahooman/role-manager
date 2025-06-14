const { Client, GatewayIntentBits } = require('discord.js');
const { loadAll, deployCommands, undeploy } = require('./components/core/loader');
const logger = require('./components/util/logger.js');
const configManager = require('../components/configManager.js');
const path = require('path');
let cooldownBuilder = require('./components/commands/cooldown.js');
let cache = new (require('./components/util/cache'));

/**
 * Processes intent configuration
 * @param {object} intentConfig - The intent configuration object
 * @returns {Array} Array of intent bits
 * @author Effanlaw
 */
const handleIntents = intentConfig => {
  let totalIntentsBits = [];
  for (const intent in intentConfig) if (intentConfig[intent]) totalIntentsBits.push(GatewayIntentBits[intent]);
  return totalIntentsBits;
};

/**
 * Validates essential configuration values
 * @returns {boolean} Whether all required configurations are valid
 * @author isahooman
 */
function validateConfig() {
  const requiredConfigs = [
    { name: 'token', value: configManager.getConfigValue('config', 'token') },
    { name: 'clientId', value: configManager.getConfigValue('config', 'clientId') },
    { name: 'ownerId', value: configManager.getConfigValue('config', 'ownerId') },
    { name: 'prefix', value: configManager.getConfigValue('config', 'prefix') },
  ];

  const missingConfigs = [];

  for (const config of requiredConfigs) {
    let isEmpty;

    if (config.name === 'ownerId') isEmpty = !config.value || !Array.isArray(config.value) || !config.value.length || !config.value[0] || config.value[0].trim() === '';
    else isEmpty =
        // Check for undefined values
        !config.value ||
        // Check for empty strings
        (typeof config.value === 'string' && config.value.trim() === '') ||
        // Check for empty arrays
        (Array.isArray(config.value) && config.value.length === 0);

    if (isEmpty) missingConfigs.push(config.name);
  }

  if (missingConfigs.length > 0) {
    logger.warn(`Required config info is missing or empty: ${missingConfigs.join(', ')}`);
    return false;
  }

  return true;
}

/**
 * Checks if the bot is being run from the project root directory
 * @returns {boolean} Whether the bot is being run from the root directory
 * @author isahooman
 */
function isRoot() {
  const expectedRoot = path.resolve(__dirname, '..');
  const currentDir = process.cwd();

  logger.debug(`Expected root: ${expectedRoot}`);
  logger.debug(`Current directory: ${currentDir}`);

  // Check if running from expected directory
  return path.resolve(currentDir) === path.resolve(expectedRoot);
}

/**
 * Starts the bot and loads necessary data
 * @param {Client} bot - Discord Client
 * @author Effanlaw
 */
async function startBot(bot) {
  logger.debug('Bot starting..');

  // Check for required config data
  if (!validateConfig()) {
    logger.error('Bot startup aborted due to missing configuration. Please fill out the required fields in the config.json5 file.');
    // Exit with 0 to avoid auto recovery
    process.exit(0);
  }

  // Load all events and commands
  await loadAll(bot);

  // Redeploy slash commands on startup
  const deployOnStart = configManager.getConfigValue('config', 'deployOnStart', false);
  if (deployOnStart) await deployCommands();

  // Login once preparations are done
  const token = configManager.getConfigValue('config', 'token');
  bot.login(token);
}

/**
 * Safely starts the bot after directory validation
 * @author isahooman
 */
function safeStart() {
  if (!isRoot()) {
    process.stderr.write('Bot must be run from the project directory.\n');
    process.stderr.write(`Please run from: ${path.resolve(__dirname, '..')}`);
    process.exit(1);
  }

  startBot(client);
}

const intents = configManager.loadConfig('intents');

// Create the Discord client
const client = new Client({
  intents: handleIntents(intents),
  shards: 'auto',
});

// Export modules
exports.client = client;
exports.cooldown = cooldownBuilder;
exports.cache = cache;

// Start the bot
safeStart();

// Process Events
process
  .on('exit', message => {
    logger.error(`Shutdown because: ${message}`);
  })

  .on('warning', warning => {
    logger.warn(`${warning.name}\n${warning.message}\n${warning.stack}`);
  })

  .on('uncaughtException', async(err, origin) => {
    const startTime = Date.now();
    logger.error(`Caught exception: ${err}\nException origin: ${origin}\nStack Trace: ${err.stack}`);
    // Attempt to reconnect if the client died.
    if (!exports.client.user) try {
      logger.info('Attempting to reconnect to Discord...');
      await exports.client.login;
      const endTime = Date.now();
      logger.info(`Successfully reconnected in ${endTime - startTime}ms!`);
    } catch (error) {
      logger.error('Failed to reconnect:', error);
    }
    else logger.info('Client is logged in, skipping reconnect.');
  })

  .on('unhandledRejection', async(reason, message) => {
    const startTime = Date.now();
    logger.error(`Unhandled Rejection at:${message}\nReason:${reason.stack}`);
    // Attempt to reconnect if the client died.
    if (!exports.client.user) try {
      logger.info('Attempting to reconnect to Discord...');
      await exports.client.login;
      const endTime = Date.now();
      logger.info(`Successfully reconnected in ${endTime - startTime}ms!`);
    } catch (error) {
      logger.error('Failed to reconnect:', error);
    }
    else logger.info('Client is logged in, skipping reconnect.');
  })

  .on('SIGINT', async() => {
    logger.info('Received SIGINT. Shutting down...');

    // Get undeployOnExit configuration
    const undeployOnExit = configManager.getConfigValue('config', 'undeployOnExit', false);

    // Undeploy commands if true in config
    if (undeployOnExit) try {
      await undeploy();
    } catch (error) {
      logger.error(`Error during undeploy: ${error}`);
    }
    // Logout of Discord
    await exports.client.destroy();
    logger.info('Bot successfully logged out.');

    process.exit(0);
  });
