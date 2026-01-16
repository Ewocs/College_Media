const ShardingManager = require('../config/sharding');
const User = require('../models/User'); // Used only for Schema access
const logger = require('../utils/logger');

class UserService {
    /**
     * Create a new user in the optimal shard
     * @param {object} userData 
     * @param {string} region 
     */
    async createUser(userData, region = 'us-east') {
        try {
            // 1. Get Model attached to the specific Shard Connection
            const UserModel = ShardingManager.getShardModel(region, 'User', User.schema);

            // 2. Create User
            const user = new UserModel({
                ...userData,
                region: region // Store region for future lookups
            });

            return await user.save();
        } catch (error) {
            logger.error(`Failed to create user in shard ${region}:`, error);
            throw error;
        }
    }

    /**
     * Find a user by ID
     * Needs region hint, otherwise must query all shards (Scatter-Gather) or use a Lookup Service.
     * For this implementation, we assume caller provides region (e.g. from JWT or GeoIP/Session).
     */
    async getUserById(userId, region = 'us-east') {
        try {
            const UserModel = ShardingManager.getShardModel(region, 'User', User.schema);
            return await UserModel.findById(userId);
        } catch (error) {
            // Fallback: Check default shard if not found?
            // logger.debug(`User ${userId} not found in ${region}, checking default...`);
            throw error;
        }
    }
}

module.exports = new UserService();
