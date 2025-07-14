const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const Canvas = require('canvas');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const roleManager = require('../../../../components/util/role-manager');

const PREVIEWS_DIR = path.join(__dirname, '../../../../../output/previews/');

// Initialize global preview data storage
if (!global.rolePreviewData) global.rolePreviewData = {};

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

      // Check user permissions using RoleManager
      if (!await roleManager.checkPermission(interaction.member, role)) return interaction.reply('You do not have permission to manage this role.');

      // Execute the subcommand if permissions are valid
      switch (subcommand) {
        case 'add':
        case 'remove':
          return this.handleManage(interaction, role, subcommand);
        case 'customize':
          return this.handleCustomize(interaction, role);
        default:
          return interaction.reply({
            content: 'Invalid subcommand.',
            flags: 64, // Ephemeral
          });
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
      if (!member) return interaction.reply({
        content: 'The specified user is not a member of this guild.',
        flags: 64, // Ephemeral
      });

      // Block role management towards bots
      if (member.user.bot) return interaction.reply(`You cannot ${action} roles ${action === 'add' ? 'to' : 'from'} bots.`);

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
      flags: 64, // Ephemeral
    });

    try {
      // Handle name change
      if (roleName && !roleColor) {
        const oldName = role.name;
        const updatedRole = await role.edit({ name: roleName });
        return interaction.reply(`Role name changed from \`${oldName}\` to \`${updatedRole.name}\``);
      }

      // Handle color change
      if (roleColor) {
        // Format color code
        if (!roleColor.startsWith('#')) roleColor = `#${roleColor}`;
        // Validate color
        const validHexColor = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (!validHexColor.test(roleColor)) return interaction.reply({
          content: 'Invalid color format. Please provide a valid hex color code.',
          flags: 64, // Ephemeral
        });

        // Create and send customization preview
        return this.showColorPreview(interaction, role, roleColor, roleName);
      }
    } catch (error) {
      throw new Error(`Error customizing role: ${error.message}`);
    }
  },

  /**
   * Displays an interactive preview of role color changes
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
    const darkPreviewPath = await this.savePreviewCanvas('#36393F', 'dark', userId, userAvatarUrl, displayName, roleColor);
    const lightPreviewPath = await this.savePreviewCanvas('#FFFFFF', 'light', userId, userAvatarUrl, displayName, roleColor);

    // Create button components
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

    // Send initial preview with dark theme
    const message = await interaction.reply({
      content: 'Preview of the new color (Dark mode):',
      files: [{ attachment: darkPreviewPath }],
      components: [actionRow],
    }).then(() => interaction.fetchReply());

    // Store preview data in global storagage for interaction handlers
    global.rolePreviewData[message.id] = {
      role: { id: role.id, name: role.name },
      roleColor,
      roleName,
      userId,
      currentTheme: 'dark',
      darkPreviewPath,
      lightPreviewPath,
    };

    // Start a cleanup timer
    setTimeout(async () => {
      if (global.rolePreviewData[message.id]) {
        await roleManager.cleanupRolePreview(userId, message.id);
      }
    }, 30000);
  },

  /**
   * Creates and saves a customization preview using Canvas
   * @param {string} backgroundColor - The hex background color
   * @param {string} theme - Theme name
   * @param {string} userId - Discord user ID for naming the preview image
   * @param {string} userAvatarUrl - URL to the user's avatar image
   * @param {string} roleColor - Hex color code for the role being previewed
   * @param {string} displayName - User's display name for user preview
   * @returns {string} Path to the saved preview image
   * @author isahooman
   */
  async savePreviewCanvas(backgroundColor, theme, userId, userAvatarUrl, roleColor, displayName) {
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
      const response = await globalThis.fetch(userAvatarUrl);
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
