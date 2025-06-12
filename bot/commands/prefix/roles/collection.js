const { EmbedBuilder } = require('discord.js');
const logger = require('../../../components/util/logger.js');
const { cache } = require('../../../bot.js');
const Search = require('../../../components/util/search.js');
const roleManager = require('../../../components/util/manager.js');

module.exports = {
  name: 'collection',
  usage: 'collection [user]',
  category: 'roles',
  allowDM: false,
  description: 'View a user\'s managed role collection.',

  async execute(message, args) {
    try {
      // Load guild's managed roles
      const guildId = message.guild.id;
      const managedRoleIds = roleManager.getManagedRoles(guildId);

      // Check if the guild has managed roles
      if (!managedRoleIds.length) {
        logger.debug(`[Collection Command] No managed roles for guild: ${message.guild.name}`);
        return message.reply('No managed roles are configured for this server.');
      }

      // Find target user
      let target = message.member;
      let isSelf = true;

      if (args.length > 0) {
        const query = args.join(' ');
        logger.debug(`[Collection Command] Searching for user: ${query}`);

        const targetId = await Search.member(message, query);
        if (!targetId) return message.reply(`No user found matching "${query}".`);

        target = cache.getMember(targetId) || message.guild.members.cache.get(targetId);
        if (!target) return message.reply(`Couldn't fetch ${target.name}'s data.`);

        isSelf = message.author.id === target.id;
        logger.debug(`[Collection Command] Found user: ${target.user.tag} (${target.id})`);
      }

      // Get all managed roles
      const managedRoles = managedRoleIds
        .map(id => cache.getRole(id) || message.guild.roles.cache.get(id))
        .filter(Boolean)
        .sort((a, b) => b.position - a.position);

      if (!managedRoles.length) return message.reply('No valid managed roles found for this server.');

      // Get member's roles and categorize them
      const memberRoles = target.roles?.cache || new Map();
      const acquired = [];
      const missing = [];

      managedRoles.forEach(role => {
        (memberRoles.has(role.id) ? acquired : missing).push(`<@&${role.id}>`);
      });

      // Calculate progress statistics
      const userCount = acquired.length;
      const totalCount = managedRoles.length;
      const percent = ((userCount / totalCount) * 100).toFixed(1);

      // Create visual progress bar
      const barLength = 20;
      const filledLength = Math.round((percent / 100) * barLength);
      const progressBar = `${'■'.repeat(filledLength)}${'□'.repeat(barLength - filledLength)}`;

      // Create and send embed response
      const embed = new EmbedBuilder()
        .setColor(userCount > 0 ? target.displayHexColor : '#0099ff')
        .setTitle(`${target.user.username}'s Role Collection`)
        .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
        .setDescription(
          `**Collection Progress:** ${percent}% (${userCount}/${totalCount})\n` +
          `\`${progressBar}\`\n\n` +
          `**Roles ${isSelf ? 'you have' : 'they have'}:**\n${acquired.length ? acquired.join('\n') : 'None yet'}\n\n` +
          `**Roles ${isSelf ? 'you\'re' : 'they\'re'} missing:**\n${missing.length ? missing.join('\n') : 'None'}`,
        )
        .setFooter({ text: `Requested by ${message.author.tag}` })
        .setTimestamp();

      logger.debug(`[Collection Command] Displaying collection for ${target.user.tag} (${userCount}/${totalCount} roles)`);
      return message.reply({ embeds: [embed] });
    } catch (error) {
      throw new Error(`[Collection Command] ${error.message}`);
    }
  },
};
