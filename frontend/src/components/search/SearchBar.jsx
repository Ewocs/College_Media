/**
 * SearchBar Component
 * Issue #934: Advanced Elasticsearch-Powered Search with Personalized Recommendations
 * 
 * Advanced search bar with autocomplete, facets, and filters.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useSearch } from '../../context/SearchContext';

const SearchBar = ({ onSearch, className = '' }) => {
    const {
        query,
        setQuery,
        suggestions,
        getAutocomplete,
        search,
        filters,
        setFilters,
        facets,
        loading,
        searchHistory,
        clearSearch
    } = useSearch();

    const [showDropdown, setShowDropdown] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [inputValue, setInputValue] = useState(query);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    // Handle input change
    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputValue(value);
        setQuery(value);
        getAutocomplete(value);
        setShowDropdown(true);
    };

    // Handle search submit
    const handleSubmit = (e) => {
        e.preventDefault();
        setShowDropdown(false);
        search(inputValue);
        if (onSearch) onSearch(inputValue);
    };

    // Handle suggestion click
    const handleSuggestionClick = (suggestion) => {
        const text = suggestion.text;
        setInputValue(text);
        setQuery(text);
        setShowDropdown(false);
        search(text);
        if (onSearch) onSearch(text);
    };

    // Handle filter change
    const handleFilterChange = (filterType, value) => {
        setFilters({ [filterType]: value });
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter options
    const typeOptions = [
        { value: 'all', label: 'All', icon: 'mdi:magnify' },
        { value: 'posts', label: 'Posts', icon: 'mdi:post' },
        { value: 'users', label: 'Users', icon: 'mdi:account' },
        { value: 'hashtags', label: 'Hashtags', icon: 'mdi:pound' }
    ];

    const sortOptions = [
        { value: 'relevance', label: 'Relevance' },
        { value: 'date', label: 'Most Recent' },
        { value: 'popular', label: 'Most Popular' },
        { value: 'engagement', label: 'Most Engaging' }
    ];

    return (
        <div className={`search-bar-container relative ${className}`} ref={dropdownRef}>
            {/* Main Search Bar */}
            <form onSubmit={handleSubmit} className="relative">
                <div className="flex items-center bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {/* Type Selector */}
                    <select
                        value={filters.type}
                        onChange={(e) => handleFilterChange('type', e.target.value)}
                        className="h-12 px-3 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 focus:outline-none"
                    >
                        {typeOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>

                    {/* Search Input */}
                    <div className="flex-1 relative">
                        <Icon
                            icon="mdi:magnify"
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                        />
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={handleInputChange}
                            onFocus={() => setShowDropdown(true)}
                            placeholder="Search posts, users, hashtags..."
                            className="w-full h-12 pl-10 pr-4 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
                        />
                        {inputValue && (
                            <button
                                type="button"
                                onClick={() => {
                                    setInputValue('');
                                    setQuery('');
                                    clearSearch();
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                            >
                                <Icon icon="mdi:close" className="w-4 h-4 text-gray-400" />
                            </button>
                        )}
                    </div>

                    {/* Filter Toggle */}
                    <button
                        type="button"
                        onClick={() => setShowFilters(!showFilters)}
                        className={`h-12 px-3 border-l border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${showFilters ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-500'}`}
                    >
                        <Icon icon="mdi:filter-variant" className="w-5 h-5" />
                    </button>

                    {/* Search Button */}
                    <button
                        type="submit"
                        className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                    >
                        {loading ? (
                            <Icon icon="mdi:loading" className="w-5 h-5 animate-spin" />
                        ) : (
                            'Search'
                        )}
                    </button>
                </div>
            </form>

            {/* Autocomplete Dropdown */}
            {showDropdown && (suggestions.length > 0 || searchHistory.length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                    {/* Suggestions */}
                    {suggestions.length > 0 && (
                        <div className="p-2">
                            <p className="px-3 py-1 text-xs font-medium text-gray-500 uppercase">Suggestions</p>
                            {suggestions.map((suggestion, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-left"
                                >
                                    <Icon
                                        icon={
                                            suggestion.type === 'user' ? 'mdi:account' :
                                                suggestion.type === 'hashtag' ? 'mdi:pound' :
                                                    'mdi:post'
                                        }
                                        className="w-5 h-5 text-gray-400"
                                    />
                                    <span className="flex-1 text-gray-900 dark:text-white truncate">
                                        {suggestion.text}
                                    </span>
                                    {suggestion.verified && (
                                        <Icon icon="mdi:check-decagram" className="w-4 h-4 text-blue-500" />
                                    )}
                                    {suggestion.count && (
                                        <span className="text-xs text-gray-500">{suggestion.count} posts</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Search History */}
                    {searchHistory.length > 0 && suggestions.length === 0 && (
                        <div className="p-2">
                            <p className="px-3 py-1 text-xs font-medium text-gray-500 uppercase">Recent Searches</p>
                            {searchHistory.slice(0, 5).map((historyItem, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSuggestionClick({ text: historyItem })}
                                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-left"
                                >
                                    <Icon icon="mdi:history" className="w-5 h-5 text-gray-400" />
                                    <span className="text-gray-900 dark:text-white">{historyItem}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Advanced Filters */}
            {showFilters && (
                <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Sort */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Sort By
                            </label>
                            <select
                                value={filters.sort}
                                onChange={(e) => handleFilterChange('sort', e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                            >
                                {sortOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Category */}
                        {facets.categories?.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Category
                                </label>
                                <select
                                    value={filters.category || ''}
                                    onChange={(e) => handleFilterChange('category', e.target.value || null)}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                                >
                                    <option value="">All Categories</option>
                                    {facets.categories.map(cat => (
                                        <option key={cat.value} value={cat.value}>
                                            {cat.value} ({cat.count})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Date From */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                From Date
                            </label>
                            <input
                                type="date"
                                value={filters.dateFrom || ''}
                                onChange={(e) => handleFilterChange('dateFrom', e.target.value || null)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                            />
                        </div>

                        {/* Date To */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                To Date
                            </label>
                            <input
                                type="date"
                                value={filters.dateTo || ''}
                                onChange={(e) => handleFilterChange('dateTo', e.target.value || null)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                            />
                        </div>
                    </div>

                    {/* Hashtag Filters */}
                    {filters.hashtags.length > 0 && (
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Active Hashtag Filters
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {filters.hashtags.map(tag => (
                                    <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                                    >
                                        {tag}
                                        <button
                                            onClick={() => setFilters({ hashtags: filters.hashtags.filter(h => h !== tag) })}
                                            className="hover:text-blue-900 dark:hover:text-blue-100"
                                        >
                                            <Icon icon="mdi:close" className="w-4 h-4" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchBar;
