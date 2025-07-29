const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const inviteTracker = require('../utils/inviteTracker');
const roleManager = require('../utils/roleManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Manage tracked invite links')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a tracked invite link')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name for this invite link')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to assign when users join via this invite')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to create invite for (default: current channel)')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('max_uses')
                        .setDescription('Maximum number of uses (0 = unlimited)')
                        .setRequired(false)
                        .setMinValue(0))
                .addIntegerOption(option =>
                    option.setName('max_age')
                        .setDescription('Expiration time in seconds (0 = never expires)')
                        .setRequired(false)
                        .setMinValue(0)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all tracked invite links'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a tracked invite link')
                .addStringOption(option =>
                    option.setName('code')
                        .setDescription('Invite code to delete')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View statistics for tracked invites'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        // Check if user has permission to manage guild
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return await interaction.reply({
                content: '❌ You need the "Manage Server" permission to use this command.',
                flags: 64
            });
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            // Defer the reply to prevent timeout issues
            await interaction.deferReply({ flags: 64 });
            
            switch (subcommand) {
                case 'create':
                    await handleCreateInvite(interaction);
                    break;
                case 'list':
                    await handleListInvites(interaction);
                    break;
                case 'delete':
                    await handleDeleteInvite(interaction);
                    break;
                case 'stats':
                    await handleInviteStats(interaction);
                    break;
            }
        } catch (error) {
            console.error('Error in invite command:', error);
            const errorMessage = 'An error occurred while processing your request. Please try again.';
            
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else if (!interaction.replied) {
                await interaction.reply({ content: errorMessage, flags: 64 });
            }
        }
    }
};

async function handleCreateInvite(interaction) {
    const name = interaction.options.getString('name');
    const role = interaction.options.getRole('role');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const maxUses = interaction.options.getInteger('max_uses') || 0;
    const maxAge = interaction.options.getInteger('max_age') || 0;

    // Check if bot has permission to create invites
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
        return await interaction.editReply({
            content: '❌ I need the "Create Instant Invite" permission to create invite links.'
        });
    }

    // Check if bot can assign the specified role
    if (role.position >= interaction.guild.members.me.roles.highest.position) {
        return await interaction.editReply({
            content: '❌ I cannot assign roles that are higher than or equal to my highest role.'
        });
    }

    try {
        // Create the invite
        const invite = await channel.createInvite({
            maxAge: maxAge,
            maxUses: maxUses,
            unique: true,
            reason: `Tracked invite created by ${interaction.user.tag}`
        });

        // Track the invite
        await inviteTracker.addInvite(interaction.guild.id, invite.code, {
            name: name,
            roleId: role.id,
            createdBy: interaction.user.id,
            createdAt: Date.now(),
            channelId: channel.id,
            uses: 0
        });

        // Map the invite to the role
        await roleManager.mapInviteToRole(interaction.guild.id, invite.code, role.id);

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Tracked Invite Created')
            .addFields(
                { name: 'Name', value: name, inline: true },
                { name: 'Role', value: role.toString(), inline: true },
                { name: 'Channel', value: channel.toString(), inline: true },
                { name: 'Invite Link', value: `https://discord.gg/${invite.code}`, inline: false },
                { name: 'Max Uses', value: maxUses === 0 ? 'Unlimited' : maxUses.toString(), inline: true },
                { name: 'Expires', value: maxAge === 0 ? 'Never' : `<t:${Math.floor((Date.now() + maxAge * 1000) / 1000)}:R>`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error creating invite:', error);
        await interaction.editReply({
            content: '❌ Failed to create invite. Please check my permissions and try again.'
        });
    }
}

async function handleListInvites(interaction) {
    const invites = await inviteTracker.getGuildInvites(interaction.guild.id);
    
    if (invites.length === 0) {
        return await interaction.editReply({
            content: '📝 No tracked invites found for this server.'
        });
    }

    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('📋 Tracked Invites')
        .setTimestamp();

    let description = '';
    for (const invite of invites) {
        const role = interaction.guild.roles.cache.get(invite.roleId);
        const channel = interaction.guild.channels.cache.get(invite.channelId);
        const creator = await interaction.client.users.fetch(invite.createdBy).catch(() => null);
        
        description += `**${invite.name}**\n`;
        description += `• Code: \`${invite.code}\`\n`;
        description += `• Role: ${role ? role.toString() : 'Role Deleted'}\n`;
        description += `• Channel: ${channel ? channel.toString() : 'Channel Deleted'}\n`;
        description += `• Uses: ${invite.uses}\n`;
        description += `• Creator: ${creator ? creator.tag : 'Unknown'}\n`;
        description += `• Created: <t:${Math.floor(invite.createdAt / 1000)}:R>\n\n`;
    }

    embed.setDescription(description);

    await interaction.editReply({ embeds: [embed] });
}

async function handleDeleteInvite(interaction) {
    const code = interaction.options.getString('code');
    
    try {
        // Try to delete the invite from Discord
        const invite = await interaction.guild.invites.fetch(code).catch(() => null);
        if (invite) {
            await invite.delete('Deleted via bot command');
        }

        // Remove from tracking
        const removed = await inviteTracker.removeInvite(interaction.guild.id, code);
        await roleManager.unmapInvite(interaction.guild.id, code);

        if (removed) {
            await interaction.editReply({
                content: `✅ Successfully deleted tracked invite: \`${code}\``
            });
        } else {
            await interaction.editReply({
                content: `⚠️ Invite code \`${code}\` was not found in tracking system, but Discord invite was deleted if it existed.`
            });
        }

    } catch (error) {
        console.error('Error deleting invite:', error);
        await interaction.editReply({
            content: '❌ Failed to delete invite. Please check the invite code and try again.'
        });
    }
}

async function handleInviteStats(interaction) {
    const invites = await inviteTracker.getGuildInvites(interaction.guild.id);
    
    if (invites.length === 0) {
        return await interaction.editReply({
            content: '📊 No tracked invites found for statistics.'
        });
    }

    const totalUses = invites.reduce((sum, invite) => sum + invite.uses, 0);
    const activeInvites = invites.filter(invite => {
        const role = interaction.guild.roles.cache.get(invite.roleId);
        return role !== undefined;
    }).length;

    const embed = new EmbedBuilder()
        .setColor(0xFF9900)
        .setTitle('📊 Invite Statistics')
        .addFields(
            { name: 'Total Tracked Invites', value: invites.length.toString(), inline: true },
            { name: 'Active Invites', value: activeInvites.toString(), inline: true },
            { name: 'Total Uses', value: totalUses.toString(), inline: true }
        )
        .setTimestamp();

    // Add top invites by usage
    const sortedInvites = invites.sort((a, b) => b.uses - a.uses).slice(0, 5);
    if (sortedInvites.length > 0) {
        let topInvitesText = '';
        sortedInvites.forEach((invite, index) => {
            topInvitesText += `${index + 1}. **${invite.name}** - ${invite.uses} uses\n`;
        });
        embed.addFields({ name: 'Top 5 Most Used Invites', value: topInvitesText, inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
}
