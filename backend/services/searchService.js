/**
 * Search Service
 * Issue #934: Advanced Elasticsearch-Powered Search with Personalized Recommendations
 * 
 * Comprehensive Elasticsearch service layer with ML-based recommendations.
 */

const { client, INDICES } = require('../config/elasticsearch');

class SearchService {

  /**
   * Full-text search with faceted filtering
   */
  async search(query, options = {}) {
    const {
      type = 'all',
      filters = {},
      sort = 'relevance',
      from = 0,
      size = 20,
      userId = null,
      tenantId = null,
      includeAggregations = true
    } = options;

    try {
      const indices = this.getSearchIndices(type);
      const esQuery = this.buildSearchQuery(query, filters, tenantId);
      const sortConfig = this.buildSortConfig(sort);

      const searchBody = {
        query: esQuery,
        from,
        size,
        sort: sortConfig,
        highlight: {
          fields: {
            caption: { pre_tags: ['<mark>'], post_tags: ['</mark>'] },
            content: { pre_tags: ['<mark>'], post_tags: ['</mark>'] },
            bio: { pre_tags: ['<mark>'], post_tags: ['</mark>'] }
          }
        }
      };

      // Add aggregations for faceted search
      if (includeAggregations) {
        searchBody.aggs = this.buildAggregations(type);
      }

      const result = await client.search({
        index: indices,
        body: searchBody
      });

      // Track search for personalization
      if (userId) {
        this.trackSearch(userId, query, filters, result.hits.total.value, tenantId);
      }

      return this.formatSearchResults(result, type);
    } catch (error) {
      console.error('[SearchService] Search error:', error);
      throw error;
    }
  }

  /**
   * Autocomplete suggestions
   */
  async autocomplete(prefix, options = {}) {
    const {
      type = 'all',
      size = 10,
      tenantId = null
    } = options;

    try {
      const suggestions = [];

      // Post caption suggestions
      if (type === 'all' || type === 'posts') {
        const postSuggestions = await client.search({
          index: INDICES.POSTS,
          body: {
            query: {
              bool: {
                must: [
                  {
                    multi_match: {
                      query: prefix,
                      type: 'phrase_prefix',
                      fields: ['caption.autocomplete', 'tags']
                    }
                  }
                ],
                filter: tenantId ? [{ term: { tenantId } }] : []
              }
            },
            size: size,
            _source: ['caption', 'category']
          }
        });

        suggestions.push(...postSuggestions.hits.hits.map(hit => ({
          type: 'post',
          text: hit._source.caption?.substring(0, 100),
          category: hit._source.category
        })));
      }

      // User suggestions
      if (type === 'all' || type === 'users') {
        const userSuggestions = await client.search({
          index: INDICES.USERS,
          body: {
            query: {
              bool: {
                must: [
                  {
                    multi_match: {
                      query: prefix,
                      type: 'phrase_prefix',
                      fields: ['username.autocomplete', 'displayName.autocomplete']
                    }
                  }
                ],
                filter: tenantId ? [{ term: { tenantId } }] : []
              }
            },
            size: size,
            _source: ['username', 'displayName', 'verified']
          }
        });

        suggestions.push(...userSuggestions.hits.hits.map(hit => ({
          type: 'user',
          text: hit._source.username,
          displayName: hit._source.displayName,
          verified: hit._source.verified
        })));
      }

      // Hashtag suggestions
      if (type === 'all' || type === 'hashtags') {
        const hashtagSuggestions = await client.search({
          index: INDICES.HASHTAGS,
          body: {
            query: {
              bool: {
                must: [
                  {
                    prefix: {
                      'tag.keyword': prefix.replace('#', '')
                    }
                  }
                ],
                filter: tenantId ? [{ term: { tenantId } }] : []
              }
            },
            size: size,
            sort: [{ count: 'desc' }],
            _source: ['tag', 'count']
          }
        });

        suggestions.push(...hashtagSuggestions.hits.hits.map(hit => ({
          type: 'hashtag',
          text: `#${hit._source.tag}`,
          count: hit._source.count
        })));
      }

      return suggestions.slice(0, size);
    } catch (error) {
      console.error('[SearchService] Autocomplete error:', error);
      return [];
    }
  }

  /**
   * Get personalized recommendations using ML similarity
   */
  async getRecommendations(userId, options = {}) {
    const {
      type = 'posts',
      size = 20,
      tenantId = null
    } = options;

    try {
      // Get user's embedding
      const user = await client.get({
        index: INDICES.USERS,
        id: userId
      }).catch(() => null);

      if (!user || !user._source.embedding) {
        // Fallback to popular content
        return this.getPopularContent(type, size, tenantId);
      }

      const userEmbedding = user._source.embedding;

      // KNN search for similar content
      const result = await client.search({
        index: type === 'posts' ? INDICES.POSTS : INDICES.USERS,
        body: {
          knn: {
            field: 'embedding',
            query_vector: userEmbedding,
            k: size,
            num_candidates: size * 5
          },
          _source: {
            excludes: ['embedding']
          }
        }
      });

      return result.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
        reason: 'personalized'
      }));
    } catch (error) {
      console.error('[SearchService] Recommendations error:', error);
      return this.getPopularContent(type, size, tenantId);
    }
  }

  /**
   * Find similar content using embeddings
   */
  async findSimilar(id, type = 'posts', size = 10) {
    try {
      const index = type === 'posts' ? INDICES.POSTS : INDICES.USERS;

      // Get the source document
      const doc = await client.get({ index, id });

      if (!doc._source.embedding) {
        return [];
      }

      // KNN search
      const result = await client.search({
        index,
        body: {
          knn: {
            field: 'embedding',
            query_vector: doc._source.embedding,
            k: size + 1, // +1 to exclude self
            num_candidates: size * 5
          },
          _source: {
            excludes: ['embedding']
          }
        }
      });

      return result.hits.hits
        .filter(hit => hit._id !== id)
        .slice(0, size)
        .map(hit => ({
          id: hit._id,
          score: hit._score,
          ...hit._source
        }));
    } catch (error) {
      console.error('[SearchService] Find similar error:', error);
      return [];
    }
  }

  /**
   * Get trending content
   */
  async getTrending(options = {}) {
    const {
      type = 'posts',
      size = 20,
      hours = 24,
      tenantId = null
    } = options;

    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const result = await client.search({
        index: type === 'posts' ? INDICES.POSTS : INDICES.HASHTAGS,
        body: {
          query: {
            bool: {
              must: [
                { range: { createdAt: { gte: since.toISOString() } } }
              ],
              filter: tenantId ? [{ term: { tenantId } }] : []
            }
          },
          sort: [
            { engagementScore: 'desc' },
            { likes: 'desc' }
          ],
          size,
          _source: {
            excludes: ['embedding']
          }
        }
      });

      return result.hits.hits.map(hit => ({
        id: hit._id,
        ...hit._source
      }));
    } catch (error) {
      console.error('[SearchService] Trending error:', error);
      return [];
    }
  }

  /**
   * Get popular content (fallback for cold start)
   */
  async getPopularContent(type = 'posts', size = 20, tenantId = null) {
    try {
      const result = await client.search({
        index: type === 'posts' ? INDICES.POSTS : INDICES.USERS,
        body: {
          query: {
            bool: {
              filter: tenantId ? [{ term: { tenantId } }] : []
            }
          },
          sort: [
            { engagementScore: 'desc' },
            { likes: 'desc' },
            { createdAt: 'desc' }
          ],
          size,
          _source: {
            excludes: ['embedding']
          }
        }
      });

      return result.hits.hits.map(hit => ({
        id: hit._id,
        ...hit._source,
        reason: 'popular'
      }));
    } catch (error) {
      console.error('[SearchService] Popular content error:', error);
      return [];
    }
  }

  /**
   * Index a document
   */
  async indexDocument(index, id, document) {
    try {
      await client.index({
        index,
        id,
        body: document,
        refresh: true
      });
      return true;
    } catch (error) {
      console.error('[SearchService] Index error:', error);
      return false;
    }
  }

  /**
   * Update a document
   */
  async updateDocument(index, id, updates) {
    try {
      await client.update({
        index,
        id,
        body: { doc: updates },
        refresh: true
      });
      return true;
    } catch (error) {
      console.error('[SearchService] Update error:', error);
      return false;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(index, id) {
    try {
      await client.delete({
        index,
        id,
        refresh: true
      });
      return true;
    } catch (error) {
      console.error('[SearchService] Delete error:', error);
      return false;
    }
  }

  /**
   * Bulk index documents
   */
  async bulkIndex(index, documents) {
    try {
      const operations = documents.flatMap(doc => [
        { index: { _index: index, _id: doc._id || doc.id } },
        doc
      ]);

      const result = await client.bulk({ body: operations, refresh: true });

      return {
        success: !result.errors,
        indexed: documents.length,
        errors: result.errors ? result.items.filter(i => i.index.error) : []
      };
    } catch (error) {
      console.error('[SearchService] Bulk index error:', error);
      throw error;
    }
  }

  // Private helper methods

  getSearchIndices(type) {
    switch (type) {
      case 'posts': return INDICES.POSTS;
      case 'users': return INDICES.USERS;
      case 'comments': return INDICES.COMMENTS;
      case 'hashtags': return INDICES.HASHTAGS;
      case 'all':
      default:
        return [INDICES.POSTS, INDICES.USERS, INDICES.HASHTAGS];
    }
  }

  buildSearchQuery(query, filters, tenantId) {
    const must = [];
    const filter = [];

    // Main query
    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['caption^3', 'content^2', 'username^2', 'displayName', 'bio', 'tags^2'],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      });
    }

    // Apply filters
    if (filters.category) {
      filter.push({ term: { category: filters.category } });
    }
    if (filters.mediaType) {
      filter.push({ term: { mediaType: filters.mediaType } });
    }
    if (filters.dateFrom) {
      filter.push({ range: { createdAt: { gte: filters.dateFrom } } });
    }
    if (filters.dateTo) {
      filter.push({ range: { createdAt: { lte: filters.dateTo } } });
    }
    if (filters.verified !== undefined) {
      filter.push({ term: { verified: filters.verified } });
    }
    if (filters.hashtags && filters.hashtags.length > 0) {
      filter.push({ terms: { hashtags: filters.hashtags } });
    }
    if (tenantId) {
      filter.push({ term: { tenantId } });
    }

    return {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        filter
      }
    };
  }

  buildSortConfig(sort) {
    switch (sort) {
      case 'date':
        return [{ createdAt: 'desc' }];
      case 'popular':
        return [{ likes: 'desc' }, { createdAt: 'desc' }];
      case 'engagement':
        return [{ engagementScore: 'desc' }];
      case 'relevance':
      default:
        return ['_score', { createdAt: 'desc' }];
    }
  }

  buildAggregations(type) {
    const aggs = {};

    if (type === 'posts' || type === 'all') {
      aggs.categories = {
        terms: { field: 'category', size: 20 }
      };
      aggs.mediaTypes = {
        terms: { field: 'mediaType', size: 10 }
      };
      aggs.hashtags = {
        terms: { field: 'hashtags', size: 30 }
      };
      aggs.dateHistogram = {
        date_histogram: {
          field: 'createdAt',
          calendar_interval: 'day',
          min_doc_count: 1
        }
      };
    }

    if (type === 'users' || type === 'all') {
      aggs.colleges = {
        terms: { field: 'college', size: 20 }
      };
      aggs.departments = {
        terms: { field: 'department', size: 20 }
      };
    }

    return aggs;
  }

  formatSearchResults(result, type) {
    const hits = result.hits.hits.map(hit => ({
      id: hit._id,
      index: hit._index,
      score: hit._score,
      ...hit._source,
      highlights: hit.highlight
    }));

    const response = {
      total: result.hits.total.value,
      hits,
      took: result.took
    };

    // Include aggregations
    if (result.aggregations) {
      response.facets = {};

      for (const [key, agg] of Object.entries(result.aggregations)) {
        if (agg.buckets) {
          response.facets[key] = agg.buckets.map(b => ({
            value: b.key,
            count: b.doc_count
          }));
        }
      }
    }

    return response;
  }

  async trackSearch(userId, query, filters, resultCount, tenantId) {
    try {
      await client.index({
        index: INDICES.SEARCH_HISTORY,
        body: {
          userId,
          query,
          filters,
          resultCount,
          tenantId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[SearchService] Track search error:', error);
    }
  }
}

module.exports = new SearchService();
