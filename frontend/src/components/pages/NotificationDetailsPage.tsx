import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  CheckCircle,
  AlertTriangle,
  Info,
  XCircle,
  Calendar,
  Clock,
  User,
  Trash2,
  Check,
  AlertCircle
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { Notification } from '../../types';

const NotificationDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notifications, markAsRead, deleteNotification } = useNotifications();

  const [notification, setNotification] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && notifications.length > 0) {
      const foundNotification = notifications.find(n => n.notification_id === id);
      if (foundNotification) {
        setNotification(foundNotification);
        // Auto-mark as read when viewing details
        if (!foundNotification.read) {
          markAsRead(foundNotification.notification_id);
        }
      }
      setLoading(false);
    } else if (notifications.length === 0) {
      // If notifications haven't loaded yet, wait a bit
      setTimeout(() => setLoading(false), 1000);
    } else {
      setLoading(false);
    }
  }, [id, notifications, markAsRead]);

  const getIcon = (type: string, size: 'large' | 'small' = 'large') => {
    const iconSize = size === 'large' ? 'h-8 w-8' : 'h-5 w-5';
    switch (type) {
      case 'SUCCESS':
        return <CheckCircle className={`${iconSize} text-green-500`} />;
      case 'ERROR':
        return <XCircle className={`${iconSize} text-red-500`} />;
      case 'WARNING':
        return <AlertTriangle className={`${iconSize} text-yellow-500`} />;
      default:
        return <Info className={`${iconSize} text-blue-500`} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800';
      case 'NORMAL':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'SUCCESS':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'ERROR':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'WARNING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      full: date.toLocaleString()
    };
  };

  const handleDelete = async () => {
    if (notification && confirm('Are you sure you want to delete this notification?')) {
      await deleteNotification(notification.notification_id);
      navigate('/notifications');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading notification...</span>
      </div>
    );
  }

  if (!notification) {
    return (
      <div className="min-h-96 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Notification not found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The notification you're looking for doesn't exist or has been deleted.
          </p>
          <button
            onClick={() => navigate('/notifications')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Notifications
          </button>
        </div>
      </div>
    );
  }

  const createdAt = formatDateTime(notification.created_at);
  const readAt = notification.read_at ? formatDateTime(notification.read_at) : null;
  const expiresAt = notification.expires_at ? formatDateTime(notification.expires_at) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/notifications')}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Notifications
        </button>

        <div className="flex items-center space-x-2">
          {!notification.read && (
            <button
              onClick={() => markAsRead(notification.notification_id)}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              <Check className="h-4 w-4 mr-2" />
              Mark as Read
            </button>
          )}
          <button
            onClick={handleDelete}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </button>
        </div>
      </div>

      {/* Notification Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              {getIcon(notification.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-2">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {notification.title}
                </h1>
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(notification.priority)}`}>
                  {notification.priority}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(notification.type)}`}>
                  {notification.type}
                </span>
                {!notification.read && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    Unread
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4" />
                  <span>{createdAt.date}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>{createdAt.time}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <User className="h-4 w-4" />
                  <span>ID: {notification.notification_id}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <p className="text-gray-700 dark:text-gray-300 text-base leading-relaxed whitespace-pre-wrap">
              {notification.message}
            </p>
          </div>

          {/* Additional Data */}
          {notification.data && Object.keys(notification.data).length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Additional Information</h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(notification.data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Created:</span>
              <div className="text-gray-600 dark:text-gray-400 mt-1">
                {createdAt.full}
              </div>
            </div>

            {readAt && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Read:</span>
                <div className="text-gray-600 dark:text-gray-400 mt-1">
                  {readAt.full}
                </div>
              </div>
            )}

            {expiresAt && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Expires:</span>
                <div className="text-gray-600 dark:text-gray-400 mt-1">
                  {expiresAt.full}
                  {new Date(notification.expires_at!) < new Date() && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                      Expired
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Related Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/notifications')}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Bell className="h-4 w-4 mr-2" />
            View All Notifications
          </button>

          {!notification.read && (
            <button
              onClick={() => markAsRead(notification.notification_id)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              <Check className="h-4 w-4 mr-2" />
              Mark as Read
            </button>
          )}

          <button
            onClick={handleDelete}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Notification
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationDetailsPage;