import { useState, useEffect } from 'react';
import { Notification } from '../types';
import { apiClient } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: localStorage.getItem('items_per_page') ?? 10,
    total: 0,
    pages: 0
  });

  const fetchNotifications = async (page = 1, limit = 20) => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await apiClient.getNotifications({ page, limit });

      if (response.success && response.data) {
        const notificationData = response.data as any;
        const notificationsList = notificationData.notifications || [];
        const paginationData = notificationData.pagination || {};

        setNotifications(notificationsList);
        setPagination(paginationData);
        setUnreadCount(notificationsList.filter((n: Notification) => !n.read).length);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await apiClient.markNotificationAsRead(notificationId);
      if (response.success) {
        setNotifications(prev =>
          prev.map(n =>
            n.notification_id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await apiClient.markAllNotificationsAsRead();
      if (response.success) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, read: true, read_at: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await apiClient.deleteNotification(notificationId);
      if (response.success) {
        setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
        // Update unread count if the deleted notification was unread
        const deletedNotification = notifications.find(n => n.notification_id === notificationId);
        if (deletedNotification && !deletedNotification.read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const addNotification = (notification: Omit<Notification, 'notification_id' | 'created_at'>) => {
    const newNotification: Notification = {
      ...notification,
      notification_id: `not_${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    setNotifications(prev => [newNotification, ...prev]);
    if (!newNotification.read) {
      setUnreadCount(prev => prev + 1);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    pagination,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification,
    fetchNotifications,
  };
};