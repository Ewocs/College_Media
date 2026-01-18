/**
 * SearchContext
 * Issue #934: Advanced Elasticsearch-Powered Search with Personalized Recommendations
 * 
 * React context for managing search state and filters.
 */

import React, { createContext, useContext, useState, useCallback, useReducer } from 'react';
import { searchApi } from '../api/endpoints';
import { debounce } from 'lodash';

const SearchContext = createContext(null);

// Action types
const ACTIONS = {
    SET_QUERY: 'SET_QUERY',
    SET_RESULTS: 'SET_RESULTS',
    SET_LOADING: 'SET_LOADING',
    SET_ERROR: 'SET_ERROR',
    SET_FILTERS: 'SET_FILTERS',
    SET_FACETS: 'SET_FACETS',
    SET_SUGGESTIONS: 'SET_SUGGESTIONS',
    CLEAR_SEARCH: 'CLEAR_SEARCH',
    SET_PAGE: 'SET_PAGE'
};

// Initial state
const initialState = {
    query: '',
    results: [],
    total: 0,
    loading: false,
    error: null,
    filters: {
        type: 'all',
        category: null,
        mediaType: null,
        dateFrom: null,
        dateTo: null,
        hashtags: [],
        sort: 'relevance'
    },
    facets: {
        categories: [],
        mediaTypes: [],
        hashtags: [],
        colleges: [],
        departments: []
    },
    suggestions: [],
    page: 1,
    limit: 20,
    totalPages: 0
};

// Reducer
function searchReducer(state, action) {
    switch (action.type) {
        case ACTIONS.SET_QUERY:
            return { ...state, query: action.payload, page: 1 };

        case ACTIONS.SET_RESULTS:
            return {
                ...state,
                results: action.payload.results,
                total: action.payload.total,
                totalPages: action.payload.totalPages,
                loading: false,
                error: null
            };

        case ACTIONS.SET_LOADING:
            return { ...state, loading: action.payload };

        case ACTIONS.SET_ERROR:
            return { ...state, error: action.payload, loading: false };

        case ACTIONS.SET_FILTERS:
            return { ...state, filters: { ...state.filters, ...action.payload }, page: 1 };

        case ACTIONS.SET_FACETS:
            return { ...state, facets: action.payload };

        case ACTIONS.SET_SUGGESTIONS:
            return { ...state, suggestions: action.payload };

        case ACTIONS.SET_PAGE:
            return { ...state, page: action.payload };

        case ACTIONS.CLEAR_SEARCH:
            return { ...initialState };

        default:
            return state;
    }
}

export const SearchProvider = ({ children }) => {
    const [state, dispatch] = useReducer(searchReducer, initialState);
    const [searchHistory, setSearchHistory] = useState([]);

    /**
     * Perform search
     */
    const search = useCallback(async (query = state.query, options = {}) => {
        dispatch({ type: ACTIONS.SET_LOADING, payload: true });

        try {
            const response = await searchApi.search({
                query,
                type: state.filters.type,
                filters: {
                    category: state.filters.category,
                    mediaType: state.filters.mediaType,
                    dateFrom: state.filters.dateFrom,
                    dateTo: state.filters.dateTo,
                    hashtags: state.filters.hashtags
                },
                sort: state.filters.sort,
                page: options.page || state.page,
                limit: state.limit
            });

            dispatch({
                type: ACTIONS.SET_RESULTS,
                payload: {
                    results: response.data.data.results,
                    total: response.data.data.total,
                    totalPages: response.data.data.totalPages
                }
            });

            // Update facets
            if (response.data.data.facets) {
                dispatch({ type: ACTIONS.SET_FACETS, payload: response.data.data.facets });
            }

            // Update search history
            if (query && !searchHistory.includes(query)) {
                setSearchHistory(prev => [query, ...prev.slice(0, 9)]);
            }

        } catch (error) {
            console.error('Search error:', error);
            dispatch({ type: ACTIONS.SET_ERROR, payload: 'Search failed' });
        }
    }, [state.query, state.filters, state.page, state.limit, searchHistory]);

    /**
     * Get autocomplete suggestions
     */
    const getAutocompleteFn = useCallback(async (prefix) => {
        if (!prefix || prefix.length < 1) {
            dispatch({ type: ACTIONS.SET_SUGGESTIONS, payload: [] });
            return;
        }

        try {
            const response = await searchApi.autocomplete({
                q: prefix,
                type: state.filters.type,
                limit: 10
            });

            dispatch({
                type: ACTIONS.SET_SUGGESTIONS,
                payload: response.data.data.suggestions
            });
        } catch (error) {
            console.error('Autocomplete error:', error);
        }
    }, [state.filters.type]);

    // Debounced autocomplete
    const getAutocomplete = useCallback(
        debounce(getAutocompleteFn, 200),
        [getAutocompleteFn]
    );

    /**
     * Set search query
     */
    const setQuery = useCallback((query) => {
        dispatch({ type: ACTIONS.SET_QUERY, payload: query });
    }, []);

    /**
     * Set filters
     */
    const setFilters = useCallback((filters) => {
        dispatch({ type: ACTIONS.SET_FILTERS, payload: filters });
    }, []);

    /**
     * Set page
     */
    const setPage = useCallback((page) => {
        dispatch({ type: ACTIONS.SET_PAGE, payload: page });
    }, []);

    /**
     * Clear search
     */
    const clearSearch = useCallback(() => {
        dispatch({ type: ACTIONS.CLEAR_SEARCH });
    }, []);

    /**
     * Toggle filter
     */
    const toggleFilter = useCallback((filterType, value) => {
        setFilters({
            [filterType]: state.filters[filterType] === value ? null : value
        });
    }, [setFilters, state.filters]);

    /**
     * Add hashtag filter
     */
    const addHashtagFilter = useCallback((hashtag) => {
        if (!state.filters.hashtags.includes(hashtag)) {
            setFilters({
                hashtags: [...state.filters.hashtags, hashtag]
            });
        }
    }, [setFilters, state.filters.hashtags]);

    /**
     * Remove hashtag filter
     */
    const removeHashtagFilter = useCallback((hashtag) => {
        setFilters({
            hashtags: state.filters.hashtags.filter(h => h !== hashtag)
        });
    }, [setFilters, state.filters.hashtags]);

    const value = {
        // State
        ...state,
        searchHistory,

        // Actions
        search,
        getAutocomplete,
        setQuery,
        setFilters,
        setPage,
        clearSearch,
        toggleFilter,
        addHashtagFilter,
        removeHashtagFilter
    };

    return (
        <SearchContext.Provider value={value}>
            {children}
        </SearchContext.Provider>
    );
};

export const useSearch = () => {
    const context = useContext(SearchContext);

    if (!context) {
        throw new Error('useSearch must be used within a SearchProvider');
    }

    return context;
};

export default SearchContext;
