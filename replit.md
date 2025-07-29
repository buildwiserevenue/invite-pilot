# Overview

This is a Discord bot application built with Node.js and Discord.js v14 that provides invite tracking and automatic role assignment functionality. The bot monitors Discord server invites and automatically assigns specified roles to users when they join through tracked invite links.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a modular event-driven architecture typical of Discord bots:

- **Entry Point**: `index.js` serves as the main application file that initializes the Discord client, loads commands and events
- **Command System**: Slash commands stored in the `commands/` directory
- **Event System**: Discord event handlers stored in the `events/` directory  
- **Utility Layer**: Business logic modules in the `utils/` directory
- **Data Storage**: JSON file-based persistence in the `data/` directory
- **Configuration**: JSON-based configuration in the `config/` directory

## Key Components

### Discord Bot Client
- Uses Discord.js v14 with specific gateway intents for guilds, members, invites, and messages
- Implements slash command handling with automatic command loading
- Event-driven architecture for handling Discord events

### Command System
- **Invite Command**: Main slash command with subcommands for creating, listing, deleting tracked invites and viewing statistics
- Supports role assignment, channel specification, usage limits, and expiration settings

### Event Handlers
- **guildMemberAdd**: Detects which invite a user used to join and assigns the corresponding role
- **inviteCreate**: Updates internal invite tracking when new invites are created
- **inviteDelete**: Cleans up tracking data when invites are deleted

### Utility Modules
- **InviteTracker**: Manages invite tracking data, usage counting, and persistence
- **RoleManager**: Handles mapping between invite codes and Discord roles

### Data Storage
- **invites.json**: Stores invite tracking data per guild
- **roleMappings.json**: Maps invite codes to role IDs per guild
- Uses Map data structures in memory with JSON file persistence

## Data Flow

1. **Invite Creation**: Admin creates tracked invite via slash command → Bot creates Discord invite → Maps invite to role → Stores mapping
2. **User Joins**: User joins via invite → Bot detects which invite was used → Looks up mapped role → Assigns role to user
3. **Invite Management**: Admins can list, delete, or view stats for tracked invites

## External Dependencies

- **discord.js**: Primary Discord API library (v14.21.0)
- **Node.js Built-ins**: File system operations for data persistence
- **Discord API**: For managing invites, roles, and guild members

## Deployment Strategy

- Simple Node.js application designed to run as a long-running process
- Requires Discord bot token configuration
- File-based data storage suitable for small to medium scale deployments
- No external database dependencies - uses JSON files for persistence
- Configurable through `config/config.json` for bot settings, permissions, and feature flags

### Key Configuration Areas
- Bot permissions and user permission requirements
- Rate limiting and usage limits
- Feature toggles for welcome messages, logging, and auto-cleanup
- Invite expiration and usage defaults