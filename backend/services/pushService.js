const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const logger = require('../utils/logger');

// Initialize VAPID keys
// In production, these should be generated once and stored in .env
// npx web-push generate-vapid-keys
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'BGAO9y-N4g6vJ...'; // Placeholder
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || '...';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:admin@collegemedia.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
} else {
    logger.warn('VAPID keys not set. Push notifications will not work.');
}

class PushService {
    /**
     * Save a new subscription
     */
    static async subscribe(userId, subscription, userAgent) {
        try {
            if (!subscription || !subscription.endpoint) {
                throw new Error('Invalid subscription object');
            }

            await PushSubscription.findOneAndUpdate(
                { user: userId, endpoint: subscription.endpoint },
                {
                    user: userId,
                    endpoint: subscription.endpoint,
                    keys: subscription.keys,
                    userAgent,
                    createdAt: new Date() // Updates expiration
                },
                { upsert: true, new: true }
            );

            logger.info(`Push subscription saved for user ${userId}`);
        } catch (error) {
            logger.error('Push subscribe error:', error);
            throw error;
        }
    }

    /**
     * Send notification to a user
     */
    static async sendNotification(userId, payload) {
        try {
            const subscriptions = await PushSubscription.find({ user: userId });

            if (subscriptions.length === 0) return;

            const notificationPayload = JSON.stringify(payload);
            const promises = subscriptions.map(sub =>
                webpush.sendNotification(sub, notificationPayload)
                    .catch(async err => {
                        if (err.statusCode === 410 || err.statusCode === 404) {
                            // Subscription is invalid/expired, remove it
                            await PushSubscription.findByIdAndDelete(sub._id);
                        } else {
                            logger.error(`Failed to send push to ${sub._id}:`, err);
                        }
                    })
            );

            await Promise.all(promises);
            logger.info(`Push notification sent to user ${userId}`);
        } catch (error) {
            logger.error('Send push error:', error);
        }
    }

    /**
     * Send to multiple users
     */
    static async sendToUsers(userIds, payload) {
        // Logic to send to multiple users
        for (const id of userIds) {
            await this.sendNotification(id, payload);
        }
    }
}

module.exports = PushService;
