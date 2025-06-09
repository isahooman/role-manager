const fuse = require('fuse.js');
const { cache } = require('../../bot.js');
const logger = require('./logger.js');

class Search {
  /**
   * Searches for a Discord user by username, nickname, mention, or id
   * @param {import('discord.js').Message} message - The Discord message object
   * @param {string} query - The user to look for
   * @returns {Promise<string>} Returns the user ID of the closest found user or null if not found
   */
  static async member(message, query) {
    // Return self if no query is provided
    if (!query || query.trim().length === 0) return message.member.user.id;

    // If the query is a mention, return the mentioned user
    if (message.mentions.members.size === 1) return message.mentions.members.first().user.id;

    if (/^\d{17,20}$/.test(query)) try {
      // First check cache
      const cachedMember = cache.getMember(query);
      if (cachedMember) return cachedMember.user.id;

      // if not in cache, fetch the user
      const user = await message.client.users.fetch(query);
      return user ? user.id : null;
    } catch (error) {
      logger.error(`Error fetching user by ID ${query}: ${error.message}`);
      return null;
    }

    // Get all members from the cache that belong to this guild using the new helper method
    const cachedGuildMembers = cache.getGuildMembers(message.guild.id)
      .map(member => ({
        id: member.id,
        username: member.user.username,
        nickname: member.nickname || '',
        user: member.user,
      }));

    // If no cached members found for this guild, fall back to direct guild members
    const members = cachedGuildMembers.length > 0 ?
      cachedGuildMembers :
      Array.from(message.guild.members.cache.values()).map(member => ({
        id: member.id,
        username: member.user.username,
        nickname: member.nickname || '',
        user: member.user,
      }));

    // Log how many members were found for searching
    logger.debug(`[Member Search] Found ${members.length} members to search in guild: ${message.guild.name}`);

    // Configure fuse for fuzzy searching
    const fuseOptions = {
      keys: ['username', 'nickname'],
      threshold: 0.3,
      includeScore: true,
    };

    const fuseSearch = new fuse(members, fuseOptions);
    const results = fuseSearch.search(query);

    if (results.length > 0) {
      logger.debug(`[Member Search] Found match for query: ${query} -> ${results[0].item.username}`);
      return results[0].item.user.id;
    } else {
      logger.debug(`[Member Search] No matches found for query: ${query}`);
      return null;
    }
  }

  /**
   * Searches for the closest matching Discord role by name or ID
   * @param {import('discord.js').Message} message - A Discord message for context
   * @param {string} query - The role to look for
   * @returns {import('discord.js').Role|null} Returns the closest matching role or null if not found
   */
  static role(message, query) {
    // Return null if no query
    if (!query || query.trim().length === 0) return null;

    // Extract ID from role mention format if present
    query = query.replace(/<@&(\d+)>/g, '$1');

    // Direct ID lookup
    if (/^\d{17,20}$/.test(query)) {
      // First check the global role cache
      const cachedRole = cache.getRole(query);

      // If found in cache and belongs to the current guild, return it
      if (cachedRole && cachedRole.guild.id === message.guild.id) return cachedRole;

      // If not found in cache or not from this guild, check guild cache
      const role = message.guild.roles.cache.get(query);
      return role || null;
    }

    // Get all roles from the cache that belong to this guild using the new helper method
    const cachedGuildRoles = cache.getGuildRoles(message.guild.id)
      .map(role => ({
        id: role.id,
        name: role.name,
        role: role,
      }));

    // If no cached roles found for this guild, fall back to direct guild roles
    const roles = cachedGuildRoles.length > 0 ?
      cachedGuildRoles :
      Array.from(message.guild.roles.cache.values()).map(role => ({
        id: role.id,
        name: role.name,
        role: role,
      }));

    // Log how many roles were found for searching
    logger.debug(`[Role Search] Found ${roles.length} roles to search in guild: ${message.guild.name}`);

    // Configure fuse for fuzzy searching
    const fuseOptions = {
      keys: ['name'],
      threshold: 0.3,
      includeScore: true,
    };

    const fuseSearch = new fuse(roles, fuseOptions);
    const results = fuseSearch.search(query);

    if (results.length > 0) {
      logger.debug(`[Role Search] Found closest match for query: ${query} -> ${results[0].item.name}`);
      return results[0].item.role;
    }

    logger.debug(`[Role Search] No matches found for query: ${query}`);
    return null;
  }
}

module.exports = Search;
