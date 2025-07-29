const inviteTracker = require('../utils/inviteTracker');
const roleManager = require('../utils/roleManager');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        try {
            // Wait a moment for Discord to update invite uses
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Get current invites
            let newInvites;
            try {
                newInvites = await member.guild.invites.fetch();
            } catch (error) {
                if (error.code === 50013) {
                    console.log(`Bot needs "Manage Server" permission in ${member.guild.name} to track invite usage. Role assignment may not work for this guild.`);
                    return;
                }
                throw error;
            }
            const oldInvites = member.client.invites.get(member.guild.id) || new Map();

            // Find which invite was used
            let usedInvite = null;
            for (const [code, invite] of newInvites) {
                const oldUses = oldInvites.get(code) || 0;
                if (invite.uses > oldUses) {
                    usedInvite = { code, uses: invite.uses };
                    break;
                }
            }

            // Update stored invites
            member.client.invites.set(member.guild.id, new Map(newInvites.map(invite => [invite.code, invite.uses])));

            if (!usedInvite) {
                console.log(`Could not determine which invite ${member.user.tag} used to join ${member.guild.name}`);
                return;
            }

            console.log(`${member.user.tag} joined ${member.guild.name} using invite ${usedInvite.code}`);

            // Update invite usage in tracker
            await inviteTracker.incrementInviteUse(member.guild.id, usedInvite.code);

            // Get the role to assign
            const roleId = await roleManager.getRoleForInvite(member.guild.id, usedInvite.code);
            
            if (!roleId) {
                console.log(`No role mapping found for invite ${usedInvite.code}`);
                return;
            }

            const role = member.guild.roles.cache.get(roleId);
            if (!role) {
                console.log(`Role ${roleId} not found for invite ${usedInvite.code}`);
                return;
            }

            // Check if bot has permission to assign roles
            if (!member.guild.members.me.permissions.has('ManageRoles')) {
                console.error('Bot does not have permission to manage roles');
                return;
            }

            // Check if the role is assignable (not higher than bot's highest role)
            if (role.position >= member.guild.members.me.roles.highest.position) {
                console.error(`Cannot assign role ${role.name} - it's higher than bot's highest role`);
                return;
            }

            // Assign the role
            try {
                await member.roles.add(role, `Joined via tracked invite: ${usedInvite.code}`);
                console.log(`Assigned role ${role.name} to ${member.user.tag} for using invite ${usedInvite.code}`);

                // Try to send a welcome message to the member (optional)
                try {
                    const inviteData = await inviteTracker.getInvite(member.guild.id, usedInvite.code);
                    if (inviteData) {
                        await member.send(`Welcome to **${member.guild.name}**! You've been automatically assigned the **${role.name}** role for joining via the "${inviteData.name}" invite link.`);
                    }
                } catch (dmError) {
                    // User has DMs disabled or other issue - not critical
                    console.log(`Could not send welcome DM to ${member.user.tag}:`, dmError.message);
                }

            } catch (roleError) {
                console.error(`Failed to assign role ${role.name} to ${member.user.tag}:`, roleError);
            }

        } catch (error) {
            console.error('Error in guildMemberAdd event:', error);
        }
    },
};
