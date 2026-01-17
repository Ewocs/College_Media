import { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../context/NotificationContext';
import NotificationDropdown from './NotificationDropdown';

const NotificationBell = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef(null);
  const { unreadCount, notifications } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Pulse animation when there are unread notifications
  const bellClassName = unreadCount > 0
    ? 'animate-pulse'
    : '';

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 hover:bg-bg-tertiary rounded-full transition-colors ${bellClassName}`}
        aria-label={t('notifications.unreadAria', { count: unreadCount })}
        aria-expanded={isOpen}
      >
        <Icon
          icon="mdi:bell"
          width={24}
          className="text-text-secondary"
        />

        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 bg-status-error text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center shadow-lg"
            aria-label={t('notifications.unreadAria', { count: unreadCount })}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationDropdown
          notifications={notifications.slice(0, 10)}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default NotificationBell;

