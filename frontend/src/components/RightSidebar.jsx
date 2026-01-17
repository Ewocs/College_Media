import React from "react";
import SuggestedAccountItem from "./SuggestedAccountItem";
import TrendingHashtag from "./TrendingHashtag";
import { useTranslation } from "react-i18next";

/**
 * Right Sidebar Component
 * Sidebar containing friend suggestions, trending hashtags, and online friends.
 * @returns {JSX.Element} The right sidebar JSX element
 */
function RightSidebar() {
  const { t } = useTranslation();
  const friendSuggestions = [
    {
      name: "Julia Smith",
      avatar: "https://placehold.co/40x40/6366F1/FFFFFF?text=JS",
      followers: "2.1K",
    },
    {
      name: "Vermillion D. Gray",
      avatar: "https://placehold.co/40x40/3B82F6/FFFFFF?text=VG",
      followers: "1.8K",
    },
    {
      name: "Mai Senpai",
      avatar: "https://placehold.co/40x40/8B5CF6/FFFFFF?text=MS",
      followers: "3.4K",
    },
    {
      name: "Azunyan U. Wu",
      avatar: "https://placehold.co/40x40/EC4899/FFFFFF?text=AW",
      followers: "956",
    },
  ];

  const trendingHashtags = [
    "#photography",
    "#campuslife",
    "#studygroup",
    "#collegesports",
    "#hackathon2024",
  ];

  const onlineFriends = [
    {
      name: "friend_one",
      avatar: "https://placehold.co/48x48/10B981/FFFFFF?text=F1",
    },
    {
      name: "friend_two",
      avatar: "https://placehold.co/48x48/A78BFA/FFFFFF?text=F2",
    },
    {
      name: "friend_three",
      avatar: "https://placehold.co/48x48/F472B6/FFFFFF?text=F3",
    },
  ];

  return (
    <div className="lg:col-span-1 space-y-6">
      {/* Friend Suggestions */}
      <div className="bg-bg-secondary rounded-2xl shadow-sm border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-text-primary text-lg">
            {t('rightSidebar.friendSuggestions')}
          </h3>
          <button className="text-brand-primary text-sm font-medium hover:underline flex items-center">
            {t('rightSidebar.seeAll')}
            <svg
              className="w-4 h-4 ml-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
        <div className="space-y-4">
          {friendSuggestions.map((friend, index) => (
            <SuggestedAccountItem
              key={index}
              account={friend}
              onFollow={() => { }}
            />
          ))}
        </div>
      </div>

      {/* Trending Now */}
      <div className="bg-bg-secondary rounded-2xl shadow-sm border border-border p-5">
        <div className="flex items-center mb-4">
          <svg
            className="w-5 h-5 text-orange-500 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
          <h3 className="font-bold text-text-primary text-lg">
            {t('rightSidebar.trendingNow')}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {trendingHashtags.map((hashtag, index) => (
            <TrendingHashtag
              key={index}
              hashtag={hashtag}
              onClick={() => { }}
            />
          ))}
        </div>
      </div>

      {/* Profile Activity */}
      <div className="bg-gradient-to-br from-brand-primary to-purple-600 rounded-2xl shadow-sm border border-brand-primary p-5 text-white">
        <h3 className="font-bold text-lg mb-3">{t('rightSidebar.profileActivity')}</h3>
        <div className="bg-bg-secondary/10 backdrop-blur-sm rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <img
                src="https://placehold.co/32x32/6366F1/FFFFFF?text=U1"
                alt="User"
                className="w-8 h-8 rounded-full"
              />
              <img
                src="https://placehold.co/32x32/3B82F6/FFFFFF?text=U2"
                alt="User"
                className="w-8 h-8 rounded-full -ml-3 border border-white/20"
              />
              <img
                src="https://placehold.co/32x32/8B5CF6/FFFFFF?text=U3"
                alt="User"
                className="w-8 h-8 rounded-full -ml-3 border border-white/20"
              />
              <img
                src="https://placehold.co/32x32/EC4899/FFFFFF?text=U4"
                alt="User"
                className="w-8 h-8 rounded-full -ml-3 border border-white/20"
              />
            </div>
          </div>
          <div className="text-3xl font-bold mb-1">+1,158</div>
          <div className="text-sm opacity-90 mb-2">{t('rightSidebar.newFollowers')}</div>
          <div className="text-xs opacity-75 flex items-center">
            <svg
              className="w-3 h-3 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
            23% {t('rightSidebar.vsLastMonth')}
          </div>
        </div>
        <p className="text-sm opacity-90">
          {t('rightSidebar.gainedFollowers')}
        </p>
      </div>

      {/* Online Friends */}
      <div className="bg-bg-secondary rounded-2xl shadow-sm border border-border p-5">
        <h3 className="font-bold text-text-primary text-lg mb-4">
          {t('rightSidebar.onlineFriends')}
        </h3>
        <div className="flex items-center space-x-3">
          {onlineFriends.map((friend, index) => (
            <div
              key={index}
              className="relative cursor-pointer hover:scale-105 transition-transform duration-300"
            >
              <img
                src={friend.avatar}
                alt={friend.name}
                className="w-12 h-12 rounded-full border-2 border-white dark:border-slate-700 shadow-md"
              />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-700"></div>
            </div>
          ))}
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-bg-tertiary text-text-primary font-semibold text-sm cursor-pointer hover:bg-bg-tertiary/80 transition-colors duration-300">
            +12
          </div>
        </div>
      </div>
    </div>
  );
}

export default RightSidebar;

