/**
 * Index Sync Worker
 * Issue #934: Advanced Elasticsearch-Powered Search with Personalized Recommendations
 * 
 * Synchronizes MongoDB data with Elasticsearch indices.
 */

const { client, INDICES } = require('../config/elasticsearch');

class IndexSyncWorker {

    constructor() {
        this.isRunning = false;
        this.batchSize = 100;
        this.syncInterval = null;
    }

    /**
     * Start periodic sync
     */
    start(intervalMs = 5 * 60 * 1000) { // Default: every 5 minutes
        if (this.isRunning) return;

        this.isRunning = true;
        console.log('[IndexSync] Worker started');

        // Initial sync
        this.syncAll();

        // Schedule periodic syncs
        this.syncInterval = setInterval(() => this.syncAll(), intervalMs);
    }

    /**
     * Stop worker
     */
    stop() {
        this.isRunning = false;
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        console.log('[IndexSync] Worker stopped');
    }

    /**
     * Sync all collections
     */
    async syncAll() {
        console.log('[IndexSync] Starting full sync...');

        try {
            await Promise.all([
                this.syncPosts(),
                this.syncUsers(),
                this.syncHashtags()
            ]);

            console.log('[IndexSync] Full sync completed');
        } catch (error) {
            console.error('[IndexSync] Sync error:', error);
        }
    }

    /**
     * Sync posts collection
     */
    async syncPosts() {
        try {
            const Post = require('../models/Post');

            let lastId = null;
            let totalSynced = 0;

            while (true) {
                const query = lastId ? { _id: { $gt: lastId } } : {};

                const posts = await Post.find(query)
                    .sort({ _id: 1 })
                    .limit(this.batchSize)
                    .populate('author', 'username displayName')
                    .lean();

                if (posts.length === 0) break;

                const documents = posts.map(post => this.transformPost(post));
                await this.bulkIndex(INDICES.POSTS, documents);

                totalSynced += posts.length;
                lastId = posts[posts.length - 1]._id;
            }

            console.log(`[IndexSync] Synced ${totalSynced} posts`);
        } catch (error) {
            console.error('[IndexSync] Posts sync error:', error);
        }
    }

    /**
     * Sync users collection
     */
    async syncUsers() {
        try {
            const User = require('../models/User');

            let lastId = null;
            let totalSynced = 0;

            while (true) {
                const query = lastId ? { _id: { $gt: lastId } } : {};

                const users = await User.find(query)
                    .sort({ _id: 1 })
                    .limit(this.batchSize)
                    .select('-password -tokens')
                    .lean();

                if (users.length === 0) break;

                const documents = users.map(user => this.transformUser(user));
                await this.bulkIndex(INDICES.USERS, documents);

                totalSynced += users.length;
                lastId = users[users.length - 1]._id;
            }

            console.log(`[IndexSync] Synced ${totalSynced} users`);
        } catch (error) {
            console.error('[IndexSync] Users sync error:', error);
        }
    }

    /**
     * Sync hashtags
     */
    async syncHashtags() {
        try {
            const Post = require('../models/Post');

            // Aggregate hashtags from posts
            const hashtags = await Post.aggregate([
                { $unwind: '$hashtags' },
                {
                    $group: {
                        _id: '$hashtags',
                        count: { $sum: 1 },
                        lastUsed: { $max: '$createdAt' }
                    }
                },
                { $sort: { count: -1 } }
            ]);

            const documents = hashtags.map(h => ({
                _id: h._id,
                tag: h._id.replace('#', ''),
                count: h.count,
                lastUsed: h.lastUsed,
                trendScore: this.calculateTrendScore(h.count, h.lastUsed)
            }));

            await this.bulkIndex(INDICES.HASHTAGS, documents);

            console.log(`[IndexSync] Synced ${documents.length} hashtags`);
        } catch (error) {
            console.error('[IndexSync] Hashtags sync error:', error);
        }
    }

    /**
     * Transform post for Elasticsearch
     */
    transformPost(post) {
        return {
            _id: post._id.toString(),
            userId: post.author?._id?.toString() || post.userId,
            username: post.author?.username,
            displayName: post.author?.displayName,
            caption: post.caption,
            content: post.content,
            tags: post.tags || [],
            hashtags: this.extractHashtags(post.caption),
            category: post.category,
            mediaType: post.mediaType || 'text',
            visibility: post.visibility || 'public',
            tenantId: post.tenantId?.toString(),
            likes: post.likes?.length || post.likeCount || 0,
            comments: post.comments?.length || post.commentCount || 0,
            shares: post.shares || 0,
            views: post.views || 0,
            engagementScore: this.calculateEngagementScore(post),
            popularityScore: this.calculatePopularityScore(post),
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            isPublic: post.visibility !== 'private',
            location: post.location ? {
                lat: post.location.coordinates[1],
                lon: post.location.coordinates[0]
            } : null,
            embedding: post.embedding || null
        };
    }

    /**
     * Transform user for Elasticsearch
     */
    transformUser(user) {
        return {
            _id: user._id.toString(),
            username: user.username,
            displayName: user.displayName || user.name,
            firstName: user.firstName,
            lastName: user.lastName,
            bio: user.bio,
            email: user.email,
            college: user.college,
            department: user.department,
            tenantId: user.tenantId?.toString(),
            interests: user.interests || [],
            skills: user.skills || [],
            followers: user.followers?.length || user.followerCount || 0,
            following: user.following?.length || user.followingCount || 0,
            posts: user.postCount || 0,
            verified: user.verified || false,
            createdAt: user.createdAt,
            lastActive: user.lastActive || user.updatedAt,
            embedding: user.embedding || null
        };
    }

    /**
     * Extract hashtags from text
     */
    extractHashtags(text) {
        if (!text) return [];
        const matches = text.match(/#[\w]+/g);
        return matches ? matches.map(h => h.toLowerCase()) : [];
    }

    /**
     * Calculate engagement score
     */
    calculateEngagementScore(post) {
        const likes = post.likes?.length || post.likeCount || 0;
        const comments = post.comments?.length || post.commentCount || 0;
        const shares = post.shares || 0;
        const views = post.views || 1;

        // Weighted engagement rate
        const engagement = (likes * 1 + comments * 3 + shares * 5) / views;

        // Time decay
        const ageInHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
        const decay = Math.pow(0.95, ageInHours / 24);

        return engagement * decay * 100;
    }

    /**
     * Calculate popularity score
     */
    calculatePopularityScore(post) {
        const likes = post.likes?.length || post.likeCount || 0;
        const comments = post.comments?.length || post.commentCount || 0;
        const shares = post.shares || 0;

        return likes * 1 + comments * 2 + shares * 3;
    }

    /**
     * Calculate trend score
     */
    calculateTrendScore(count, lastUsed) {
        const ageInHours = (Date.now() - new Date(lastUsed).getTime()) / (1000 * 60 * 60);
        const recencyBoost = Math.max(0, 1 - ageInHours / 168); // 7-day decay

        return count * (1 + recencyBoost);
    }

    /**
     * Bulk index documents
     */
    async bulkIndex(index, documents) {
        if (documents.length === 0) return;

        try {
            const operations = documents.flatMap(doc => [
                { index: { _index: index, _id: doc._id } },
                doc
            ]);

            const result = await client.bulk({ body: operations, refresh: false });

            if (result.errors) {
                const errors = result.items.filter(i => i.index?.error);
                console.error(`[IndexSync] Bulk errors:`, errors.length);
            }
        } catch (error) {
            console.error('[IndexSync] Bulk index error:', error);
        }
    }

    /**
     * Index single post (for real-time updates)
     */
    async indexPost(post) {
        try {
            const document = this.transformPost(post);

            await client.index({
                index: INDICES.POSTS,
                id: document._id,
                body: document,
                refresh: true
            });
        } catch (error) {
            console.error('[IndexSync] Index post error:', error);
        }
    }

    /**
     * Index single user (for real-time updates)
     */
    async indexUser(user) {
        try {
            const document = this.transformUser(user);

            await client.index({
                index: INDICES.USERS,
                id: document._id,
                body: document,
                refresh: true
            });
        } catch (error) {
            console.error('[IndexSync] Index user error:', error);
        }
    }

    /**
     * Delete document
     */
    async deleteDocument(index, id) {
        try {
            await client.delete({
                index,
                id,
                refresh: true
            });
        } catch (error) {
            if (error.meta?.statusCode !== 404) {
                console.error('[IndexSync] Delete error:', error);
            }
        }
    }

    /**
     * Get sync status
     */
    async getStatus() {
        try {
            const stats = {};

            for (const [key, index] of Object.entries(INDICES)) {
                try {
                    const count = await client.count({ index });
                    stats[key] = { indexed: count.count };
                } catch {
                    stats[key] = { indexed: 0 };
                }
            }

            return {
                isRunning: this.isRunning,
                indices: stats
            };
        } catch (error) {
            console.error('[IndexSync] Status error:', error);
            return { isRunning: this.isRunning, error: error.message };
        }
    }
}

module.exports = new IndexSyncWorker();
