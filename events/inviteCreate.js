module.exports = {
    name: 'inviteCreate',
    async execute(invite) {
        try {
            // Update the stored invites for this guild
            const guildInvites = invite.client.invites.get(invite.guild.id) || new Map();
            guildInvites.set(invite.code, invite.uses || 0);
            invite.client.invites.set(invite.guild.id, guildInvites);
            
            console.log(`New invite created: ${invite.code} in ${invite.guild.name}`);
        } catch (error) {
            console.error('Error handling invite creation:', error);
        }
    },
};
