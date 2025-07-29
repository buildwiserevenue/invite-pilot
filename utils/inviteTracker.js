const fs = require('fs').promises;
const path = require('path');

const INVITES_FILE = path.join(__dirname, '../data/invites.json');

class InviteTracker {
    constructor() {
        this.invites = new Map();
        this.loadInvites();
    }

    async loadInvites() {
        try {
            const data = await fs.readFile(INVITES_FILE, 'utf8');
            const inviteData = JSON.parse(data);
            
            // Convert back to Map structure
            for (const [guildId, guildInvites] of Object.entries(inviteData)) {
                this.invites.set(guildId, new Map(Object.entries(guildInvites)));
            }
        } catch (error) {
            // File doesn't exist or is empty, start with empty data
            console.log('No existing invite data found, starting fresh');
        }
    }

    async saveInvites() {
        try {
            // Convert Map to plain object for JSON serialization
            const dataToSave = {};
            for (const [guildId, guildInvites] of this.invites) {
                dataToSave[guildId] = Object.fromEntries(guildInvites);
            }

            await fs.writeFile(INVITES_FILE, JSON.stringify(dataToSave, null, 2));
        } catch (error) {
            console.error('Error saving invite data:', error);
        }
    }

    async addInvite(guildId, inviteCode, inviteData) {
        if (!this.invites.has(guildId)) {
            this.invites.set(guildId, new Map());
        }
        
        this.invites.get(guildId).set(inviteCode, inviteData);
        await this.saveInvites();
    }

    async removeInvite(guildId, inviteCode) {
        if (!this.invites.has(guildId)) {
            return false;
        }
        
        const removed = this.invites.get(guildId).delete(inviteCode);
        if (removed) {
            await this.saveInvites();
        }
        return removed;
    }

    async getInvite(guildId, inviteCode) {
        if (!this.invites.has(guildId)) {
            return null;
        }
        
        return this.invites.get(guildId).get(inviteCode) || null;
    }

    async getGuildInvites(guildId) {
        if (!this.invites.has(guildId)) {
            return [];
        }
        
        const guildInvites = this.invites.get(guildId);
        return Array.from(guildInvites.entries()).map(([code, data]) => ({
            code,
            ...data
        }));
    }

    async incrementInviteUse(guildId, inviteCode) {
        const invite = await this.getInvite(guildId, inviteCode);
        if (invite) {
            invite.uses = (invite.uses || 0) + 1;
            await this.addInvite(guildId, inviteCode, invite);
        }
    }

    async getInviteStats(guildId) {
        const invites = await this.getGuildInvites(guildId);
        
        return {
            totalInvites: invites.length,
            totalUses: invites.reduce((sum, invite) => sum + (invite.uses || 0), 0),
            mostUsed: invites.sort((a, b) => (b.uses || 0) - (a.uses || 0))[0] || null
        };
    }
}

module.exports = new InviteTracker();
