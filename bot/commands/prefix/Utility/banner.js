const { EmbedBuilder } = require('discord.js');
const logger = require('../../../components/util/logger.js');
const Search = require('../../../components/util/search.js');

module.exports = {
  name: 'banner',
  usage: 'banner [@user|user ID|username]',
  category: 'Utility',
  allowDM: false,
  description: 'Display a user\'s banner image',
  async execute(message, args) {
    try {
      let userId;

      // Handle reply-to messages
      if (message.reference) {
        try {
          const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
          userId = repliedMessage.author.id;
        } catch (error) {
          throw new Error(`Failed to fetch the replied-to message: ${error.message}`);
        }
      } else {
        // Search for the user based on arguments
        userId = await Search.member(message, args.join(' '));
        if (!userId && args.length > 0) return message.channel.send('No users found.');
      }

      // Fetch the target user, default to user if no ID provided
      const user = await message.client.users.fetch(userId || message.author.id);

      // Check if the user has a banner
      if (!user.bannerURL()) {
        logger.warn(`[Banner Command] User ${user.tag} does not have a banner in: ${message.guild.name}`);
        return message.channel.send('This user does not have a banner.');
      }

      logger.debug(`[Banner Command] Retrieving banner for user ${user.tag}`);

      // Create and send the embed
      const embed = new EmbedBuilder()
        .setTitle(`${user.displayName}'s Banner`)
        .setURL(user.bannerURL({ dynamic: true, size: 4096 }))
        .setImage(user.bannerURL({ dynamic: true, size: 4096 }));

      await message.channel.send({ embeds: [embed] });
      logger.info(`[Banner Command] Banner sent successfully for user ${user.tag} in ${message.guild.name}`);
    } catch (error) {
      throw new Error(`Error retrieving banner: ${error.message}`);
    }
  },
};
