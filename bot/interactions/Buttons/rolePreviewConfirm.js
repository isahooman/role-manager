const roleManager = require('../../components/util/role-manager');
const logger = require('../../components/util/logger');

module.exports = {
  async button(interaction) {
    try {
      // Acknowledge the interaction to prevent timeout
      await interaction.deferUpdate();

      // Get the preview data from global storage
      const previewData = global.rolePreviewData?.[interaction.message.id];
      if (!previewData) return interaction.editReply({
        content: 'Preview data has expired. Please run the command again.',
        files: [],
        components: [],
      });

      const { role, roleColor, roleName, userId } = previewData;

      // Verify this is the original user
      if (interaction.user.id !== userId) return;

      // Build update object
      const updates = { color: parseInt(roleColor.replace('#', ''), 16) };
      if (roleName) updates.name = roleName;

      // Get the role object from the guild
      const guildRole = await interaction.guild.roles.fetch(role.id);
      if (!guildRole) return interaction.reply('Role not found within the server.');

      // Update the role with the new color and name
      const updatedRole = await guildRole.edit(updates);

      // Create confirmation message
      let confirmationMessage = '';
      if (roleName && roleColor) {
        confirmationMessage = `Role \`${role.name}\` updated with new name \`${updatedRole.name}\` and color \`${roleColor}\``;
      } else if (roleName) {
        confirmationMessage = `Role name changed from \`${role.name}\` to \`${updatedRole.name}\``;
      } else {
        confirmationMessage = `Role \`${updatedRole.name}\` color changed to \`${roleColor}\``;
      }

      // Send confirmation
      await interaction.editReply({
        content: confirmationMessage,
        files: [],
        components: [],
      });

      // Clean up user data
      await roleManager.cleanupRolePreview(userId, interaction.message.id);
    } catch (error) {
      if (!interaction.replied && !interaction.deferred) await interaction.reply({
        content: 'An error occurred while updating the role.',
        flags: 64, // Ephemeral
      });
      else await interaction.followUp({
        content: 'An error occurred while updating the role.',
        flags: 64, // Ephemeral
      });

      throw new Error(`Error updating role: ${error.message}`);
    }
  },
};
