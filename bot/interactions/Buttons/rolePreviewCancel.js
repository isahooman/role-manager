const logger = require('../../components/util/logger');
const roleManager = require('../../components/util/role-manager');

module.exports = {
  async button(interaction) {
    try {
      // Acknowledge the interaction to prevent timeout
      await interaction.deferUpdate();

      // Get the preview data from global storage
      const previewData = global.rolePreviewData?.[interaction.message.id];
      if (!previewData) return interaction.editReply({
        content: 'Preview data has expired. Please rerun the command.',
        files: [],
        components: [],
      });

      const { userId } = previewData;

      // Verify this is the original user
      if (interaction.user.id !== userId) return;

      await interaction.editReply({
        content: 'Role customization cancelled.',
        files: [],
        components: [],
      });

      // Clean up user data
      await roleManager.cleanupRolePreview(userId, interaction.message.id);
    } catch (error) {
      if (!interaction.replied && !interaction.deferred) await interaction.reply({
        content: 'An error occurred while cancelling the preview.',
        flags: 64, // Ephemeral
      });
      else await interaction.followUp({
        content: 'An error occurred while cancelling the preview.',
        flags: 64, // Ephemeral
      });

      logger.error(`Error cancelling role preview: ${error.message}`);
    }
  },
};
