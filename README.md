<h1 align="center">
  <br>Role Manager<br>
</h1>
<p align="center">
  A Discord.js bot allowing user's to manage assigned roles
</p>

<p align="center">
  <a href="https://img.shields.io/github/contributors/isahooman/role-manager" >
    <img src="https://img.shields.io/github/contributors/isahooman/role-manager" alt = "Contributors"/>
  </a>
  <a href="https://github.com/isahooman/role-manager/pulse">
    <img src="https://img.shields.io/github/commit-activity/m/isahooman/role-manager" alt = "Activity" />
  </a>
  <a href="https://img.shields.io/github/issues/isahooman/role-manager" >
    <img src="https://img.shields.io/github/issues/isahooman/role-manager" alt="Issues"/>
  </a>
  <img alt="GitHub package.json version" src="https://img.shields.io/github/package-json/version/isahooman/role-manager">
</p>
<br>
<h2 align="center">Table of Contents</h2>

- [Key Features](#key-features)
- [Getting Started](#getting-started)
  - [Installation Guide](#installation-guide)
    - [Linux](#linux-command-line-installation)
    - [Windows 10](#windows-10-gui--command-line)

## Key Features

- Easy role permissions management

  - Server admins can add/remove managers to any role

- Self service role management
  - Users can add/remove their roles for any user
  - Users can customize their role's color or name
  - Users can check who has certain roles with the `inrole` command
  - For ~~role goblins~~ collectors there's the `collection` command which shows the roles the user has and what they're missing
    <br><br>

### Commands

- Owner<br>

  - <span style="color:lightgreen;">Cache</span> - Manage the bot's cache.<br>
  - <span style="color:lightgreen;">CommandToggle</span> - Toggles the specified command.<br>
  - <span style="color:lightgreen;">Deploy</span> - Deploys global and guild slash commands.<br>
  - <span style="color:lightgreen;">Eval</span> - Evaluates given code.<br>
  - <span style="color:lightgreen;">EventToggle</span> - Toggles the given Discord.js event.<br>
  - <span style="color:lightgreen;">Fail</span> - Tests a given error.<br>
  - <span style="color:lightgreen;">Leave</span> - Makes the bot leave the current server.<br>
  - <span style="color:lightgreen;">Logs</span> - Retrieves the latest bot logs.<br>
  - <span style="color:lightgreen;">LogTest</span> - Tests each logger level.<br>
  - <span style="color:lightgreen;">LogToggle</span> - Toggles logging for the specified level.<br>
  - <span style="color:lightgreen;">Permissions</span> - Check the bot's permissions.<br>
  - <span style="color:lightgreen;">Prefix</span> - Change the bot's prefix as needed.<br>
  - <span style="color:lightgreen;">Reload</span> - Reloads either a given command or all commands.<br>
  - <span style="color:lightgreen;">Shutdown</span> - Shuts the bot down gracefully.<br>

- Roles<br>

  - <span style="color:lightgreen;">Collection</span> - View a user's role collection.<br>
  - <span style="color:lightgreen;">InRole</span> - View all users in one or more roles.<br>
  - <span style="color:lightgreen;">Manager</span> - Add or remove role managers.<br>
  - <span style="color:lightgreen;">Role</span> - Manage roles (add, remove, customize).<br>

- Miscellaneous<br>

  - <span style="color:lightgreen;">Ping</span> - Shows the bot uptime as well as the bots connection to Discord.<br>

- Info<br>

  - <span style="color:lightgreen;">Stats</span> - Shows bot statistics and performance metrics.<br>
  - <span style="color:lightgreen;">UserInfo</span> - Shows information about a user.<br>

- Utility<br>

  - <span style="color:lightgreen;">Avatar</span> - Fetch the provided user's avatar.<br>
  - <span style="color:lightgreen;">Banner</span> - Fetch the provided user's banner.<br>
  - <span style="color:lightgreen;">BugReport</span> - Report a bug.<br>
  - <span style="color:lightgreen;">Emojis</span> - Export server emojis as a zip file.<br>
  - <span style="color:lightgreen;">Enlarge</span> - Enlarge the provided emoji.<br>
  - <span style="color:lightgreen;">Math</span> - Solve the provided math equation.<br>
  - <span style="color:lightgreen;">Suggest</span> - Make a suggestion.<br>
  - <span style="color:lightgreen;">Temperature</span> - Convert the provided temperature.<br>

- Fun<br>

  - <span style="color:lightgreen;">CoinFlip</span> - Flip a Coin!<br>
  - <span style="color:lightgreen;">Number</span> - Generate a random number within a given range.<br>

# Getting Started

## Installation Guide

The bot can be installed by using the following instructions.
<br><br>

### Linux Command Line Installation

1. **Update package lists:**

- Debian/Ubuntu: `sudo apt update && sudo apt upgrade`
- Fedora/CentOS: `sudo dnf upgrade`
- Arch Linux: `sudo pacman -Syu`
- openSUSE: `sudo zypper dup`

2. **Installing prerequisites:**

- Debian/Ubuntu: `sudo apt install git nodejs npm`
- Fedora/CentOS: `sudo dnf install git nodejs`
- Arch Linux: `sudo pacman -S git nodejs npm`
- openSUSE: `sudo zypper install git nodejs npm`

3. **Clone the GitHub repository**

```bash
git clone https://github.com/isahooman/role-manager.git
cd role-manager
```

4. **Configuring the bot**

Next you'll need to setup [config.json5](./config/bot/config.json5) as well as the optional extra config files.

```bash
sudo nano ./config/config.json5
```

You can follow the [configuration example](./config/bot/README.md#configjson) here if needed.

5. **You're now ready to start the bot**

```bash
npm run start
```

<br><br>

### Windows 10 GUI + Command Line

1. **Install node from the one of the following methods**

- [Node v20.11.0 Direct Install Link](https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi)
- [Node Website](https://nodejs.org/en)

```bash
winget install OpenJS.NodeJS
```

2. **Download the zip file for [Role-Manager](https://github.com/isahooman/role-manager/archive/refs/heads/main.zip)**

```bash
# Get the zip file of role-manager
curl -uri "https://github.com/isahooman/role-manager/archive/main.zip" -Method "GET" -Outfile "role-manager.zip"
```

3. **Extract the zip file to a file location of your choice**

```bash
# Unzips the zip file to your directory
tar -xvf role-manager.zip
```

4. **Configuring the bot**

Next you'll need to configure your bot in [config.json5](./config/bot/config.json5) as well as the optional extra config files.

```sh
# Opens the config file within the notepad text editor
notepad ./config/bot/config.json5
```

You can follow the [configuration example](./config/bot/README.md#configjson) here if needed.<br>

5. **You're now ready to run your bot!**

```bash
# Installs the npm prerequisites and starts the bot
npm run start
```

<br><br>

#### Darwin/Mac 10 GUI + Command Line

1. Install node from the one of the following links

- [Node v20.11.0 Direct Install Link](https://nodejs.org/dist/v20.11.0/node-v20.11.0.pkg)
- [Node Website](https://nodejs.org/en)

```bash
brew install node
```

2. Download the zip file of the [role-manager](https://github.com/isahooman/role-manager/archive/refs/heads/main.zip)

```bash
# Get the zip file of role-manager
curl -L -O https://github.com/isahooman/role-manager/archive/main.zip
```

3. Extract the zip file to a file location of your choice

```bash
# Unzips the zip file to your directory
tar -xvf role-manager-main.zip
```

4. **Configuring role-manager**

Next you'll need to configure your bot in [config.json5](./config/bot/config.json5) as well as the optional extra config files.

```sh
# Opens the config file within the notepad text editor
nano ./config/config.json5
```

You can follow the [configuration example](./config/bot/README.md#configjson5) here if needed.<br>

5. You're now ready to run your bot using the start.sh file!

```bash
# Installs the npm prerequisites
npm start
```

<br><br><br>

## Contributing

Contributions are always welcome! Please read our [contribution guidelines](.github/CONTRIBUTING.md) before contributing.

## Credits

- Electron
- NodeJS
