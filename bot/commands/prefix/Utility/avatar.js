const { EmbedBuilder } = require('discord.js');
const logger = require('../../../components/util/logger.js');
const Search = require('../../../components/util/search.js');

module.exports = {
  name: 'avatar',
  usage: 'avatar [@user|user ID|username]',
  category: 'Utility',
  aliases: ['av', 'pfp'],
  allowDM: false,
  description: 'Display a user\'s avatar image',
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

      logger.debug(`[Avatar Command] Retrieving avatar for user ${user.tag}`);

      // Create and send the embed
      const embed = new EmbedBuilder()
        .setTitle(`${user.displayName}'s Avatar`)
        .setURL(user.displayAvatarURL({ dynamic: true, size: 4096 }))
        .setImage(user.displayAvatarURL({ dynamic: true, size: 4096 }));

      await message.channel.send({ embeds: [embed] });
      logger.info(`[Avatar Command] Avatar sent successfully for user ${user.tag} in ${message.guild.name}`);
    } catch (error) {
      throw new Error(`Error retrieving avatar: ${error.message}`);
    }
  },
};
