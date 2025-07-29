const inviteTracker = require('../utils/inviteTracker');
const roleManager = require('../utils/roleManager');

module.exports = {
    name: 'inviteDelete',
    async execute(invite) {
        try {
            // Remove from stored invites
            const guildInvites = invite.client.invites.get(invite.guild.id) || new Map();
            guildInvites.delete(invite.code);
            invite.client.invites.set(invite.guild.id, guildInvites);
            
            // Remove from tracking system if it was being tracked
            await inviteTracker.removeInvite(invite.guild.id, invite.code);
            await roleManager.unmapInvite(invite.guild.id, invite.code);
            
            console.log(`Invite deleted: ${invite.code} from ${invite.guild.name}`);
        } catch (error) {
            console.error('Error handling invite deletion:', error);
        }
    },
};
