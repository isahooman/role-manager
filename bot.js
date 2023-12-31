const { Collection, Client, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const { clientId, token, guildId, prefix } = require('./config.json');
const logger = require('./logger');
const path = require('path');
const fs = require('fs');

// Instances
const client = new Client({
    intents: 
    [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildPresences, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: 
    [
        Partials.Channel
    ],
});

// Read commands
function readCommands(directory) {
    const files = fs.readdirSync(directory);
    let commandFiles = [];

    for (const file of files) {
        const filepath = path.join(directory, file);
        if (fs.statSync(filepath).isDirectory()) {
            commandFiles = commandFiles.concat(readCommands(filepath));
        } else if (file.endsWith('.js')) {
            commandFiles.push({ path: filepath, directory });
        }
    }
    return commandFiles;
}

// Load Slash Commands
client.slashCommands = new Collection();
const slashCommandFiles = readCommands(path.join(__dirname, 'commands/slash'));

for (const fileData of slashCommandFiles) {
    try {
        const command = require(fileData.path);
        client.slashCommands.set(command.data.name, {
            ...command,
            directory: fileData.directory
        });
        logger.info(`Slash command loaded: ${command.data.name}`);
    } catch (error) {
        logger.error(`Error loading slash command at ${fileData.path}: ${error.message}`);
    }
}

// Load Prefix Commands
client.prefixCommands = new Collection();
const prefixCommandFiles = readCommands(path.join(__dirname, 'commands/prefix'));

for (const fileData of prefixCommandFiles) {
    try {
        const command = require(fileData.path);
        client.prefixCommands.set(command.name, command);
        logger.info(`Prefix command loaded: ${command.name}`);
    } catch (error) {
        logger.error(`Error loading prefix command at ${fileData.path}: ${error.message}`);
    }
}

// Separate global and dev slash commands
const globalCommands = [];
const devCommands = [];
const globalDir = path.join(__dirname, 'commands/slash/global');
const devDir = path.join(__dirname, 'commands/slash/dev');

for (const [_, commandData] of client.slashCommands.entries()) {
    if (commandData.directory.startsWith(globalDir)) {
        globalCommands.push(commandData.data.toJSON());
    } else if (commandData.directory.startsWith(devDir)) {
        devCommands.push(commandData.data.toJSON());
    }
}

// Deploy slash commands on startup
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        // Register global commands
        if (globalCommands.length) {
            await rest.put(Routes.applicationCommands(clientId), { body: globalCommands });
            logger.info(`Successfully reloaded ${globalCommands.length} global commands.`);
        }

        // Register dev commands
        if (devCommands.length) {
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: devCommands });
            logger.info(`Successfully reloaded ${devCommands.length} dev commands.`);
        }
    } catch (error) {
        logger.error(error);
    }
})();

client.once('ready', () => {
    logger.info(`Logged in as ${client.user.tag}!`);
});


//Slash command handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.slashCommands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction, client);
        logger.info('Slash command executed successfully', client, 'slash', { interaction });
    } catch (error) {
        logger.error(`Error executing slash command: ${error.message}`, client, 'slash', { interaction });
    }
});

// Prefix command handler
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const mentionRegex = new RegExp(`^<@!?${client.user.id}>$`);
    const mentionWithCommandRegex = new RegExp(`^<@!?${client.user.id}> `);

    if (mentionRegex.test(message.content)) {
        return message.reply(`My prefix is \`${prefix}\``);
    }

    const isMention = mentionWithCommandRegex.test(message.content);

    if (!message.content.startsWith(prefix) && !isMention) return;

    const content = isMention ? message.content.replace(mentionWithCommandRegex, '') : message.content.slice(prefix.length);
    const args = content.trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.prefixCommands.get(commandName);
    if (!command) return;

    try {
        logger.info(`Executing prefix command: ${commandName}`, client, 'prefix', { commandName, args, context: message });
        await command.execute(message, args, client);
    } catch (error) {
        logger.error(`Error executing prefix command: ${commandName} - ${error.message}`, client, 'text', { commandName, args, context: message });
        await message.reply({
            content: 'An error occurred with this command.',
            allowedMentions: { repliedUser: false }
        }).catch(err => logger.error('Failed to send message reply', err, 'prefix', { commandName, args, context: message }));
    }
});
// Edited messagae handler
client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (newMessage.author.bot || !newMessage.guild) return;

    const mentionRegex = new RegExp(`^<@!?${client.user.id}>$`);
    const mentionWithCommandRegex = new RegExp(`^<@!?${client.user.id}> `);

    if (mentionRegex.test(newMessage.content)) {
        return newMessage.reply(`My prefix is \`${prefix}\``);
    }

    const isMention = mentionWithCommandRegex.test(newMessage.content);

    if (!newMessage.content.startsWith(prefix) && !isMention) return;

    const content = isMention ? newMessage.content.replace(mentionWithCommandRegex, '') : newMessage.content.slice(prefix.length);
    const args = content.trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.prefixCommands.get(commandName);
    if (!command) return;

    try {
        logger.info(`Executing edited prefix command: ${commandName}`, client, 'prefix', { commandName, args, context: newMessage });
        await command.execute(newMessage, args, client);
    } catch (error) {
        logger.error(`Error executing edited prefix command: ${commandName} - ${error.message}`, client, 'text', { commandName, args, context: newMessage });
        await newMessage.reply({
            content: 'An error occurred with this command.',
            allowedMentions: { repliedUser: false }
        }).catch(err => logger.error('Failed to send edited message reply', err, 'prefix', { commandName, args, context: newMessage }));
    }
});

client.login(token);
