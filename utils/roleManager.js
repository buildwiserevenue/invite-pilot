const fs = require('fs').promises;
const path = require('path');

const ROLE_MAPPINGS_FILE = path.join(__dirname, '../data/roleMappings.json');

class RoleManager {
    constructor() {
        this.mappings = new Map();
        this.loadMappings();
    }

    async loadMappings() {
        try {
            const data = await fs.readFile(ROLE_MAPPINGS_FILE, 'utf8');
            const mappingData = JSON.parse(data);
            
            // Convert back to Map structure
            for (const [guildId, guildMappings] of Object.entries(mappingData)) {
                this.mappings.set(guildId, new Map(Object.entries(guildMappings)));
            }
        } catch (error) {
            // File doesn't exist or is empty, start with empty data
            console.log('No existing role mapping data found, starting fresh');
        }
    }

    async saveMappings() {
        try {
            // Convert Map to plain object for JSON serialization
            const dataToSave = {};
            for (const [guildId, guildMappings] of this.mappings) {
                dataToSave[guildId] = Object.fromEntries(guildMappings);
            }

            await fs.writeFile(ROLE_MAPPINGS_FILE, JSON.stringify(dataToSave, null, 2));
        } catch (error) {
            console.error('Error saving role mapping data:', error);
        }
    }

    async mapInviteToRole(guildId, inviteCode, roleId) {
        if (!this.mappings.has(guildId)) {
            this.mappings.set(guildId, new Map());
        }
        
        this.mappings.get(guildId).set(inviteCode, roleId);
        await this.saveMappings();
    }

    async unmapInvite(guildId, inviteCode) {
        if (!this.mappings.has(guildId)) {
            return false;
        }
        
        const removed = this.mappings.get(guildId).delete(inviteCode);
        if (removed) {
            await this.saveMappings();
        }
        return removed;
    }

    async getRoleForInvite(guildId, inviteCode) {
        if (!this.mappings.has(guildId)) {
            return null;
        }
        
        return this.mappings.get(guildId).get(inviteCode) || null;
    }

    async getGuildMappings(guildId) {
        if (!this.mappings.has(guildId)) {
            return [];
        }
        
        const guildMappings = this.mappings.get(guildId);
        return Array.from(guildMappings.entries()).map(([inviteCode, roleId]) => ({
            inviteCode,
            roleId
        }));
    }

    async updateRoleMapping(guildId, inviteCode, newRoleId) {
        return await this.mapInviteToRole(guildId, inviteCode, newRoleId);
    }
}

module.exports = new RoleManager();
