const express = require('express');
const router = express.Router();
const PushService = require('../services/pushService');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'college_media_secret_key';

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Mock notifications data
const mockNotifications = [];

/**
 * POST /api/notifications/subscribe
 * Subscribe to push notifications
 */
router.post('/subscribe', verifyToken, async (req, res) => {
  try {
    const subscription = req.body;
    const userAgent = req.headers['user-agent'];

    await PushService.subscribe(req.userId, subscription, userAgent);

    res.status(201).json({
      success: true,
      message: 'Push subscription saved'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to subscribe' });
  }
});

/**
 * GET /api/notifications
 * Fetch user notifications
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // Return empty array for now
    res.json({
      success: true,
      data: mockNotifications.slice(0, parseInt(limit)),
      unreadCount: 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
router.patch('/:id/read', verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all notifications as read
 */
router.patch('/mark-all-read', verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
});

module.exports = router;
