const { PermissionFlagsBits } = require('discord.js');
const dbHandler = require('../core/dbHandler');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');

const PREVIEWS_DIR = path.join(__dirname, '../../../output/previews/');

class RoleManager {
  constructor() {
    this.db = dbHandler;
  }

  /**
   * Validate that inputs are non-empty strings
   * @param {...string} inputs - Strings to validate
   * @returns {boolean} Whether all inputs are valid
   * @author isahooman
   * @private
   */
  validateInputs(...inputs) {
    return inputs.every(input => typeof input === 'string' && input.trim());
  }

  /**
   * Add a role manager
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Discord role ID
   * @param {string} target - Discord user ID
   * @param {object} user - User requesting manager addition
   * @returns {Promise<boolean>} Success status
   * @author isahooman
   */
  async addRoleManager(guildId, roleId, target, user) {
    if (!this.validateInputs(guildId, roleId, target)) return false;
    if (user && !this.isServerAdmin(user)) return false;

    const success = await this.db.addRoleManager(guildId, roleId, target);
    if (success) logger.info(`[Role Manager] Added user ${target} as manager for role ${roleId}`);
    return success;
  }

  /**
   * Remove a role manager
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Discord role ID
   * @param {string} target - Discord user ID
   * @param {object} user - User requesting manager removal
   * @returns {Promise<boolean>} Success status
   * @author isahooman
   */
  async removeRoleManager(guildId, roleId, target, user) {
    if (!this.validateInputs(guildId, roleId, target)) return false;
    if (user && !this.isServerAdmin(user)) return false;

    const success = await this.db.removeRoleManager(guildId, roleId, target);
    if (success) logger.info(`[Role Manager] Removed user ${target} as manager for role ${roleId}`);
    return success;
  }

  /**
   * Add a server manager role
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Discord role ID
   * @returns {Promise<boolean>} Success status
   * @author isahooman
   */
  addServerManager(guildId, roleId) {
    return this.validateInputs(guildId, roleId) ? this.db.addServerManager(guildId, roleId) : false;
  }

  /**
   * Remove a server manager role
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Discord role ID
   * @returns {Promise<boolean>} Success status
   * @author isahooman
   */
  removeServerManager(guildId, roleId) {
    return this.validateInputs(guildId, roleId) ? this.db.removeServerManager(guildId, roleId) : false;
  }

  /**
   * Check if a user is a role manager for a specific role
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Discord role ID
   * @param {string} userId - Discord user ID
   * @returns {Promise<boolean>} True if user is a role manager
   * @author isahooman
   */
  isRoleManager(guildId, roleId, userId) {
    return this.validateInputs(guildId, roleId, userId) ? this.db.isRoleManager(guildId, roleId, userId) : false;
  }

  /**
   * Check if a user is a server manager
   * @param {object} member - Discord guild member
   * @returns {Promise<boolean>} True if user is a server manager
   * @author isahooman
   */
  isServerManagerRole(member) {
    if (!member?.guild?.id) return false;
    const userRoleIds = Array.from(member.roles.cache.keys());
    return this.db.isServerManager(member.guild.id, userRoleIds);
  }

  /**
   * Check if a user has admin permissions (server owner or Administrator permission)
   * @param {object} member - Discord guild member
   * @returns {boolean} True if user is a server admin
   * @author isahooman
   */
  isServerAdmin(member) {
    if (!member?.guild?.id) return false;
    const { guild, id: userId } = member;
    return userId === guild.ownerId || member.permissions.has(PermissionFlagsBits.Administrator);
  }

  /**
   * Check if a user is a server manager (admin or has server manager role)
   * @param {object} member - Discord guild member
   * @returns {boolean} True if user is a server manager
   * @author isahooman
   */
  isServerManager(member) {
    if (!member?.guild?.id) return false;
    if (this.isServerAdmin(member)) return true;
    return this.isServerManagerRole(member);
  }

  /**
   * Check if a user has permission to manage a role
   * @param {object} member - Discord guild member
   * @param {object} role - Discord role
   * @returns {Promise<boolean>} If the user has permission to manage the role
   * @author isahooman
   */
  checkPermission(member, role) {
    if (!member || !role || !member.guild || !role.id) return false;

    const { guild, id: userId } = member;

    // Check if user is the guild owner or has admin permissions
    if (this.isServerAdmin(member)) return true;

    // Check if the user has ManageRoles and is higher than the target role
    if (member.permissions.has(PermissionFlagsBits.ManageRoles) && member.roles.highest.position > role.position) return true;

    // Check if the user is a server manager or role manager for the specific role
    return this.isServerManager(member) || this.isRoleManager(guild.id, role.id, userId);
  }

  /**
   * Get all managers for a specific role
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Discord role ID
   * @returns {Promise<string[]>} Array of user IDs that manage the role
   * @author isahooman
   */
  getRoleManagers(guildId, roleId) {
    return this.validateInputs(guildId, roleId) ? this.db.getRoleManagers(guildId, roleId) : [];
  }

  /**
   * Get all managed roles in a guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<string[]>} Array of managed role IDs
   * @author isahooman
   */
  getManagedRoles(guildId) {
    return this.validateInputs(guildId) ? this.db.getManagedRoles(guildId) : [];
  }

  /**
   * Get all server manager roles in a guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<string[]>} Array of server manager role IDs
   * @author isahooman
   */
  getServerManagers(guildId) {
    return this.validateInputs(guildId) ? this.db.getServerManagers(guildId) : [];
  }

  /**
   * Clean up role preview data for a user
   * @param {string} userId - Discord user ID
   * @param {string} messageId - Discord message ID to cleanup global data
   * @returns {Promise<void>}
   * @author isahooman
   */
  async cleanupRolePreview(userId, messageId = null) {
    try {
      // Clean up preview files
      if (fs.existsSync(PREVIEWS_DIR)) {
        const files = fs.readdirSync(PREVIEWS_DIR);
        files.forEach(file => {
          if (file.startsWith(userId)) {
            const filePath = path.join(PREVIEWS_DIR, file);
            fs.unlinkSync(filePath);
          }
        });
      }

      // Clean up global data
      if (global.rolePreviewData) {
        if (messageId) {
          // Clean up data linked to the message ID
          delete global.rolePreviewData[messageId];
        } else {
          // Search for all global data linked to the user ID
          Object.keys(global.rolePreviewData).forEach(msgId => {
            if (global.rolePreviewData[msgId]?.userId === userId) {
              delete global.rolePreviewData[msgId];
            }
          });
        }
      }

      logger.info(`[Role Manager] Cleaned up preview data for user ${userId}${messageId ? ` (message: ${messageId})` : ''}`);
    } catch (error) {
      logger.error(`Error cleaning up role preview data: ${error.message}`);
    }
  }

  /**
   * Validate database roles against current Discord roles and clean up invalid entries
   * @param {Client} client - Discord client instance
   * @returns {Promise<{removedServerManagers: number, removedRoleManagers: number}>} Cleanup statistics
   * @author isahooman
   */
  async validateDatabaseRoles(client) {
    const { serverManagers, roleManagers } = await this.db.getAllDatabaseRoles();
    const guildIds = new Set([
      ...serverManagers.map(m => m.guild_id),
      ...roleManagers.map(m => m.guild_id),
    ]);

    const validRoles = new Map();
    const validGuilds = new Set();

    for (const guildId of guildIds) {
      const guild = client.guilds.cache.get(guildId);
      if (guild?.available) {
        validRoles.set(guildId, new Set(guild.roles.cache.keys()));
        validGuilds.add(guildId);
      }
    }

    return this.db.validateRoles(validRoles, validGuilds);
  }
}

module.exports = new RoleManager();
