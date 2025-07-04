const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../util/logger');

class DbHandler {
  constructor() {
    this.db = null;
    this.dbPath = path.join(process.cwd(), 'config', 'bot', 'role-manager.db');
  }

  /**
   * Connect to the database and initialize tables
   * @author isahooman
   */
  async connect() {
    if (this.db) return;

    this.db = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) reject(err);
        else resolve(db);
      });
    });

    await this.runQuery('PRAGMA foreign_keys = ON');
    await this.createTables();
    logger.info('[DB Handler] Database connected successfully');
  }

  /**
   * Disconnect from the database
   * @returns {Promise<void>}
   * @author isahooman
   */
  disconnect() {
    if (!this.db) return Promise.resolve();

    return new Promise((resolve) => {
      this.db.close(() => {
        this.db = null;
        resolve();
      });
    });
  }

  /**
   * Create tables if they do not exist
   * @author isahooman
   */
  async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS server_managers (
        guild_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        PRIMARY KEY (guild_id, role_id)
      )`,
      `CREATE TABLE IF NOT EXISTS role_managers (
        guild_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        PRIMARY KEY (guild_id, role_id, user_id)
      )`,
    ];

    for (const sql of tables) await this.runQuery(sql);
  }

  /**
   * Execute a SQL statement
   * @param {string} sql - The SQL statement to execute
   * @param {Array} [params=[]] - Parameters for the SQL statement
   * @returns {Promise<{changes: number}>} Result object containing number of changes
   * @author isahooman
   */
  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function runQueryCallback(err) {
        if (err) reject(err);
        // eslint-disable-next-line no-invalid-this
        else resolve({ changes: this.changes || 0 });
      });
    });
  }

  /**
   * Get a single row from the database
   * @param {string} sql - The SQL SELECT query
   * @param {Array} [params=[]] - Parameters for the SQL query
   * @returns {Promise<object|null>} The first matching row or null
   * @author isahooman
   */
  getSingleRow(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }

  /**
   * Get all rows from the database that match the query
   * @param {string} sql - The SQL SELECT query
   * @param {Array} [params=[]] - Parameters for the SQL query
   * @returns {Promise<Array<object>>} Array of matching rows
   * @author isahooman
   */
  getAllRows(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Add a server manager role to a guild
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Discord role ID
   * @returns {Promise<boolean>} True if added successfully
   * @author isahooman
   */
  async addServerManager(guildId, roleId) {
    await this.connect();
    const result = await this.runQuery(
      'INSERT OR IGNORE INTO server_managers (guild_id, role_id) VALUES (?, ?)',
      [guildId, roleId],
    );
    return result.changes > 0;
  }

  /**
   * Remove a server manager role from a guild
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Discord role ID
   * @returns {Promise<boolean>} True if removed successfully
   * @author isahooman
   */
  async removeServerManager(guildId, roleId) {
    await this.connect();
    const result = await this.runQuery(
      'DELETE FROM server_managers WHERE guild_id = ? AND role_id = ?',
      [guildId, roleId],
    );
    return result.changes > 0;
  }

  /**
   * Add a user as a manager for a specific role
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Discord role ID
   * @param {string} userId - Discord user ID
   * @returns {Promise<boolean>} True if added successfully
   * @author isahooman
   */
  async addRoleManager(guildId, roleId, userId) {
    await this.connect();
    const result = await this.runQuery(
      'INSERT OR IGNORE INTO role_managers (guild_id, role_id, user_id) VALUES (?, ?, ?)',
      [guildId, roleId, userId],
    );
    return result.changes > 0;
  }

  /**
   * Remove a user from being a manager for a specific role
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Discord role ID
   * @param {string} userId - Discord user ID
   * @returns {Promise<boolean>} True if removed successfully
   * @author isahooman
   */
  async removeRoleManager(guildId, roleId, userId) {
    await this.connect();
    const result = await this.runQuery(
      'DELETE FROM role_managers WHERE guild_id = ? AND role_id = ? AND user_id = ?',
      [guildId, roleId, userId],
    );
    return result.changes > 0;
  }

  /**
   * Get all roles that have assigned managers in a guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<string[]>} Array of role IDs that have individual managers
   * @author isahooman
   */
  async getManagedRoles(guildId) {
    await this.connect();
    const roles = await this.getAllRows(
      'SELECT DISTINCT role_id FROM role_managers WHERE guild_id = ?',
      [guildId],
    );
    return roles.map(row => row.role_id);
  }

  /**
   * Get all server manager roles in a guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<string[]>} Array of role IDs that are server managers
   * @author isahooman
   */
  async getServerManagers(guildId) {
    await this.connect();
    const managers = await this.getAllRows(
      'SELECT role_id FROM server_managers WHERE guild_id = ?',
      [guildId],
    );
    return managers.map(row => row.role_id);
  }

  /**
   * Get all users who can manage a specific role
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Discord role ID
   * @returns {Promise<string[]>} Array of user IDs who can manage this role
   * @author isahooman
   */
  async getRoleManagers(guildId, roleId) {
    await this.connect();
    const managers = await this.getAllRows(
      'SELECT user_id FROM role_managers WHERE guild_id = ? AND role_id = ?',
      [guildId, roleId],
    );
    return managers.map(row => row.user_id);
  }

  /**
   * Check if a user is a server manager
   * @param {string} guildId - Discord guild ID
   * @param {string[]} userRoleIds - Array of role IDs the user has
   * @returns {Promise<boolean>} True if the user is a server manager
   * @author isahooman
   */
  async isServerManager(guildId, userRoleIds) {
    if (!userRoleIds || userRoleIds.length === 0) return false;

    await this.connect();
    const placeholders = userRoleIds.map(() => '?').join(',');
    const result = await this.getSingleRow(
      `SELECT 1 FROM server_managers WHERE guild_id = ? AND role_id IN (${placeholders})`,
      [guildId, ...userRoleIds],
    );
    return !!result;
  }

  /**
   * Check if a user is a role manager for a specific role
   * @param {string} guildId - Discord guild ID
   * @param {string} roleId - Discord role ID
   * @param {string} userId - Discord user ID
   * @returns {Promise<boolean>} True if the user can manage this role
   * @author isahooman
   */
  async isRoleManager(guildId, roleId, userId) {
    await this.connect();
    const result = await this.getSingleRow(
      'SELECT 1 FROM role_managers WHERE guild_id = ? AND role_id = ? AND user_id = ?',
      [guildId, roleId, userId],
    );
    return !!result;
  }

  /**
   * Compare stored roles with valid roles and clean up invalid entries
   * @param {Map} validRoles - Map of valid role IDs by guild
   * @param {Set} validGuilds - Set of valid guild IDs (avoid removing inaccessible guilds)
   * @returns {Promise<{removedServerManagers: number, removedRoleManagers: number}>} Cleanup statistics
   * @author isahooman
   */
  async validateRoles(validRoles, validGuilds) {
    await this.connect();

    const serverManagers = await this.getAllRows('SELECT guild_id, role_id FROM server_managers');
    const roleManagers = await this.getAllRows('SELECT guild_id, role_id, user_id FROM role_managers');

    let removedServerManagers = 0;
    let removedRoleManagers = 0;

    // Validate server managers
    for (const manager of serverManagers) {
      if (!validGuilds.has(manager.guild_id)) continue;

      const guildValidRoles = validRoles.get(manager.guild_id);
      if (!guildValidRoles || !guildValidRoles.has(manager.role_id)) {
        const result = await this.runQuery(
          'DELETE FROM server_managers WHERE guild_id = ? AND role_id = ?',
          [manager.guild_id, manager.role_id],
        );
        if (result.changes > 0) removedServerManagers++;
      }
    }

    // Validate role managers
    for (const manager of roleManagers) {
      if (!validGuilds.has(manager.guild_id)) continue;

      const guildValidRoles = validRoles.get(manager.guild_id);
      if (!guildValidRoles || !guildValidRoles.has(manager.role_id)) {
        const result = await this.runQuery(
          'DELETE FROM role_managers WHERE guild_id = ? AND role_id = ? AND user_id = ?',
          [manager.guild_id, manager.role_id, manager.user_id],
        );
        if (result.changes > 0) removedRoleManagers++;
      }
    }

    return { removedServerManagers, removedRoleManagers };
  }

  /**
   * Get all roles stored in the database for validation purposes
   * @returns {Promise<{serverManagers: Array, roleManagers: Array}>} All roles in database
   * @author isahooman
   */
  async getAllDatabaseRoles() {
    await this.connect();
    const serverManagers = await this.getAllRows('SELECT DISTINCT guild_id, role_id FROM server_managers');
    const roleManagers = await this.getAllRows('SELECT DISTINCT guild_id, role_id FROM role_managers');
    return { serverManagers, roleManagers };
  }
}

module.exports = new DbHandler();
