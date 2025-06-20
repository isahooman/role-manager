const { EmbedBuilder } = require('discord.js');
const logger = require('../../../components/util/logger');
const Search = require('../../../components/util/search');
const { cache } = require('../../../bot');

module.exports = {
  name: 'inrole',
  usage: 'inrole <role>',
  category: 'roles',
  nsfw: false,
  allowDM: false,
  description: 'View all users in a role',

  async execute(message, args) {
    // Check if user provided a role
    if (args.length === 0) return message.channel.send('Please provide a role name.');

    // Join args and search for the role
    const roleQuery = args.join(' ');
    const role = Search.role(message, roleQuery);

    // If no role, notify user and quit
    if (!role) return message.channel.send(`Could not find a role matching "${roleQuery}"`);

    // If a role is foune, notify user and start fetching members
    const initialMessage = await message.channel.send('Fetching members...');

    try {
      // Search bot cache for guild members
      const cachedMembers = cache.getGuildMembers(message.guild.id);

      // If cache is empty, fetch all members from the guild
      const allMembers = cachedMembers?.length > 0 ? cachedMembers : message.guild.members.cache.toArray();

      // Filter all members by the target role
      const roleMembers = allMembers
        .filter(member => member.roles.cache.has(role.id))
        .sort((a, b) => a.user.username.localeCompare(b.user.username));

      // If no members found with the role, notify user and quit
      if (roleMembers.length === 0) return initialMessage.edit(`There is no one in the role ${role.name}`);

      // Setup pagination
      const membersPerPage = 50;
      const pages = Math.ceil(roleMembers.length / membersPerPage);
      const hasReactPermission = message.channel.permissionsFor(message.guild.members.me)?.has('AddReactions');
      let currentPage = 0;

      // Create results embed
      const generateEmbed = (page) => {
        // Calculate which members to show on the current page
        const start = page * membersPerPage;
        const end = Math.min(start + membersPerPage, roleMembers.length);

        // Format member list
        let description = roleMembers.slice(start, end)
          .map(member => `${member.toString()} | ${member.user.username}`)
          .join('\n');

        // Add warning if the bot cant add reactions
        if (pages > 1 && !hasReactPermission && page === 0) description = `I don't have the \`Add Reactions\` permission, here's the first 50 members with the role!\n\n${description}`;

        // Create and send the embed
        return new EmbedBuilder()
          .setTitle(`${role.name} (${roleMembers.length})`)
          .setDescription(description)
          .setColor(role.color || 0x000000)
          .setFooter({ text: `Page ${page + 1}/${pages}` });
      };

      // Edit the initial message with the embed
      await initialMessage.edit({ content: '', embeds: [generateEmbed(currentPage)] });

      // dont create pagination if only one page or no reaction permission
      if (pages === 1 || !hasReactPermission) {
        logger.info(`[InRole Command] Displayed ${roleMembers.length} members with role: ${role.name}`);
        return;
      }

      await Promise.all([
        initialMessage.react('⬅️'),
        initialMessage.react('➡️'),
      ]);

      // Setup reaction collector
      const collector = initialMessage.createReactionCollector({
        filter: (reaction, user) => ['⬅️', '➡️'].includes(reaction.emoji.name) && user.id === message.author.id,
        time: 60000,
      });

      // Handle reactions
      collector.on('collect', async(reaction, user) => {
        // Try to remove the user's reaction
        try {
          await reaction.users.remove(user.id);
        } catch (error) {
          logger.debug(`[InRole Command] Could not remove reaction: ${error.message}`);
        }

        // Update current page based on reaction
        if (reaction.emoji.name === '⬅️' && currentPage > 0) currentPage--;
        else if (reaction.emoji.name === '➡️' && currentPage < pages - 1) currentPage++;

        // Update the embed with the new page
        await initialMessage.edit({ embeds: [generateEmbed(currentPage)] });
      });

      // Remove all reactions when collector ends
      collector.on('end', async() => {
        await initialMessage.reactions.removeAll();
      });

      logger.info(`[InRole Command] Displayed ${roleMembers.length} members with role: ${role.name} across ${pages} pages`);
    } catch (error) {
      throw new Error(`[InRole Command] Error fetching members for role ${role.name}: ${error.message}`);
    }
  },
};
