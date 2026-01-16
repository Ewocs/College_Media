const geoip = require('geoip-lite');
const logger = require('../utils/logger');

/**
 * Middleware to determine User's Geographic Region based on IP.
 * Maps location to nearest Database Shard (us-east, eu-west, ap-south).
 */
const geoRouting = (req, res, next) => {
    try {
        let ip = req.headers['x-forwarded-for']
            ? req.headers['x-forwarded-for'].split(',')[0]
            : req.socket.remoteAddress;

        // Handle Localhost Development
        if (ip === '::1' || ip === '127.0.0.1') {
            // Mock IP from Bangalore, India for 'ap-south' testing
            ip = '103.252.144.0';
        }

        const geo = geoip.lookup(ip);

        // Default Shard
        let region = 'us-east';

        if (geo && geo.country) {
            // Simple mapping logic
            const country = geo.country;

            if (['IN', 'JP', 'AU', 'SG', 'CN'].includes(country)) {
                region = 'ap-south';
            } else if (['GB', 'DE', 'FR', 'NL', 'RU'].includes(country)) {
                region = 'eu-west';
            } else {
                region = 'us-east';
            }
        }

        // Attach to Request
        req.region = region;
        req.country = geo ? geo.country : 'Unknown';

        // logger.debug(`🌍 GeoRouting: IP=${ip} (${req.country}) -> Shard=${region}`);
        next();

    } catch (error) {
        logger.warn('GeoRouting Error:', error);
        req.region = 'us-east'; // Fallback
        next();
    }
};

module.exports = geoRouting;
