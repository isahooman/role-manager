const { PermissionFlagsBits } = require('discord.js');
const configManager = require('../../../components/configManager');
const logger = require('./logger');
const { writeFile } = require('../core/fileHandler');
const path = require('path');
const fs = require('fs');

class RoleManager {
  constructor() {
    this.config = 'bot:managed';
    this.cache = null;
    this.ensureConfig();
    this.loadCache();
  }

  /**
   * Ensures that the config file exists
   * @author isahooman
   * @private
   */
  ensureConfig() {
    try {
      const configPath = configManager.getConfigPath(this.config);
      const dirPath = path.dirname(configPath);

      // Create directory structure if it doesn't exist
      if (!fs.existsSync(dirPath)) {
        logger.debug(`[Manager Util] Creating directory structure: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Check if config file exists, create if it doesn't
      if (!fs.existsSync(configPath)) {
        logger.info(`[Manager Util] Config file does not exist, creating default at: ${configPath}`);
        const defaultConfig = {};
        writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
      } else {
        logger.debug(`[Manager Util] Config file exists at: ${configPath}`);
      }
    } catch (error) {
      logger.error(`[Manager Util] Error ensuring config file exists: ${error.message}`);
    }
  }

  /**
   * Load the managed data into cache
   * @author isahooman
   * @private
   */
  loadCache() {
    logger.info('[Manager Util] Loading role manager cache from config');
    try {
      const loadedConfig = configManager.loadConfig(this.config);

      // If no config data, initialize an empty cache
      if (!loadedConfig) {
        logger.info('[Manager Util] No config data found, initializing empty cache');
        this.cache = {};
        return;
      }

      // Initialize the cache with the loaded config
      this.cache = {};

      // Ensure all guild entries have the complete structure
      Object.entries(loadedConfig).forEach(([guildId, guildData]) => {
        this.cache[guildId] = {
          managers: Array.isArray(guildData.managers) ? guildData.managers : [],
          roles: {},
        };

        // Remove empty role data from cache
        if (guildData.roles && typeof guildData.roles === 'object') Object.entries(guildData.roles).forEach(([roleId, managers]) => {
          // Only add roles that have at least one manager
          if (Array.isArray(managers) && managers.length > 0) this.cache[guildId].roles[roleId] = managers;
          else logger.debug(`[Manager Util] Skipping role ${roleId} in guild ${guildId} as it has no managers`);
        });
      });

      // Clean up guilds with no data
      Object.keys(this.cache).forEach(guildId => {
        if (this.cache[guildId].managers.length === 0 && Object.keys(this.cache[guildId].roles).length === 0) {
          logger.debug(`[Manager Util] Removing guild ${guildId} as it has no managers or roles`);
          delete this.cache[guildId];
        }
      });

      logger.info(`[Manager Util] Cache loaded successfully with ${Object.keys(this.cache).length} guilds`);
    } catch (error) {
      // If any issues, initialize an empty cache
      logger.error(`[Manager Util] Failed to load role manager cache: ${error.message}`);
      this.cache = {};
    }
  }

  /**
   * Validate that inputs are non-empty strings
   * @param {...string} inputs - Strings to validate
   * @returns {boolean} Whether all inputs are valid
   * @author isahooman
   * @private
   */
  validateInputs(...inputs) {
    for (const input of inputs) if (typeof input !== 'string' || !input || input.trim() === '') return false;

    return true;
  }

  /**
   * Get managed data for a specific guild
   * @param {string} guildId - Discord guild ID
   * @returns {object} Guild's managed roles data
   * @author isahooman
   */
  getGuildData(guildId) {
    if (!this.validateInputs(guildId)) {
      logger.warn(`[Manager Util] Invalid inputs received for getGuildData`);
      return { managers: [], roles: {} };
    }

    // Ensure guild data has a valid structure
    if (this.cache[guildId]) {
      // Ensure managers array exists
      if (!Array.isArray(this.cache[guildId].managers)) {
        logger.debug(`[Manager Util] Creating missing managers array for guild ${guildId}`);
        this.cache[guildId].managers = [];
      }

      // Ensure role array exist and clean up empty roles
      if (!this.cache[guildId].roles || typeof this.cache[guildId].roles !== 'object') {
        logger.debug(`[Manager Util] Creating missing roles object for guild ${guildId}`);
        this.cache[guildId].roles = {};
      } else {
        // Remove any roles that have no managers
        Object.keys(this.cache[guildId].roles).forEach(roleId => {
          if (!Array.isArray(this.cache[guildId].roles[roleId]) || this.cache[guildId].roles[roleId].length === 0) {
            logger.debug(`[Manager Util] Removing role ${roleId} from guild ${guildId} as it has no managers`);
            delete this.cache[guildId].roles[roleId];
          }
        });
      }

      return this.cache[guildId];
    }

    // Create default structure if guild not found
    logger.info(`[Manager Util] Creating new guild data structure for guild ${guildId}`);
    this.cache[guildId] = {
      managers: [],
      roles: {},
    };

    // Save the updated cache to config
    if (!this.saveData(this.cache)) logger.warn(`[Manager Util] Failed to persist new guild data for ${guildId}`);

    return this.cache[guildId];
  }

  /**
   * Get all managed data
   * @returns {object} Complete managed data object
   * @author isahooman
   */
  getAllData() {
    return this.cache;
  }

  /**
   * Save managed data to config file
   * @param {object} data - new data object
   * @returns {boolean} if successful
   * @author isahooman
   */
  saveData(data) {
    logger.debug('[Manager Util] Saving role manager data to config');

    // Validate input
    if (!data || typeof data !== 'object') {
      logger.error('[Manager Util] Failed to save role manager data: Invalid data provided');
      return false;
    }

    try {
      // Update cache
      this.cache = data;
      return configManager.saveConfig(this.config, data);
    } catch (error) {
      logger.error(`[Manager Util] Failed to save role manager data: ${error.message}`);
      return false;
    }
  }

  /**
   * Add a role manager
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Role ID to manage
   * @param {string} target - User ID to add as manager
   * @param {object} user - User requesting manager addition
   * @returns {boolean} Success status
   * @author isahooman
   */
  addRoleManager(guildId, roleId, target, user) {
    if (!this.validateInputs(guildId, roleId, target)) {
      logger.warn(`[Manager Util] Invalid inputs received for addRoleManager`);
      return false;
    }

    // Check if user has permission to config role managers
    if (user && !this.isServerAdmin(user)) {
      logger.warn(`[Manager Util] User ${user.id} (${user.user?.tag}) lacks permission to add role managers`);
      return false;
    }

    try {
      // Get existing guild data
      const guildData = this.getGuildData(guildId);
      if (!guildData.roles[roleId]) {
        logger.debug(`[Manager Util] Creating new role manager array for role ${roleId}`);
        guildData.roles[roleId] = [];
      } else if (guildData.roles[roleId].includes(target)) {
        logger.info(`[Manager Util] User ${target} is already a manager for role ${roleId}`);
        return false;
      }

      // Add user as manager for target role
      guildData.roles[roleId].push(target);
      logger.info(`[Manager Util] Added user ${target} as manager for role ${roleId} in guild ${guildId}`);

      // Save and return the result
      return this.saveData(this.cache);
    } catch (error) {
      logger.error(`[Manager Util] Error adding role manager: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Remove a role manager
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Role ID
   * @param {string} target - User ID to remove
   * @param {object} user - User requesting manager removal
   * @returns {boolean} Success status
   * @author isahooman
   */
  removeRoleManager(guildId, roleId, target, user) {
    if (!this.validateInputs(guildId, roleId, target)) {
      logger.warn(`[Manager Util] Invalid inputs received for removeRoleManager`);
      return false;
    }

    // Check if user has permission to cofig role managers
    if (user && !this.isServerAdmin(user)) {
      logger.warn(`[Manager Util] User ${user.id} (${user.user?.tag}) lacks permission to remove role managers`);
      return false;
    }

    try {
      // Get existing guild data
      const guildData = this.getGuildData(guildId);
      if (!guildData.roles[roleId]) {
        logger.debug(`[Manager Util] Role ${roleId} has no managers to remove from`);
        return false;
      } else if (!guildData.roles[roleId].includes(target)) {
        logger.info(`[Manager Util] User ${target} is not a manager for role ${roleId}`);
        return false;
      }

      // Remove user as manager from target role
      guildData.roles[roleId] = guildData.roles[roleId].filter(id => id !== target);
      logger.info(`[Manager Util] Removed user ${target} as manager for role ${roleId} in guild ${guildId}`);

      // Clean up empty role arrays
      if (guildData.roles[roleId].length === 0) {
        logger.debug(`[Manager Util] Removing empty role manager array for role ${roleId}`);
        delete guildData.roles[roleId];
      }

      // Save the updated cache to config
      return this.saveData(this.cache);
    } catch (error) {
      logger.error(`[Manager Util] Error removing role manager: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Add a server manager role
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Server manager role ID
   * @returns {boolean} Success status
   * @author isahooman
   */
  addServerManager(guildId, roleId) {
    if (!this.validateInputs(guildId, roleId)) {
      logger.warn(`[Manager Util] Invalid inputs received for addServerManager`);
      return false;
    }

    logger.info(`[Manager Util] Adding role ${roleId} as server manager in guild ${guildId}`);

    try {
      // Get guild data
      const guildData = this.getGuildData(guildId);

      // Skip if role is already a manager
      if (guildData.managers.includes(roleId)) {
        logger.debug(`[Manager Util] Role ${roleId} is already a server manager`);
        return false;
      }

      // Add role and save
      logger.debug(`[Manager Util] Adding role ${roleId} to server managers`);
      guildData.managers.push(roleId);
      return this.saveData(this.cache);
    } catch (error) {
      logger.error(`[Manager Util] Error adding server manager: ${error.message}`);
      return false;
    }
  }

  /**
   * Remove a server manager role
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Role ID to remove
   * @returns {boolean} Success status
   * @author isahooman
   */
  removeServerManager(guildId, roleId) {
    if (!this.validateInputs(guildId, roleId)) {
      logger.warn(`[Manager Util] Invalid inputs received for removeServerManager`);
      return false;
    }

    logger.info(`[Manager Util] Removing role ${roleId} as server manager in guild ${guildId}`);

    try {
      const guildData = this.getGuildData(guildId);

      // Skip if role is not a manager
      if (!guildData.managers.includes(roleId)) {
        logger.debug(`[Manager Util] Role ${roleId} is not a server manager`);
        return false;
      }

      // Remove role and save
      logger.debug(`[Manager Util] Filtering out role ${roleId} from server managers`);
      guildData.managers = guildData.managers.filter(id => id !== roleId);
      return this.saveData(this.cache);
    } catch (error) {
      logger.error(`[Manager Util] Error removing server manager: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if a user is a role manager for a specific role
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Role ID
   * @param {string} userId - User ID
   * @returns {boolean} True if user is a role manager
   * @author isahooman
   */
  isRoleManager(guildId, roleId, userId) {
    if (!this.validateInputs(guildId, roleId, userId)) {
      logger.warn(`[Manager Util] Invalid inputs received for isRoleManager`);
      return false;
    }

    // Get manager data for the guild
    logger.debug(`[Manager Util] Checking if user ${userId} is a role manager for role ${roleId} in guild ${guildId}`);
    const guildData = this.getGuildData(guildId);

    // Check if role exists in guild data
    if (!guildData.roles[roleId] || !Array.isArray(guildData.roles[roleId])) {
      logger.debug(`[Manager Util] Role ${roleId} does not exist or has no managers in guild ${guildId}`);
      return false;
    }

    // Check if user is a manager for the role
    return guildData.roles[roleId].includes(userId);
  }

  /**
   * Check if a user is a server manager
   * @param {object} member - Discord guild member
   * @returns {boolean} True if user is a server manager
   * @author isahooman
   */
  isServerManager(member) {
    if (!member?.guild?.id) {
      logger.warn('[Manager Util] Invalid inputs received for isServerManager');
      return false;
    }

    const guildId = member.guild.id;
    const userId = member.id;

    // Get guild data
    const guildData = this.getGuildData(guildId);

    // Check if user has any of the server manager roles
    const isManager = guildData.managers.some(roleId => member.roles.cache.has(roleId));

    logger.debug(`[Manager Util] Member ${userId} ${isManager ? 'is' : 'is not'} a server manager`);
    return isManager;
  }

  /**
   * Check if a user has management permissions (admin, guild owner, or server manager)
   * @param {object} member - Discord guild member
   * @returns {boolean} True if user is a server admin
   * @author isahooman
   */
  isServerAdmin(member) {
    if (!member?.guild?.id) {
      logger.warn('[Manager Util] Invalid member object received for isServerAdmin');
      return false;
    }

    const { guild, id: userId } = member;
    const userTag = member.user?.tag || 'Unknown';

    logger.debug(`[Manager Util] Checking management permissions for user ${userId} (${userTag})`);

    // Check if user is the guild owner
    if (userId === guild.ownerId) {
      logger.debug(`[Manager Util] ${userTag} is the guild owner and has management permissions`);
      return true;
    }

    // Check if the user has admin permissions
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      logger.debug(`[Manager Util] ${userTag} has Administrator permission and has management permissions`);
      return true;
    }

    // Check if the user is a server manager
    if (this.isServerManager(member)) {
      logger.debug(`[Manager Util] ${userTag} is a server manager and has management permissions`);
      return true;
    }

    // No management permission
    logger.debug(`[Manager Util] ${userTag} has no management permissions`);
    return false;
  }

  /**
   * Check if a user has permission to manage a role
   * @param {object} member - Discord guild member
   * @param {object} role - Discord role
   * @returns {boolean} If the user has permission to manage the role
   * @author isahooman
   */
  checkPermission(member, role) {
    if (!member || !role || !member.guild || !role.id) {
      logger.warn('[Manager Util] Invalid inputs received for checkPermission');
      return false;
    }

    const { guild, id: userId } = member;
    const userTag = member.user?.tag || 'Unknown';
    const roleName = role.name || 'Unknown Role';
    const guildId = guild.id;

    logger.debug(`[Manager Util] Checking permissions for user ${userId} (${userTag}) to manage role ${role.id} (${roleName})`);

    // Check if user is the guild owner
    if (userId === guild.ownerId) {
      logger.debug(`[Manager Util] ${userTag} is the guild owner and can manage ${roleName}`);
      return true;
    }
    // Check if the user has admin permissions
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      logger.debug(`[Manager Util] ${userTag} has Administrator permission and can manage ${roleName}`);
      return true;
    }
    // Check if the user has ManageRoles and is higher than the target role
    if (member.permissions.has(PermissionFlagsBits.ManageRoles) && member.roles.highest.position > role.position) {
      logger.debug(`[Manager Util] ${userTag} has ManageRoles permission and is higher than ${roleName}`);
      return true;
    }
    // Check if the user is a server manager
    if (this.isServerManager(member)) {
      logger.debug(`[Manager Util] ${userTag} is a server manager and can manage ${roleName}`);
      return true;
    }
    // Check if the user is a role manager for the specific role
    if (this.isRoleManager(guildId, role.id, userId)) {
      logger.debug(`[Manager Util] ${userTag} is a role manager for ${roleName}`);
      return true;
    }
    // No permission
    logger.debug(`[Manager Util] ${userTag} has no permissions to manage ${roleName}`);
    return false;
  }

  /**
   * Get all managers for a specific role
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Role ID
   * @returns {string[]} Array of user IDs that manage the role
   * @author isahooman
   */
  getRoleManagers(guildId, roleId) {
    if (!this.validateInputs(guildId, roleId)) {
      logger.warn(`[Manager Util] Invalid inputs received for getRoleManagers`);
      return [];
    }

    // Get guild data and return managers for the role
    logger.debug(`[Manager Util] Getting managers for role ${roleId} in guild ${guildId}`);
    const guildData = this.getGuildData(guildId);
    const managers = guildData.roles[roleId] || [];

    logger.info(`[Manager Util] Role ${roleId} has ${managers.length} managers in guild ${guildId}`);
    return managers;
  }

  /**
   * Get all managed roles in a guild
   * @param {string} guildId - Discord guild ID
   * @returns {string[]} Array of managed role IDs
   * @author isahooman
   */
  getManagedRoles(guildId) {
    if (!this.validateInputs(guildId)) {
      logger.warn(`[Manager Util] Invalid inputs received for getManagedRoles`);
      return [];
    }

    // Get guild data and return managed roles
    logger.debug(`[Manager Util] Getting all managed roles in guild ${guildId}`);
    const guildData = this.getGuildData(guildId);
    const roles = Object.keys(guildData.roles || {});

    logger.info(`[Manager Util] Guild ${guildId} has ${roles.length} managed roles`);
    return roles;
  }

  /**
   * Get all server manager roles in a guild
   * @param {string} guildId - Discord guild ID
   * @returns {string[]} Array of server manager role IDs
   * @author isahooman
   */
  getServerManagers(guildId) {
    if (!this.validateInputs(guildId)) {
      logger.warn(`[Manager Util] Invalid inputs received for getServerManagers`);
      return [];
    }

    // Get guild data and return server manager roles
    logger.info(`[Manager Util] Getting all server manager roles for guild: ${guildId}`);
    const guildData = this.getGuildData(guildId);
    const managers = guildData.managers || [];

    logger.debug(`[Manager Util] Guild ${guildId} has ${managers.length} server manager roles`);
    return managers;
  }
}

module.exports = new RoleManager();
