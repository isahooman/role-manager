/* eslint-disable jsdoc/require-jsdoc */
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const logger = require('../../../../components/util/logger');
const roleManager = require('../../../../components/util/role-manager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manager')
    .setDescription('Manage role permissions')
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Give someone permission to manage a role')
      .addUserOption(opt => opt.setName('user').setDescription('Who gets permission').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Which role they can manage').setRequired(true)),
    )
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove someone\'s permission to manage a role')
      .addUserOption(opt => opt.setName('user').setDescription('Who loses permission').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Which role they can no longer manage').setRequired(true)),
    )
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Show who can manage which roles'),
    )
    .addSubcommand(sub => sub
      .setName('admin')
      .setDescription('Set which roles can manage all roles')
      .addRoleOption(opt => opt.setName('role').setDescription('The server manager role').setRequired(true))
      .addStringOption(opt => opt.setName('action').setDescription('Add or remove server manager role')
        .addChoices(
          { name: 'Add', value: 'add' },
          { name: 'Remove', value: 'remove' },
        )
        .setRequired(true)),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'add': return await this.addManager(interaction);
        case 'remove': return await this.removeManager(interaction);
        case 'list': return await this.listManagers(interaction);
        case 'admin': return await this.manageServerManager(interaction);
      }
    } catch (error) {
      logger.error(`Manager command failed: ${error.message}`);
      throw error;
    }
  },

  async addManager(interaction) {
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    // Check if the user is a server manager
    if (!roleManager.isServerManager(interaction.member)) return interaction.reply('Only server managers can give role management permissions.');
    // Check if the user already manages the role
    if (await roleManager.isRoleManager(interaction.guild.id, role.id, user.id)) return interaction.reply(`${user} already manages ${role}.`);

    // Attempt to add the role manager and return the result
    const success = await roleManager.addRoleManager(interaction.guild.id, role.id, user.id, interaction.member);
    const message = success ? `${user} can now manage ${role}` : `Failed to give ${user} permission for ${role}`;

    await interaction.reply(message);
  },

  async removeManager(interaction) {
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    // Check if the user is a server manager
    if (!roleManager.isServerManager(interaction.member)) return interaction.reply('Only server managers can manage role permissions.');
    // Check if the target manages the role
    if (!await roleManager.isRoleManager(interaction.guild.id, role.id, user.id)) return interaction.reply(`${user} doesn't manage ${role}.`);

    // Attempt to remove the role manager and return the result
    const success = await roleManager.removeRoleManager(interaction.guild.id, role.id, user.id, interaction.member);
    const message = success ? `${user} can no longer manage ${role}` : `Failed to remove ${user}'s permission for ${role}`;

    await interaction.reply(message);
  },

  async listManagers(interaction) {
    await interaction.deferReply();

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Role Managers');

    const serverManagers = await getServerManagersList(interaction);
    const roleManagers = await getRoleManagersList(interaction);

    const sections = [];
    if (serverManagers) sections.push(serverManagers);
    if (roleManagers) sections.push(roleManagers);

    embed.setDescription(sections.length > 0 ? sections.join('\n') : 'No role managers set up.');
    await interaction.editReply({ embeds: [embed] });
  },

  async manageServerManager(interaction) {
    if (!roleManager.isServerAdmin(interaction.member)) return interaction.reply('Only server admins can manage server managers');

    const action = interaction.options.getString('action');
    const role = interaction.options.getRole('role');
    const currentServerManagers = await roleManager.getServerManagers(interaction.guild.id);

    if (action === 'add') {
      if (currentServerManagers.includes(role.id)) return interaction.reply(`${role} is already a server manager role.`);

      const success = await roleManager.addServerManager(interaction.guild.id, role.id);
      const message = success ? `${role} is now a server manager role.` : 'Failed to add server manager role.';
      await interaction.reply(message);
    } else if (action === 'remove') {
      if (!currentServerManagers.includes(role.id)) return interaction.reply(`${role} is not a server manager role.`);

      const success = await roleManager.removeServerManager(interaction.guild.id, role.id);
      const message = success ? `${role} is no longer a server manager role.` : 'Failed to remove server manager role.';
      await interaction.reply(message);
    }
  },
};

async function getServerManagersList(interaction) {
  const serverManagerRoleIds = await roleManager.getServerManagers(interaction.guild.id);
  if (serverManagerRoleIds.length === 0) return null;

  const roles = interaction.guild.roles.cache
    .filter(role => serverManagerRoleIds.includes(role.id))
    .sort((a, b) => b.position - a.position);

  const sections = ['**Server Managers**:'];

  for (const role of roles.values()) sections.push(`• ${role}`);

  return sections.join('\n') + '\n\n';
}

async function getRoleManagersList(interaction) {
  const managedRoles = await roleManager.getManagedRoles(interaction.guild.id);
  if (managedRoles.length === 0) return null;

  const roles = interaction.guild.roles.cache
    .filter(role => managedRoles.includes(role.id))
    .sort((a, b) => b.position - a.position);

  const sections = ['**Role Managers**:'];

  for (const role of roles.values()) {
    const managerIds = await roleManager.getRoleManagers(interaction.guild.id, role.id);
    if (managerIds.length === 0) continue;

    sections.push(`**${role}**:`);

    for (const id of managerIds) try {
      const member = await interaction.guild.members.fetch(id);
      sections.push(`• <@${id}> (${member.nickname || member.user.displayName})`);
    } catch {
      sections.push(`• Unknown User (${id})`);
    }

    sections.push('');
  }

  return sections.join('\n');
}
