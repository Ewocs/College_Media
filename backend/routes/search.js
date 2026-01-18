/**
 * Search Routes
 * Issue #934: Advanced Elasticsearch-Powered Search with Personalized Recommendations
 * 
 * API routes for search functionality.
 */

const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

// Middleware (simplified - use actual auth middleware in production)
const authMiddleware = (req, res, next) => next();
const optionalAuthMiddleware = (req, res, next) => next();
const adminMiddleware = (req, res, next) => next();

/**
 * @swagger
 * /api/search:
 *   post:
 *     summary: Full-text search with filters
 *     tags: [Search]
 */
router.post('/', optionalAuthMiddleware, searchController.search);

/**
 * @swagger
 * /api/search/autocomplete:
 *   get:
 *     summary: Get autocomplete suggestions
 *     tags: [Search]
 */
router.get('/autocomplete', optionalAuthMiddleware, searchController.autocomplete);

/**
 * @swagger
 * /api/search/recommendations:
 *   get:
 *     summary: Get personalized recommendations
 *     tags: [Search]
 */
router.get('/recommendations', optionalAuthMiddleware, searchController.getRecommendations);

/**
 * @swagger
 * /api/search/trending:
 *   get:
 *     summary: Get trending content
 *     tags: [Search]
 */
router.get('/trending', optionalAuthMiddleware, searchController.getTrending);

/**
 * @swagger
 * /api/search/hashtags/trending:
 *   get:
 *     summary: Get trending hashtags
 *     tags: [Search]
 */
router.get('/hashtags/trending', optionalAuthMiddleware, searchController.getTrendingHashtags);

/**
 * @swagger
 * /api/search/similar/:id:
 *   get:
 *     summary: Find similar content
 *     tags: [Search]
 */
router.get('/similar/:id', optionalAuthMiddleware, searchController.findSimilar);

/**
 * @swagger
 * /api/search/reindex:
 *   post:
 *     summary: Trigger reindexing (admin)
 *     tags: [Search]
 */
router.post('/reindex', authMiddleware, adminMiddleware, searchController.reindex);

/**
 * @swagger
 * /api/search/stats:
 *   get:
 *     summary: Get search index statistics (admin)
 *     tags: [Search]
 */
router.get('/stats', authMiddleware, adminMiddleware, searchController.getStats);

module.exports = router;
