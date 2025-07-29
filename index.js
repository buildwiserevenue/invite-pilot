const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMessages
    ]
});

// Initialize collections
client.commands = new Collection();
client.invites = new Map();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error('Error executing command:', error);
        const errorMessage = 'There was an error while executing this command!';
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
});

// When the client is ready, run this code (only once)
client.once('ready', async () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    
    // Register slash commands
    const commands = [];
    for (const [name, command] of client.commands) {
        commands.push(command.data.toJSON());
    }

    const rest = new REST().setToken(process.env.DISCORD_TOKEN || 'your_bot_token_here');

    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // Deploy commands globally (remove guild-specific deployment for production)
        const data = await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error('Error registering commands:', error);
    }

    // Initialize invite tracking for all guilds
    for (const guild of client.guilds.cache.values()) {
        try {
            const invites = await guild.invites.fetch();
            client.invites.set(guild.id, new Map(invites.map(invite => [invite.code, invite.uses])));
        } catch (error) {
            if (error.code === 50013) {
                console.log(`Bot needs "Manage Server" permission in ${guild.name} to track existing invites. The bot will still work for creating new tracked invites.`);
            } else {
                console.error(`Failed to fetch invites for guild ${guild.name}:`, error);
            }
            // Initialize with empty map so the bot still works
            client.invites.set(guild.id, new Map());
        }
    }
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Create HTTP server for health checks (for UptimeRobot monitoring)
const server = http.createServer((req, res) => {
    res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    
    if (req.url === '/health' || req.url === '/') {
        const status = {
            status: 'online',
            timestamp: new Date().toISOString(),
            bot: {
                ready: client.readyAt ? true : false,
                username: client.user ? client.user.tag : 'Connecting...',
                guilds: client.guilds ? client.guilds.cache.size : 0,
                uptime: client.uptime ? Math.floor(client.uptime / 1000) : 0
            }
        };
        res.end(JSON.stringify(status, null, 2));
    } else {
        res.end(JSON.stringify({ status: 'online', message: 'Bot health check endpoint' }));
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Health check server running on port ${PORT}`);
    console.log(`📍 URL: https://${process.env.REPL_SLUG || 'your-repl'}.${process.env.REPL_OWNER || 'username'}.repl.co`);
});

// Login to Discord with your client's token
client.login(process.env.DISCORD_TOKEN || 'your_bot_token_here');
