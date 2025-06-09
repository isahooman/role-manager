const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const Canvas = require('canvas');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { fetch } = require('node-fetch');
const configManager = require('../../../../../components/configManager');

const PREVIEWS_DIR = path.join(__dirname, '../../../../../output/previews/');

// Ensure previews directory exists
if (!fs.existsSync(PREVIEWS_DIR)) fs.mkdirSync(PREVIEWS_DIR, { recursive: true });

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Manage roles')
    .addSubcommand(subcommand => subcommand
      .setName('add')
      .setDescription('Assign your managed role to a user')
      .addUserOption(option => option.setName('user').setDescription('Select the user').setRequired(true))
      .addRoleOption(option => option.setName('role').setDescription('Select the role to assign').setRequired(true)),
    )
    .addSubcommand(subcommand => subcommand
      .setName('remove')
      .setDescription('Remove your managed role from a user')
      .addUserOption(option => option.setName('user').setDescription('Select the user').setRequired(true))
      .addRoleOption(option => option.setName('role').setDescription('Select the role to remove').setRequired(true)),
    )
    .addSubcommand(subcommand => subcommand
      .setName('customize')
      .setDescription('Customize a managed role')
      .addRoleOption(option => option.setName('role').setDescription('Select the role to customize').setRequired(true))
      .addStringOption(option => option.setName('color').setDescription('New hex color for the role'))
      .addStringOption(option => option.setName('name').setDescription('New name for the role')),
    ),

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      const role = interaction.options.getRole('role');

      // Check bot permissions
      if (!await this.checkBotPermissions(interaction, role)) return;

      // Load manager data and check user permissions
      const managedData = configManager.loadConfig('managed');
      if (!await this.checkUserPermissions(interaction, managedData, role)) return interaction.reply('You do not have permission to manage this role.');

      // Execute the subcommand if permissions are valid
      switch (subcommand) {
        case 'add':
        case 'remove':
          return this.handleManage(interaction, role, subcommand);
        case 'customize':
          return this.handleCustomize(interaction, role);
        default:
          return interaction.reply({ content: 'Invalid subcommand.', ephemeral: true });
      }
    } catch (error) {
      throw new Error(`Error executing role command: ${error.message}`);
    }
  },

  /**
   * Checks if the bot has permissions to manage the target role
   * @param {object} interaction - Discord interaction
   * @param {object} role - Discord role
   * @returns {boolean} True if bot can manage the role, false otherwise
   * @author isahooman
   */
  async checkBotPermissions(interaction, role) {
    // Check if the bot has manage_roles permission
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply('I don\'t have the Manage Roles permission, please ask a server admin to give me the permissions.');
      return false;
    }

    // Check if the target role is higher than the bot's highest role
    const botMember = await interaction.guild.members.fetch(interaction.client.user);
    if (role.position > botMember.roles.highest.position) {
      await interaction.reply('I cannot manage this role because it is higher than my own.');
      return false;
    }

    return true;
  },

  /**
   * Checks if the user has permission to manage the specified role
   * @param {object} interaction - The Discord interaction object
   * @param {object} managedData - Configuration data containing role management permissions
   * @param {object} role - The Discord role to check permissions for
   * @returns {boolean} True if the user can manage this role, false otherwise
   * @author isahooman
   */
  checkUserPermissions(interaction, managedData, role) {
    const { guild, user, member } = interaction;
    const guildId = guild.id;
    const authorId = user.id;

    // Check if user can manage this role
    const userIsRoleManager = managedData[guildId]?.hasOwnProperty(role.id) && managedData[guildId][role.id]?.includes(authorId);
    const isServerManager = managedData[guildId]?.server_manager && member.roles.cache.has(managedData[guildId].server_manager);
    const isServerOwner = user.id === guild.ownerId;
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

    return userIsRoleManager || isServerManager || isServerOwner || isAdmin;
  },

  /**
   * Handles adding or removing roles from users
   * @param {object} interaction - Discord interaction object containing command data
   * @param {object} role - The Discord role to manage
   * @param {string} action - Action: 'add' or 'remove'
   * @returns {message} Discord reply result
   * @author isahooman
   */
  async handleManage(interaction, role, action) {
    const user = interaction.options.getUser('user');
    try {
      const member = await interaction.guild.members.fetch(user);
      if (!member) return interaction.reply({ content: 'The specified user is not a member of this guild.', ephemeral: true });

      // Block role management towards bots
      if (member.user.bot) return interaction.reply({ content: `You cannot ${action} roles ${action === 'add' ? 'to' : 'from'} bots.`, ephemeral: true });

      // Add or remove the role based on the action
      if (action === 'add') {
        if (member.roles.cache.has(role.id)) return interaction.reply(`${member.user.username} already has the ${role} role.`);
        await member.roles.add(role);
        return interaction.reply(`${role} has been given to ${user}`);
      } else {
        if (!member.roles.cache.has(role.id)) return interaction.reply(`${member.user.username} does not have the ${role} role.`);
        await member.roles.remove(role);
        return interaction.reply(`Removed ${role} from ${user}`);
      }
    } catch (error) {
      throw new Error(`Error ${action === 'add' ? 'adding' : 'removing'} role: ${error.message}`);
    }
  },

  /**
   * Handles role customization including name and color changes
   * @param {interaction} interaction - Discord interaction object
   * @param {role} role - The Discord role to customize
   * @returns {message} - Reply message
   * @author isahooman
   */
  async handleCustomize(interaction, role) {
    const roleName = interaction.options.getString('name');
    let roleColor = interaction.options.getString('color');

    // Check if any customization option was provided
    if (!roleName && !roleColor) return interaction.reply({
      content: 'Please provide at least one customization option (name or color).',
      ephemeral: true,
    });

    try {
      // Handle name change
      if (roleName && !roleColor) {
        const updatedRole = await role.edit({ name: roleName });
        return interaction.reply(`Role name changed to ${updatedRole.name}.`);
      }

      // Handle color change
      if (roleColor) {
        // Format color code
        if (!roleColor.startsWith('#')) roleColor = `#${roleColor}`;
        // Validate color
        const validHexColor = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (!validHexColor.test(roleColor)) return interaction.reply({
          content: 'Invalid color format. Please provide a valid hex color code.',
          ephemeral: true,
        });

        // Create and send customization preview
        return this.showColorPreview(interaction, role, roleColor, roleName);
      }
    } catch (error) {
      throw new Error(`Error customizing role: ${error.message}`);
    }
  },

  /**
   * Displays an interactive preview of role color changes with theme switching support
   * @param {interaction} interaction - The Discord interaction object
   * @param {role} role - The role being customized
   * @param {string} roleColor - Hex color code for the role
   * @param {string|null} roleName - New name for the role
   * @author isahooman
   */
  async showColorPreview(interaction, role, roleColor, roleName) {
    // Get user information for the preview
    const userId = interaction.user.id;
    const member = await interaction.guild.members.fetch(userId);
    const userAvatarUrl = member.displayAvatarURL({ format: 'png', size: 128 });
    const displayName = member.displayName;

    // Generate theme previews
    const darkPreviewPath = await this.savePreviewCanvas('#36393F', userId, 'dark', userAvatarUrl, roleColor, displayName);
    const lightPreviewPath = await this.savePreviewCanvas('#FFFFFF', userId, 'light', userAvatarUrl, roleColor, displayName);

    // Create component row with confirmation buttons
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm')
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('switch')
        .setLabel('Switch Theme')
        .setStyle(ButtonStyle.Secondary),
    );

    // Send initial preview with dark theme
    let currentPreview = { path: darkPreviewPath, theme: 'Dark mode' };
    const message = await interaction.reply({
      content: `Preview of the new color (${currentPreview.theme}):`,
      files: [{ attachment: currentPreview.path }],
      components: [actionRow],
      fetchReply: true,
    });

    // Set up 30 second interaction collector
    const collector = message.createMessageComponentCollector({
      time: 30000,
    });

    collector.on('collect', async buttonInteraction => {
      // only allow the original user to interact with the buttons
      if (buttonInteraction.user.id !== interaction.user.id) return;

      switch (buttonInteraction.customId) {
        case 'confirm':
          await this.handleConfirmation(buttonInteraction, role, roleColor, roleName);
          break;

        case 'cancel':
          await buttonInteraction.update({
            content: 'Role customization cancelled.',
            files: [],
            components: [],
          });
          break;

        case 'switch':
          // Toggle between dark and light themes
          currentPreview = currentPreview.theme === 'Dark mode' ?
            { path: lightPreviewPath, theme: 'Light mode' } :
            { path: darkPreviewPath, theme: 'Dark mode' };

          await buttonInteraction.update({
            content: `Preview of the new color (${currentPreview.theme}):`,
            files: [{ attachment: currentPreview.path }],
            components: [actionRow],
          });
          break;
      }
    });

    // Clean up preview files when collector ends
    collector.on('end', () => {
      this.cleanupPreviewFiles(userId);
    });
  },

  /**
   * Handles the confirmation of role customization
   * @param {ButtonInteraction} buttonInteraction - The button interaction
   * @param {role} role - The role to update
   * @param {string} roleColor - The hex color code
   * @param {string|null} roleName - The new role name (if provided)
   * @author isahooman
   */
  async handleConfirmation(buttonInteraction, role, roleColor, roleName) {
    try {
      // Build update object
      const updates = { color: parseInt(roleColor.replace('#', ''), 16) };
      if (roleName) updates.name = roleName;

      // Update the role with the new color and name
      const updatedRole = await role.edit(updates);

      // Send confirmation
      await buttonInteraction.update({
        content: `Successfully customized role ${updatedRole.name}.`,
        files: [],
        components: [],
      });

      // Clean up preview files once done
      this.cleanupPreviewFiles(buttonInteraction.user.id);
    } catch (error) {
      throw new Error(`Error updating role: ${error.message}`);
    }
  },

  /**
   * Removes all preview images created for a specific user
   * @param {string} userId - Discord user ID whose preview files should be deleted
   * @author isahooman
   */
  cleanupPreviewFiles(userId) {
    try {
      const files = fs.readdirSync(PREVIEWS_DIR);

      // Delete all files that start with the user's ID
      files.forEach(file => {
        if (file.startsWith(userId)) {
          const filePath = path.join(PREVIEWS_DIR, file);
          fs.unlinkSync(filePath);
        }
      });
    } catch (error) {
      throw new Error(`Error cleaning up preview files: ${error.message}`);
    }
  },

  /**
   * Creates and saves a customization preview using Canvas
   * @param {string} backgroundColor - The hex background color
   * @param {string} userId - Discord user ID for identifying the preview image
   * @param {string} theme - Theme name
   * @param {string} userAvatarUrl - URL to the user's avatar image
   * @param {string} roleColor - Hex color code for the role being previewed
   * @param {string} displayName - User's display name to render with the role color
   * @returns {string} Path to the saved preview image
   * @author isahooman
   */
  async savePreviewCanvas(backgroundColor, userId, theme, userAvatarUrl, roleColor, displayName) {
    // Create canvas
    const canvas = Canvas.createCanvas(1600, 250);
    const context = canvas.getContext('2d');
    const filename = `${userId}-${theme}.png`;
    const filePath = path.join(PREVIEWS_DIR, filename);

    // Draw background
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw circle for avatar
    context.save();
    context.beginPath();
    context.arc(120, 120, 80, 0, Math.PI * 2, true);
    context.closePath();
    context.clip();

    try {
      // Fetch and process avatar image
      const response = await fetch(userAvatarUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await sharp(Buffer.from(arrayBuffer)).png().toBuffer();
      const userImage = await Canvas.loadImage(buffer);

      // Draw avatar in the circle
      context.drawImage(userImage, 40, 40, 160, 160);
    } catch (error) {
      throw new Error(`Error processing avatar: ${error.message}`);
    }
    context.restore();

    // Draw username with new role color
    context.font = '80px Arial';
    context.fillStyle = roleColor;
    context.fillText(displayName, 240, 110);

    // Draw exammple text
    context.fillStyle = backgroundColor === '#FFFFFF' ? 'black' : 'white';
    context.font = '60px Arial';
    context.fillText('This is how the new color will look', 240, 200);

    // Save generated preview to file
    fs.writeFileSync(filePath, canvas.toBuffer());
    return filePath;
  },
};
