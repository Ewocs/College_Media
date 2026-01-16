const mongoose = require('mongoose');
const logger = require('../utils/logger');

class ShardingManager {
    constructor() {
        this.connectionMap = new Map();
        this.defaultRegion = 'us-east';
    }

    /**
     * Initialize connections to all configured shards
     */
    async initShards() {
        logger.info('Initializing Database Shards...');

        // In production, these come from Vault
        const regions = [
            { id: 'us-east', uri: process.env.MONGO_URI_US || process.env.MONGO_URI },
            { id: 'eu-west', uri: process.env.MONGO_URI_EU || process.env.MONGO_URI },
            { id: 'ap-south', uri: process.env.MONGO_URI_AP || process.env.MONGO_URI }
        ];

        const connectPromises = regions.map(async (shard) => {
            if (!shard.uri) {
                logger.warn(`Skipping shard ${shard.id} (No URI)`);
                return;
            }

            try {
                const conn = mongoose.createConnection(shard.uri);

                await new Promise((resolve, reject) => {
                    conn.once('open', resolve);
                    conn.once('error', reject);
                });

                this.connectionMap.set(shard.id, conn);
                logger.info(`✅ Shard Connected: ${shard.id}`);
            } catch (error) {
                logger.error(`❌ Failed to connect to shard ${shard.id}: ${error.message}`);
            }
        });

        await Promise.all(connectPromises);
        logger.info(`Sharding Manager Initialized. Active Shards: ${this.connectionMap.size}`);
    }

    /**
     * Get the database connection for a specific region
     * @param {string} region 
     * @returns {mongoose.Connection}
     */
    getConnection(region) {
        if (this.connectionMap.has(region)) {
            return this.connectionMap.get(region);
        }
        // Fallback logic
        return this.connectionMap.get(this.defaultRegion) || this.connectionMap.values().next().value;
    }

    /**
     * Dynamically retrieve a Model scoped to a specific shard/region
     * @param {string} region 
     * @param {string} modelName 
     * @param {mongoose.Schema} schema 
     */
    getShardModel(region, modelName, schema) {
        const conn = this.getConnection(region);
        if (!conn) throw new Error('No active database shards available');

        // Mongoose handles model caching on the connection instance automatically
        return conn.model(modelName, schema);
    }
}

module.exports = new ShardingManager();
