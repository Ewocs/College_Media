const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'college_media_secret_key';

const context = ({ req }) => {
    const token = req.headers.authorization || '';

    if (token) {
        try {
            // Remove 'Bearer ' if present
            const actualToken = token.startsWith('Bearer ') ? token.slice(7) : token;
            const decoded = jwt.verify(actualToken, JWT_SECRET);
            return { user: decoded };
        } catch (err) {
            // Invalid token, just return null user (optional auth or public queries)
            return { user: null };
        }
    }

    return { user: null };
};

module.exports = context;
