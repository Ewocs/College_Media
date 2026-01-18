/**
 * Elasticsearch Configuration
 * Issue #934: Advanced Elasticsearch-Powered Search with Personalized Recommendations
 * 
 * Enhanced configuration with ML embeddings and autocomplete support.
 */

const { Client } = require('@elastic/elasticsearch');

// Elasticsearch client configuration
const elasticsearchConfig = {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    auth: process.env.ELASTICSEARCH_USERNAME ? {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD
    } : undefined,
    maxRetries: 5,
    requestTimeout: 60000,
    sniffOnStart: false
};

// Create Elasticsearch client
const client = new Client(elasticsearchConfig);

// Index names
const INDICES = {
    POSTS: 'college_media_posts',
    USERS: 'college_media_users',
    COMMENTS: 'college_media_comments',
    HASHTAGS: 'college_media_hashtags',
    SEARCH_HISTORY: 'college_media_search_history'
};

// Enhanced index mappings with ML support
const INDEX_MAPPINGS = {
    posts: {
        properties: {
            userId: { type: 'keyword' },
            username: { type: 'keyword' },
            caption: {
                type: 'text',
                analyzer: 'standard',
                fields: {
                    keyword: { type: 'keyword' },
                    autocomplete: {
                        type: 'text',
                        analyzer: 'autocomplete',
                        search_analyzer: 'standard'
                    },
                    suggest: { type: 'completion' }
                }
            },
            content: {
                type: 'text',
                analyzer: 'standard'
            },
            tags: { type: 'keyword' },
            hashtags: { type: 'keyword' },
            category: { type: 'keyword' },
            mediaType: { type: 'keyword' },
            visibility: { type: 'keyword' },
            tenantId: { type: 'keyword' },
            likes: { type: 'integer' },
            comments: { type: 'integer' },
            shares: { type: 'integer' },
            views: { type: 'integer' },
            engagementScore: { type: 'float' },
            popularityScore: { type: 'float' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
            isPublic: { type: 'boolean' },
            location: { type: 'geo_point' },
            // ML embedding for similarity search
            embedding: {
                type: 'dense_vector',
                dims: 128,
                index: true,
                similarity: 'cosine'
            }
        }
    },
    users: {
        properties: {
            username: {
                type: 'text',
                fields: {
                    keyword: { type: 'keyword' },
                    autocomplete: {
                        type: 'text',
                        analyzer: 'autocomplete',
                        search_analyzer: 'standard'
                    },
                    suggest: { type: 'completion' }
                }
            },
            displayName: {
                type: 'text',
                fields: {
                    autocomplete: {
                        type: 'text',
                        analyzer: 'autocomplete'
                    }
                }
            },
            firstName: { type: 'text' },
            lastName: { type: 'text' },
            bio: { type: 'text' },
            email: { type: 'keyword' },
            college: { type: 'keyword' },
            department: { type: 'keyword' },
            tenantId: { type: 'keyword' },
            interests: { type: 'keyword' },
            skills: { type: 'keyword' },
            followers: { type: 'integer' },
            following: { type: 'integer' },
            posts: { type: 'integer' },
            verified: { type: 'boolean' },
            createdAt: { type: 'date' },
            lastActive: { type: 'date' },
            // ML embedding for user similarity
            embedding: {
                type: 'dense_vector',
                dims: 128,
                index: true,
                similarity: 'cosine'
            }
        }
    },
    comments: {
        properties: {
            postId: { type: 'keyword' },
            userId: { type: 'keyword' },
            username: { type: 'keyword' },
            content: {
                type: 'text',
                analyzer: 'standard'
            },
            likes: { type: 'integer' },
            createdAt: { type: 'date' },
            tenantId: { type: 'keyword' }
        }
    },
    hashtags: {
        properties: {
            tag: {
                type: 'text',
                fields: {
                    keyword: { type: 'keyword' },
                    suggest: { type: 'completion' }
                }
            },
            count: { type: 'integer' },
            trendScore: { type: 'float' },
            category: { type: 'keyword' },
            tenantId: { type: 'keyword' },
            lastUsed: { type: 'date' }
        }
    },
    search_history: {
        properties: {
            userId: { type: 'keyword' },
            query: { type: 'text' },
            filters: { type: 'object' },
            resultCount: { type: 'integer' },
            clickedResults: { type: 'keyword' },
            timestamp: { type: 'date' },
            tenantId: { type: 'keyword' }
        }
    }
};

// Custom analyzers
const INDEX_SETTINGS = {
    analysis: {
        analyzer: {
            autocomplete: {
                tokenizer: 'autocomplete',
                filter: ['lowercase', 'asciifolding']
            },
            search_autocomplete: {
                tokenizer: 'standard',
                filter: ['lowercase', 'asciifolding']
            }
        },
        tokenizer: {
            autocomplete: {
                type: 'edge_ngram',
                min_gram: 1,
                max_gram: 20,
                token_chars: ['letter', 'digit']
            }
        }
    }
};

/**
 * Initialize Elasticsearch indices
 */
async function initializeIndices() {
    try {
        // Check connection
        await client.ping();
        console.log('[Elasticsearch] Connected successfully');

        // Create indices if they don't exist
        for (const [key, indexName] of Object.entries(INDICES)) {
            const exists = await client.indices.exists({ index: indexName });

            if (!exists) {
                const mappingKey = key.toLowerCase();
                const mapping = INDEX_MAPPINGS[mappingKey];

                if (mapping) {
                    await client.indices.create({
                        index: indexName,
                        body: {
                            settings: INDEX_SETTINGS,
                            mappings: { properties: mapping.properties }
                        }
                    });
                    console.log(`[Elasticsearch] Created index: ${indexName}`);
                }
            } else {
                console.log(`[Elasticsearch] Index exists: ${indexName}`);
            }
        }

        return true;
    } catch (error) {
        console.error('[Elasticsearch] Initialization error:', error.message);
        return false;
    }
}

/**
 * Health check
 */
async function healthCheck() {
    try {
        const health = await client.cluster.health();
        return {
            status: health.status,
            numberOfNodes: health.number_of_nodes,
            activeShards: health.active_shards
        };
    } catch (error) {
        console.error('[Elasticsearch] Health check failed:', error.message);
        return null;
    }
}

/**
 * Recreate index with new mappings
 */
async function recreateIndex(indexKey) {
    const indexName = INDICES[indexKey.toUpperCase()];
    const mappingKey = indexKey.toLowerCase();
    const mapping = INDEX_MAPPINGS[mappingKey];

    if (!indexName || !mapping) {
        throw new Error(`Invalid index key: ${indexKey}`);
    }

    try {
        const exists = await client.indices.exists({ index: indexName });
        if (exists) {
            await client.indices.delete({ index: indexName });
        }

        await client.indices.create({
            index: indexName,
            body: {
                settings: INDEX_SETTINGS,
                mappings: { properties: mapping.properties }
            }
        });

        console.log(`[Elasticsearch] Recreated index: ${indexName}`);
    } catch (error) {
        console.error(`[Elasticsearch] Error recreating index:`, error.message);
        throw error;
    }
}

/**
 * Get index stats
 */
async function getIndexStats() {
    try {
        const stats = {};

        for (const indexName of Object.values(INDICES)) {
            try {
                const indexStats = await client.indices.stats({ index: indexName });
                stats[indexName] = {
                    docs: indexStats._all.primaries.docs.count,
                    size: indexStats._all.primaries.store.size_in_bytes
                };
            } catch {
                stats[indexName] = { docs: 0, size: 0 };
            }
        }

        return stats;
    } catch (error) {
        console.error('[Elasticsearch] Stats error:', error.message);
        return null;
    }
}

module.exports = {
    client,
    INDICES,
    INDEX_MAPPINGS,
    INDEX_SETTINGS,
    initializeIndices,
    healthCheck,
    recreateIndex,
    getIndexStats
};
