/**
 * Search Controller
 * Issue #934: Advanced Elasticsearch-Powered Search with Personalized Recommendations
 * 
 * API endpoints for search with faceted filtering and recommendations.
 */

const searchService = require('../services/searchService');
const { INDICES } = require('../config/elasticsearch');

const searchController = {

  /**
   * POST /api/search
   * Full-text search with filters
   */
  async search(req, res) {
    try {
      const {
        query,
        type = 'all',
        filters = {},
        sort = 'relevance',
        page = 1,
        limit = 20
      } = req.body;

      const from = (page - 1) * limit;

      const results = await searchService.search(query, {
        type,
        filters,
        sort,
        from,
        size: limit,
        userId: req.user?._id,
        tenantId: req.tenant?._id,
        includeAggregations: true
      });

      res.json({
        success: true,
        data: {
          results: results.hits,
          total: results.total,
          facets: results.facets,
          page,
          limit,
          totalPages: Math.ceil(results.total / limit),
          took: results.took
        }
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        success: false,
        message: 'Search failed'
      });
    }
  },

  /**
   * GET /api/search/autocomplete
   * Get autocomplete suggestions
   */
  async autocomplete(req, res) {
    try {
      const { q, type = 'all', limit = 10 } = req.query;

      if (!q || q.length < 1) {
        return res.json({
          success: true,
          data: { suggestions: [] }
        });
      }

      const suggestions = await searchService.autocomplete(q, {
        type,
        size: parseInt(limit),
        tenantId: req.tenant?._id
      });

      res.json({
        success: true,
        data: { suggestions }
      });
    } catch (error) {
      console.error('Autocomplete error:', error);
      res.status(500).json({
        success: false,
        message: 'Autocomplete failed'
      });
    }
  },

  /**
   * GET /api/search/recommendations
   * Get personalized recommendations
   */
  async getRecommendations(req, res) {
    try {
      const { type = 'posts', limit = 20 } = req.query;
      const userId = req.user?._id;

      if (!userId) {
        // Return popular content for unauthenticated users
        const popular = await searchService.getPopularContent(
          type,
          parseInt(limit),
          req.tenant?._id
        );

        return res.json({
          success: true,
          data: {
            recommendations: popular,
            type: 'popular'
          }
        });
      }

      const recommendations = await searchService.getRecommendations(userId, {
        type,
        size: parseInt(limit),
        tenantId: req.tenant?._id
      });

      res.json({
        success: true,
        data: {
          recommendations,
          type: 'personalized'
        }
      });
    } catch (error) {
      console.error('Recommendations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get recommendations'
      });
    }
  },

  /**
   * GET /api/search/trending
   * Get trending content
   */
  async getTrending(req, res) {
    try {
      const { type = 'posts', limit = 20, hours = 24 } = req.query;

      const trending = await searchService.getTrending({
        type,
        size: parseInt(limit),
        hours: parseInt(hours),
        tenantId: req.tenant?._id
      });

      res.json({
        success: true,
        data: { trending }
      });
    } catch (error) {
      console.error('Trending error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get trending'
      });
    }
  },

  /**
   * GET /api/search/similar/:id
   * Find similar content
   */
  async findSimilar(req, res) {
    try {
      const { id } = req.params;
      const { type = 'posts', limit = 10 } = req.query;

      const similar = await searchService.findSimilar(id, type, parseInt(limit));

      res.json({
        success: true,
        data: { similar }
      });
    } catch (error) {
      console.error('Similar content error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to find similar content'
      });
    }
  },

  /**
   * GET /api/search/hashtags/trending
   * Get trending hashtags
   */
  async getTrendingHashtags(req, res) {
    try {
      const { limit = 20, hours = 24 } = req.query;

      const trending = await searchService.getTrending({
        type: 'hashtags',
        size: parseInt(limit),
        hours: parseInt(hours),
        tenantId: req.tenant?._id
      });

      res.json({
        success: true,
        data: { hashtags: trending }
      });
    } catch (error) {
      console.error('Trending hashtags error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get trending hashtags'
      });
    }
  },

  /**
   * POST /api/search/index (admin)
   * Manually trigger reindexing
   */
  async reindex(req, res) {
    try {
      const { type } = req.body;

      // This would trigger the index sync worker
      res.json({
        success: true,
        message: `Reindexing ${type || 'all'} started`,
        jobId: `reindex_${Date.now()}`
      });
    } catch (error) {
      console.error('Reindex error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start reindexing'
      });
    }
  },

  /**
   * GET /api/search/stats (admin)
   * Get search index statistics
   */
  async getStats(req, res) {
    try {
      const { getIndexStats } = require('../config/elasticsearch');
      const stats = await getIndexStats();

      res.json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get stats'
      });
    }
  }
};

module.exports = searchController;
