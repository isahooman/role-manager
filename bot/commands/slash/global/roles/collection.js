const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../../../components/util/logger');
const { cache } = require('../../../../bot.js');
const roleManager = require('../../../../components/util/role-manager.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('collection')
    .setDescription('View a checklist of roles')
    .addUserOption(option => option.setName('user')
      .setDescription('Whose role collection to view?')
      .setRequired(false)),

  async execute(interaction) {
    try {
      if (!interaction.guild) return await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });

      // Get target user
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const isSelf = targetUser.id === interaction.user.id;
      logger.debug(`Collection requested for ${targetUser.tag} in ${interaction.guild.name}, isSelf: ${isSelf}`);

      const targetMember = interaction.guild.members.cache.get(targetUser.id);

      if (!targetMember) {
        logger.warn(`User ${targetUser.tag} (${targetUser.id}) not found in guild ${interaction.guild.name}`);
        return await interaction.reply({ content: 'Could not find that user in this server.', ephemeral: true });
      }

      // Load guild's managed roles
      const guildId = interaction.guild.id;
      const managedRoleIds = await roleManager.getManagedRoles(guildId);

      // Check if the guild has managed roles
      if (!managedRoleIds.length) {
        logger.debug(`[Collection Command] No managed roles for guild: ${interaction.guild.name}`);
        return await interaction.reply({ content: 'No managed roles are configured for this server.', ephemeral: true });
      }

      // Get all managed roles
      const managedRoles = managedRoleIds
        .map(id => cache.getRole(id) || interaction.guild.roles.cache.get(id))
        .filter(Boolean)
        .sort((a, b) => b.position - a.position);

      if (!managedRoles.length) return await interaction.reply({ content: 'No valid managed roles found for this server.', ephemeral: true });

      // Get member's roles and categorize them
      const memberRoles = targetMember.roles?.cache || new Map();
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
        .setColor(userCount > 0 ? targetMember.displayHexColor : '#0099ff')
        .setTitle(`${targetUser.username}'s Role Collection`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setDescription(
          `**Collection Progress:** ${percent}% (${userCount}/${totalCount})\n` +
          `\`${progressBar}\`\n\n` +
          `**Roles ${isSelf ? 'you have' : 'they have'}:**\n${acquired.length ? acquired.join('\n') : 'None yet'}\n\n` +
          `**Roles ${isSelf ? 'you\'re' : 'they\'re'} missing:**\n${missing.length ? missing.join('\n') : 'None'}`,
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp();

      logger.debug(`[Collection Command] Displaying collection for ${targetUser.tag} (${userCount}/${totalCount} roles)`);
      return await interaction.reply({ embeds: [embed] });
    } catch (error) {
      throw new Error(`[Collection Command] ${error.message}`);
    }
  },
};
