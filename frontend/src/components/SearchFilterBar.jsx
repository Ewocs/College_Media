import React from "react";
import { FaSearch, FaTimes } from "react-icons/fa";
import { useTranslation } from "react-i18next";

const SearchFilterBar = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  filterType,
  onFilterChange,
  onClearFilters
}) => {
  const { t } = useTranslation();
  const hasActiveFilters = searchQuery || sortBy !== "newest" || filterType !== "all";

  return (
    <div className="bg-bg-secondary rounded-lg shadow-md p-4 mb-6">
      {/* Search Input */}
      <div className="relative mb-4">
        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder={t('searchFilterBar.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent bg-bg-secondary text-text-primary"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Sort By */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-text-secondary">{t('searchFilterBar.sort')}:</label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="px-3 py-1.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm bg-bg-secondary text-text-primary"
          >
            <option value="newest">{t('searchFilterBar.newest')}</option>
            <option value="oldest">{t('searchFilterBar.oldest')}</option>
            <option value="mostLiked">{t('searchFilterBar.mostLiked')}</option>
            <option value="mostCommented">{t('searchFilterBar.mostCommented')}</option>
          </select>
        </div>

        {/* Filter Type */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-text-secondary">{t('searchFilterBar.filter')}:</label>
          <select
            value={filterType}
            onChange={(e) => onFilterChange(e.target.value)}
            className="px-3 py-1.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm bg-bg-secondary text-text-primary"
          >
            <option value="all">{t('searchFilterBar.allPosts')}</option>
            <option value="liked">{t('searchFilterBar.likedPosts')}</option>
            <option value="recent">{t('searchFilterBar.recentPosts')}</option>
          </select>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm text-brand-primary hover:bg-bg-tertiary rounded-lg transition-colors border border-transparent hover:border-border"
          >
            <FaTimes />
            {t('searchFilterBar.clearFilters')}
          </button>
        )}
      </div>

      {/* Active Search/Filter Info */}
      {searchQuery && (
        <div className="mt-3 text-sm text-text-secondary">
          {t('searchFilterBar.searchingFor')}: <span className="font-semibold">"{searchQuery}"</span>
        </div>
      )}
    </div>
  );
};

export default SearchFilterBar;

