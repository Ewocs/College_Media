import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../context/NotificationContext';
import NotificationItem from './NotificationItem';

const NotificationDropdown = ({ notifications, onClose }) => {
  const { t } = useTranslation();
  const { unreadCount, markAllAsRead } = useNotifications();

  const handleMarkAllAsRead = async (e) => {
    e.preventDefault();
    await markAllAsRead();
  };

  return (
    <div className="absolute right-0 mt-2 w-96 bg-bg-secondary rounded-lg shadow-2xl border border-border overflow-hidden z-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-bg-primary">
        <h3 className="font-semibold text-text-primary">
          {t('notifications.title')}
          {unreadCount > 0 && (
            <span className="ml-2 text-sm text-text-muted">
              {t('notifications.newCount', { count: unreadCount })}
            </span>
          )}
        </h3>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-sm text-brand-primary hover:underline"
          >
            {t('notifications.markAllRead')}
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="max-h-[400px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Icon
              icon="mdi:bell-outline"
              width={48}
              className="text-text-muted mb-3"
            />
            <p className="text-text-muted text-center font-medium">
              {t('notifications.noNotifications')}
            </p>
            <p className="text-sm text-text-muted text-center mt-1">
              {t('notifications.allCaughtUp')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={onClose}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-3 border-t border-border bg-bg-primary">
          <Link
            to="/notifications"
            onClick={onClose}
            className="text-sm text-brand-primary hover:underline font-medium flex items-center justify-center gap-1"
          >
            {t('notifications.viewAll')}
            <Icon icon="mdi:arrow-right" width={16} />
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;

