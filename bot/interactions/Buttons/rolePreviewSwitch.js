const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const roleManager = require('../../components/util/role-manager');

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

      const { userId, currentTheme } = previewData;

      // Verify this is the original user
      if (interaction.user.id !== userId) return;

      // Toggle between dark and light themes
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      const newThemeName = newTheme === 'dark' ? 'Dark mode' : 'Light mode';
      const previewPath = path.join(PREVIEWS_DIR, `${userId}-${newTheme}.png`);

      // Update the global data with new theme
      global.rolePreviewData[interaction.message.id].currentTheme = newTheme;

      // Create component row with control buttons
      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('rolePreviewConfirm')
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('rolePreviewCancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('rolePreviewSwitch')
          .setLabel('Switch Theme')
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.editReply({
        content: `Preview of the new color (${newThemeName}):`,
        files: [{ attachment: previewPath }],
        components: [actionRow],
      });
    } catch (error) {
      if (!interaction.replied && !interaction.deferred) await interaction.reply({
        content: 'An error occurred while switching themes.',
        flags: 64, // Ephemeral
      });
      else await interaction.followUp({
        content: 'An error occurred while switching themes.',
        flags: 64, // Ephemeral
      });

      throw new Error(`Error switching theme: ${error.message}`);
    }
  },
};
