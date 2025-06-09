const logger = require('./logger.js');

class CacheHandler {
  constructor() {
    this.guilds = new Map();
    this.channels = new Map();
    this.threads = new Map();
    this.members = new Map();
    this.roles = new Map();
  }

  /**
   * Updates a specific guild in the cache.
   * @param {Guild} guild The guild to update.
   * @author isahooman
   */
  updateGuild(guild) {
    this.guilds.set(guild.id, guild);
    logger.debug(`Updating guild in cache: ${guild.name} (${guild.id})`);
  }

  /**
   * Updates a specific channel in the cache.
   * @param {Channel} channel The channel to update.
   * @author isahooman
   */
  updateChannel(channel) {
    this.channels.set(channel.id, channel);
    logger.debug(`Updating channel in cache: ${channel.name} (${channel.id})`);
  }

  /**
   * Updates a specific thread in the cache.
   * @param {ThreadChannel} thread The thread to update.
   * @author isahooman
   */
  updateThread(thread) {
    this.threads.set(thread.id, thread);
    logger.debug(`Updating thread in cache: ${thread.name} (${thread.id})`);
  }

  /**
   * Updates a specific member in the cache.
   * @param {GuildMember} member The member to update.
   * @author isahooman
   */
  updateMember(member) {
    this.members.set(member.id, member);
    logger.debug(`Updating member in cache: ${member.user.tag} (${member.id})`);
  }

  /**
   * Updates a specific role in the cache.
   * @param {Role} role The role to update.
   * @author isahooman
   */
  updateRole(role) {
    this.roles.set(role.id, role);
    logger.debug(`Updating role in cache: ${role.name} (${role.id})`);
  }

  /**
   * Removes a specific guild from the cache.
   * @param {Snowflake} guildId The ID of the guild to remove.
   * @author isahooman
   */
  removeGuild(guildId) {
    this.guilds.delete(guildId);
    logger.debug(`Removing guild from cache: ${guildId}`);
  }

  /**
   * Removes a specific channel from the cache.
   * @param {Snowflake} channelId The ID of the channel to remove.
   * @author isahooman
   */
  removeChannel(channelId) {
    this.channels.delete(channelId);
    logger.debug(`Removing channel from cache: ${channelId}`);
  }

  /**
   * Removes a specific thread from the cache.
   * @param {Snowflake} threadId The ID of the thread to remove.
   * @author isahooman
   */
  removeThread(threadId) {
    this.threads.delete(threadId);
    logger.debug(`Removing thread from cache: ${threadId}`);
  }

  /**
   * Removes a specific member from the cache.
   * @param {Snowflake} memberId The ID of the member to remove.
   * @author isahooman
   */
  removeMember(memberId) {
    this.members.delete(memberId);
    logger.debug(`Removing member from cache: ${memberId}`);
  }

  /**
   * Removes a specific role from the cache.
   * @param {Snowflake} roleId The ID of the role to remove.
   * @author isahooman
   */
  removeRole(roleId) {
    this.roles.delete(roleId);
    logger.debug(`Removing role from cache: ${roleId}`);
  }

  /**
   * Caches all servers on startup.
   * @param {client} client - Discord Client
   * @author isahooman
   */
  cacheServers(client) {
    try {
      logger.debug(`Fetching guilds for caching...`);
      const guilds = client.guilds.cache;

      guilds.forEach(guild => {
        this.updateGuild(guild);
      });

      logger.info(`Cached guilds successfully`);
    } catch (error) {
      logger.error(`Error caching guilds: ${error.message}`);
    }
  }

  /**
   * Caches all channels on startup.
   * @param {client} client - Discord Client
   * @author isahooman
   */
  cacheChannels(client) {
    try {
      logger.debug(`Fetching channels for caching...`);
      const channels = client.channels.cache;

      channels.forEach(channel => {
        this.updateChannel(channel);
      });

      logger.info(`Cached channels successfully`);
    } catch (error) {
      logger.error(`Error caching channels: ${error.message}`);
    }
  }

  /**
   * Caches all threads on startup.
   * @param {client} client - Discord Client
   * @author isahooman
   */
  cacheThreads(client) {
    try {
      logger.debug(`Fetching threads for caching...`);

      client.guilds.cache.forEach(guild => {
        guild.channels.cache.forEach(channel => {
          if (channel.isThread()) this.updateThread(channel);
        });
      });

      logger.info(`Cached threads successfully`);
    } catch (error) {
      logger.error(`Error caching threads: ${error.message}`);
    }
  }

  /**
   * Caches all roles across all guilds.
   * @param {client} client - Discord Client
   * @author isahooman
   */
  cacheRoles(client) {
    try {
      logger.debug(`Fetching roles for caching...`);

      client.guilds.cache.forEach(guild => {
        guild.roles.cache.forEach(role => {
          this.updateRole(role);
        });
      });

      logger.info(`Cached roles successfully`);
    } catch (error) {
      logger.error(`Error caching roles: ${error.message}`);
    }
  }

  /**
   * Caches all members for a specific guild.
   * @param {Guild} guild The guild to cache members for.
   * @returns {Promise<void>}
   * @author isahooman
   */
  async cacheMembers(guild) {
    try {
      logger.debug(`Fetching members for guild: ${guild.name} (${guild.id})`);
      const fetchedMembers = await guild.members.fetch();

      if (!fetchedMembers) throw new Error('Fetched members are undefined or null');

      logger.debug(`Processing members for guild: ${guild.name} (${guild.id})`);

      fetchedMembers.forEach(member => {
        this.updateMember(member);
      });

      logger.info(`Cached members for guild: ${guild.name} (${guild.id})`);
    } catch (error) {
      logger.error(`Error caching members for guild: ${guild.name} (${guild.id}): ${error.message}`);
    }
  }

  /**
   * Gets a cached guild by its ID.
   * @param {Snowflake} guildId The ID of the guild to retrieve.
   * @returns {Guild | undefined} The cached guild, or undefined if not found.
   * @author isahooman
   */
  getGuild(guildId) {
    return this.guilds.get(guildId);
  }

  /**
   * Gets a cached channel by its ID.
   * @param {Snowflake} channelId The ID of the channel to retrieve.
   * @returns {Channel | undefined} The cached channel, or undefined if not found.
   * @author isahooman
   */
  getChannel(channelId) {
    return this.channels.get(channelId);
  }

  /**
   * Gets a cached thread by its ID.
   * @param {Snowflake} threadId The ID of the thread to retrieve.
   * @returns {ThreadChannel | undefined} The cached thread, or undefined if not found.
   * @author isahooman
   */
  getThread(threadId) {
    return this.threads.get(threadId);
  }

  /**
   * Gets a cached member by its ID.
   * @param {Snowflake} memberId The ID of the member to retrieve.
   * @returns {GuildMember | undefined} The cached member, or undefined if not found.
   * @author isahooman
   */
  getMember(memberId) {
    return this.members.get(memberId);
  }

  /**
   * Gets a cached role by its ID.
   * @param {Snowflake} roleId The ID of the role to retrieve.
   * @returns {Role | undefined} The cached role, or undefined if not found.
   * @author isahooman
   */
  getRole(roleId) {
    return this.roles.get(roleId);
  }

  /**
   * Gets all cached roles for a specific guild.
   * @param {Snowflake} guildId The ID of the guild to retrieve roles for.
   * @returns {Role[]} Array of cached roles for the guild.
   * @author isahooman
   */
  getGuildRoles(guildId) {
    return Array.from(this.roles.values())
      .filter(role => role.guild.id === guildId);
  }

  /**
   * Gets all cached members for a specific guild.
   * @param {Snowflake} guildId The ID of the guild to retrieve members for.
   * @returns {GuildMember[]} Array of cached members for the guild.
   * @author isahooman
   */
  getGuildMembers(guildId) {
    return Array.from(this.members.values())
      .filter(member => member.guild.id === guildId);
  }
}

module.exports = CacheHandler;
