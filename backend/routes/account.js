const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserMongo = require('../models/User');
const UserMock = require('../mockdb/userDB');
const MessageMongo = require('../models/Message');
const MessageMock = require('../mockdb/messageDB');
const { validateAccountDeletion, checkValidation } = require('../middleware/validationMiddleware');
const { sendAccountDeactivationEmail } = require('../services/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'college_media_secret_key';

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      data: null,
      message: 'Access denied. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      data: null,
      message: 'Invalid token.'
    });
  }
};

/**
 * @route   DELETE /api/account
 * @desc    Delete user account (soft delete)
 * @access  Private
 */
router.delete('/', verifyToken, validateAccountDeletion, checkValidation, async (req, res) => {
  try {
    const { password, reason } = req.body;
    console.log('Delete account request received:', { 
      userId: req.userId, 
      hasPassword: !!password, 
      passwordLength: password?.length 
    });
    const dbConnection = req.app.get('dbConnection');
    const useMongoDB = dbConnection?.useMongoDB;

    // Get user
    let user;
    if (useMongoDB) {
      user = await UserMongo.findById(req.userId);
    } else {
      user = await UserMock.findById(req.userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    // Check if already deleted - return idempotent response
    if (user.isDeleted) {
      return res.status(200).json({
        success: true,
        data: {
          isDeleted: true,
          deletedAt: user.deletedAt,
          scheduledDeletionDate: user.scheduledDeletionDate,
          message: 'Account is already scheduled for deletion'
        },
        message: 'Account deletion already scheduled'
      });
    }

    // Verify password
    console.log('Verifying password for user:', user.email);
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('Password verification result:', isPasswordValid);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        data: null,
        message: 'Incorrect password'
      });
    }

    // Soft delete user account
    if (useMongoDB) {
      await user.softDelete(reason);
    } else {
      await UserMock.softDelete(req.userId, reason);
    }

    // Anonymize or delete user's messages
    if (useMongoDB) {
      // Delete all messages where user is sender or receiver
      await MessageMongo.updateMany(
        { $or: [{ sender: req.userId }, { receiver: req.userId }] },
        { $push: { deletedBy: req.userId } }
      );
    } else {
      // Handle mock database message cleanup
      const messages = await MessageMock.find({});
      for (const msg of messages) {
        if (msg.sender === req.userId || msg.receiver === req.userId) {
          if (!msg.deletedBy.includes(req.userId)) {
            await MessageMock.updateOne(
              { _id: msg._id },
              { $push: { deletedBy: req.userId } }
            );
          }
        }
      }
    }

    // Log deletion for audit
    console.log(`User account deleted: ${req.userId} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      data: {
        scheduledDeletionDate: user.scheduledDeletionDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        message: 'Your account has been scheduled for deletion. You have 30 days to restore it.'
      },
      message: 'Account deletion initiated successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Error deleting account'
    });
  }
});

/**
 * @route   POST /api/account/restore
 * @desc    Restore a deleted account
 * @access  Private
 */
router.post('/restore', verifyToken, async (req, res) => {
  try {
    const dbConnection = req.app.get('dbConnection');
    const useMongoDB = dbConnection?.useMongoDB;

    // Get user
    let user;
    if (useMongoDB) {
      user = await UserMongo.findById(req.userId);
    } else {
      user = await UserMock.findById(req.userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    // Check if account is deleted
    if (!user.isDeleted) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Account is not deleted'
      });
    }

    // Check if permanent deletion deadline has passed
    if (user.scheduledDeletionDate && new Date() > user.scheduledDeletionDate) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Account deletion deadline has passed. Cannot restore.'
      });
    }

    // Restore account
    if (useMongoDB) {
      await user.restore();
    } else {
      await UserMock.restore(req.userId);
    }

    // Log restoration for audit
    console.log(`User account restored: ${req.userId} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      data: null,
      message: 'Account restored successfully'
    });
  } catch (error) {
    console.error('Restore account error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Error restoring account'
    });
  }
});

/**
 * @route   DELETE /api/account/permanent
 * @desc    Permanently delete user account (admin only or after grace period)
 * @access  Private/Admin
 */
router.delete('/permanent', verifyToken, async (req, res) => {
  try {
    const dbConnection = req.app.get('dbConnection');
    const useMongoDB = dbConnection?.useMongoDB;

    // Get user
    let user;
    if (useMongoDB) {
      user = await UserMongo.findById(req.userId);
    } else {
      user = await UserMock.findById(req.userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    // Check if account is soft-deleted
    if (!user.isDeleted) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Account must be soft-deleted first'
      });
    }

    // Permanently delete user's messages
    if (useMongoDB) {
      await MessageMongo.deleteMany({
        $or: [{ sender: req.userId }, { receiver: req.userId }]
      });
    } else {
      const messages = await MessageMock.find({});
      for (const msg of messages) {
        if (msg.sender === req.userId || msg.receiver === req.userId) {
          await MessageMock.deleteOne({ _id: msg._id });
        }
      }
    }

    // TODO: Delete user's posts, comments, likes, etc.

    // Remove user from followers/following lists
    if (useMongoDB) {
      await UserMongo.updateMany(
        { followers: req.userId },
        { $pull: { followers: req.userId } }
      );
      await UserMongo.updateMany(
        { following: req.userId },
        { $pull: { following: req.userId } }
      );
    }

    // Permanently delete user account
    if (useMongoDB) {
      await UserMongo.findByIdAndDelete(req.userId);
    } else {
      await UserMock.permanentDelete(req.userId);
    }

    // Log permanent deletion for audit
    console.log(`User account permanently deleted: ${req.userId} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      data: null,
      message: 'Account permanently deleted'
    });
  } catch (error) {
    console.error('Permanent delete error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Error permanently deleting account'
    });
  }
});

/**
 * @route   GET /api/account/deletion-status
 * @desc    Get account deletion status
 * @access  Private
 */
router.get('/deletion-status', verifyToken, async (req, res) => {
  try {
    const dbConnection = req.app.get('dbConnection');
    const useMongoDB = dbConnection?.useMongoDB;

    // Get user
    let user;
    if (useMongoDB) {
      user = await UserMongo.findById(req.userId).select('isDeleted deletedAt scheduledDeletionDate deletionReason');
    } else {
      user = await UserMock.findById(req.userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    const status = {
      isDeleted: user.isDeleted || false,
      deletedAt: user.deletedAt || null,
      scheduledDeletionDate: user.scheduledDeletionDate || null,
      deletionReason: user.deletionReason || null,
      canRestore: user.isDeleted && user.scheduledDeletionDate && new Date() < new Date(user.scheduledDeletionDate),
      daysUntilPermanentDeletion: user.scheduledDeletionDate 
        ? Math.ceil((new Date(user.scheduledDeletionDate) - new Date()) / (1000 * 60 * 60 * 24))
        : null
    };

    res.json({
      success: true,
      data: status,
      message: 'Deletion status retrieved successfully'
    });
  } catch (error) {
    console.error('Get deletion status error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Error retrieving deletion status'
    });
  }
});

/**
 * @route   POST /api/account/deactivate
 * @desc    Deactivate user account temporarily
 * @access  Private
 */
router.post('/deactivate', verifyToken, async (req, res) => {
  try {
    const { password, reason } = req.body;
    const dbConnection = req.app.get('dbConnection');
    const useMongoDB = dbConnection?.useMongoDB;

    // Validate password is provided
    if (!password) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Password is required to deactivate account'
      });
    }

    // Get user
    let user;
    if (useMongoDB) {
      user = await UserMongo.findById(req.userId);
    } else {
      user = await UserMock.findById(req.userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    // Check if already deactivated
    if (!user.isActive && !user.isDeleted) {
      return res.status(200).json({
        success: true,
        data: {
          isActive: false,
          message: 'Account is already deactivated'
        },
        message: 'Account already deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        data: null,
        message: 'Incorrect password'
      });
    }

    // Deactivate account
    if (useMongoDB) {
      await user.deactivate(reason);
    } else {
      await UserMock.deactivate(req.userId, reason);
    }

    // Send deactivation confirmation email
    try {
      await sendAccountDeactivationEmail(user.email, user.username);
      console.log(`Deactivation email sent to: ${user.email}`);
    } catch (emailError) {
      // Log error but don't fail the deactivation
      console.error('Failed to send deactivation email:', emailError);
      // Continue with deactivation even if email fails
    }

    // Log deactivation
    console.log(`User account deactivated: ${req.userId} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      data: {
        isActive: false,
        message: 'Your account has been deactivated. You can reactivate it anytime by logging in.'
      },
      message: 'Account deactivated successfully. A confirmation email has been sent.'
    });
  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Error deactivating account'
    });
  }
});

/**
 * @route   POST /api/account/reactivate
 * @desc    Reactivate a deactivated account
 * @access  Private
 */
router.post('/reactivate', verifyToken, async (req, res) => {
  try {
    const dbConnection = req.app.get('dbConnection');
    const useMongoDB = dbConnection?.useMongoDB;

    // Get user
    let user;
    if (useMongoDB) {
      user = await UserMongo.findById(req.userId);
    } else {
      user = await UserMock.findById(req.userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    // Check if account is active
    if (user.isActive) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Account is already active'
      });
    }

    // Check if account is deleted (can't reactivate deleted accounts)
    if (user.isDeleted) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Cannot reactivate a deleted account. Please use restore instead.'
      });
    }

    // Reactivate account
    if (useMongoDB) {
      await user.reactivate();
    } else {
      await UserMock.reactivate(req.userId);
    }

    // Log reactivation
    console.log(`User account reactivated: ${req.userId} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      data: null,
      message: 'Account reactivated successfully'
    });
  } catch (error) {
    console.error('Reactivate account error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Error reactivating account'
    });
  }
});

/**
 * @route   GET /api/account/settings
 * @desc    Get user settings (font size, theme, etc.)
 * @access  Private
 */
router.get('/settings', verifyToken, async (req, res) => {
  try {
    const dbConnection = req.app.get('dbConnection');
    const useMongoDB = dbConnection?.useMongoDB;

    // Get user
    let user;
    if (useMongoDB) {
      user = await UserMongo.findById(req.userId).select('settings');
    } else {
      user = await UserMock.findById(req.userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    const settings = user.settings || {
      fontSize: 'medium',
      theme: 'auto'
    };

    res.json({
      success: true,
      data: settings,
      message: 'Settings retrieved successfully'
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Error retrieving settings'
    });
  }
});

/**
 * @route   PUT /api/account/settings
 * @desc    Update user settings (font size, theme, etc.)
 * @access  Private
 */
router.put('/settings', verifyToken, async (req, res) => {
  try {
    const { fontSize, theme } = req.body;
    const dbConnection = req.app.get('dbConnection');
    const useMongoDB = dbConnection?.useMongoDB;

    // Validate fontSize if provided
    if (fontSize && !['small', 'medium', 'large'].includes(fontSize)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Invalid font size. Must be small, medium, or large.'
      });
    }

    // Validate theme if provided
    if (theme && !['light', 'dark', 'auto'].includes(theme)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Invalid theme. Must be light, dark, or auto.'
      });
    }

    // Get user
    let user;
    if (useMongoDB) {
      user = await UserMongo.findById(req.userId);
    } else {
      user = await UserMock.findById(req.userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    // Initialize settings object if it doesn't exist
    if (!user.settings) {
      user.settings = {
        fontSize: 'medium',
        theme: 'auto'
      };
    }

    // Update settings
    if (fontSize) {
      user.settings.fontSize = fontSize;
    }
    if (theme) {
      user.settings.theme = theme;
    }

    // Save user
    if (useMongoDB) {
      await user.save();
    } else {
      await UserMock.updateOne({ _id: req.userId }, { settings: user.settings });
    }

    res.json({
      success: true,
      data: user.settings,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Error updating settings'
    });
  }
});

/**
 * @route   GET /api/account/profile
 * @desc    Get user's profile information
 * @access  Private
 */
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const dbConnection = req.app.get('dbConnection');
    const useMongoDB = dbConnection?.useMongoDB;

    let user;
    if (useMongoDB) {
      user = await UserMongo.findById(req.userId).select('-password -twoFactorSecret');
    } else {
      user = await UserMock.findById(req.userId);
      if (user) {
        delete user.password;
        delete user.twoFactorSecret;
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user,
      message: 'Profile retrieved successfully'
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Error retrieving profile'
    });
  }
});

/**
 * @route   PUT /api/account/profile
 * @desc    Update user's profile information
 * @access  Private
 */
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { firstName, lastName, bio, username, email, profilePicture, profileBanner } = req.body;
    
    const dbConnection = req.app.get('dbConnection');
    const useMongoDB = dbConnection?.useMongoDB;

    // Get current user
    let user;
    if (useMongoDB) {
      user = await UserMongo.findById(req.userId);
    } else {
      user = await UserMock.findById(req.userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== user.username) {
      let existingUser;
      if (useMongoDB) {
        existingUser = await UserMongo.findOne({ username });
      } else {
        existingUser = await UserMock.findByUsername(username);
      }

      if (existingUser && existingUser._id.toString() !== req.userId) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Username is already taken'
        });
      }

      // Validate username
      if (username.length < 3 || username.length > 30) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Username must be between 3 and 30 characters'
        });
      }
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      let existingUser;
      if (useMongoDB) {
        existingUser = await UserMongo.findOne({ email: email.toLowerCase() });
      } else {
        existingUser = await UserMock.findByEmail(email.toLowerCase());
      }

      if (existingUser && existingUser._id.toString() !== req.userId) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Email is already registered'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Invalid email format'
        });
      }
    }

    // Validate bio length
    if (bio && bio.length > 500) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Bio must be 500 characters or less'
      });
    }

    // Update fields
    if (firstName !== undefined) user.firstName = firstName.trim();
    if (lastName !== undefined) user.lastName = lastName.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (username !== undefined) user.username = username.trim();
    if (email !== undefined) user.email = email.toLowerCase().trim();
    if (profilePicture !== undefined) user.profilePicture = profilePicture;
    if (profileBanner !== undefined) user.profileBanner = profileBanner;

    // Save user
    if (useMongoDB) {
      await user.save();
    } else {
      user.updatedAt = new Date().toISOString();
      await UserMock.updateOne({ _id: req.userId }, user);
    }

    // Remove sensitive data before sending response
    if (useMongoDB) {
      user = await UserMongo.findById(req.userId).select('-password -twoFactorSecret');
    } else {
      delete user.password;
      delete user.twoFactorSecret;
    }

    res.json({
      success: true,
      data: user,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Error updating profile'
    });
  }
});

/**
 * @route   GET /api/account/profile-visibility
 * @desc    Get user's profile visibility setting
 * @access  Private
 */
router.get('/profile-visibility', verifyToken, async (req, res) => {
  try {
    const dbConnection = req.app.get('dbConnection');
    const useMongoDB = dbConnection?.useMongoDB;

    let user;
    if (useMongoDB) {
      user = await UserMongo.findById(req.userId).select('profileVisibility');
    } else {
      user = await UserMock.findById(req.userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        profileVisibility: user.profileVisibility || 'public'
      },
      message: 'Profile visibility retrieved successfully'
    });
  } catch (error) {
    console.error('Get profile visibility error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Error retrieving profile visibility'
    });
  }
});

/**
 * @route   PUT /api/account/profile-visibility
 * @desc    Update user's profile visibility setting
 * @access  Private
 */
router.put('/profile-visibility', verifyToken, async (req, res) => {
  try {
    const { profileVisibility } = req.body;

    // Validate profileVisibility value
    const validOptions = ['public', 'followers', 'private'];
    if (!profileVisibility || !validOptions.includes(profileVisibility)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `Invalid profile visibility. Must be one of: ${validOptions.join(', ')}`
      });
    }

    const dbConnection = req.app.get('dbConnection');
    const useMongoDB = dbConnection?.useMongoDB;

    let user;
    if (useMongoDB) {
      user = await UserMongo.findByIdAndUpdate(
        req.userId,
        { profileVisibility },
        { new: true }
      ).select('profileVisibility');
    } else {
      user = await UserMock.findById(req.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'User not found'
        });
      }

      user.profileVisibility = profileVisibility;
      user.updatedAt = new Date().toISOString();
      const updated = await UserMock.updateOne({ _id: req.userId }, user);
      
      if (!updated) {
        return res.status(500).json({
          success: false,
          data: null,
          message: 'Failed to update profile visibility'
        });
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        profileVisibility: user.profileVisibility
      },
      message: 'Profile visibility updated successfully'
    });
  } catch (error) {
    console.error('Update profile visibility error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Error updating profile visibility'
    });
  }
});

/**
 * @route   GET /api/account/notification-preferences
 * @desc    Get user's notification preferences
 * @access  Private
 */
router.get('/notification-preferences', verifyToken, async (req, res) => {
  try {
    const dbConnection = req.app.get('dbConnection');
    const useMongoDB = dbConnection?.useMongoDB;

    // Get user
    let user;
    if (useMongoDB) {
      user = await UserMongo.findById(req.userId).select('notificationSettings');
    } else {
      user = await UserMock.findById(req.userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.notificationSettings || {
        email: true,
        push: true,
        likes: true,
        comments: true,
        follows: true
      },
      message: 'Notification preferences retrieved successfully'
    });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Error retrieving notification preferences'
    });
  }
});

/**
 * @route   PUT /api/account/notification-preferences
 * @desc    Update user's notification preferences
 * @access  Private
 */
router.put('/notification-preferences', verifyToken, async (req, res) => {
  try {
    const dbConnection = req.app.get('dbConnection');
    const useMongoDB = dbConnection?.useMongoDB;

    const { email, push, likes, comments, follows } = req.body;

    // Build the update object
    const notificationSettings = {};
    if (typeof email === 'boolean') notificationSettings.email = email;
    if (typeof push === 'boolean') notificationSettings.push = push;
    if (typeof likes === 'boolean') notificationSettings.likes = likes;
    if (typeof comments === 'boolean') notificationSettings.comments = comments;
    if (typeof follows === 'boolean') notificationSettings.follows = follows;

    // Update user
    let user;
    if (useMongoDB) {
      user = await UserMongo.findByIdAndUpdate(
        req.userId,
        { 
          $set: { 
            'notificationSettings.email': notificationSettings.email !== undefined ? notificationSettings.email : undefined,
            'notificationSettings.push': notificationSettings.push !== undefined ? notificationSettings.push : undefined,
            'notificationSettings.likes': notificationSettings.likes !== undefined ? notificationSettings.likes : undefined,
            'notificationSettings.comments': notificationSettings.comments !== undefined ? notificationSettings.comments : undefined,
            'notificationSettings.follows': notificationSettings.follows !== undefined ? notificationSettings.follows : undefined
          }
        },
        { new: true }
      ).select('notificationSettings');
    } else {
      user = await UserMock.findById(req.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'User not found'
        });
      }
      
      // Initialize notificationSettings if it doesn't exist
      if (!user.notificationSettings) {
        user.notificationSettings = {
          email: true,
          push: true,
          likes: true,
          comments: true,
          follows: true
        };
      }

      // Update notification settings
      Object.keys(notificationSettings).forEach(key => {
        user.notificationSettings[key] = notificationSettings[key];
      });

      await UserMock.updateOne(req.userId, user);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: useMongoDB ? user.notificationSettings : user.notificationSettings,
      message: 'Notification preferences updated successfully'
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Error updating notification preferences'
    });
  }
});

/**
 * @route   POST /api/account/export-data
 * @desc    Export user's data (GDPR compliance)
 * @access  Private
 */
router.post('/export-data', verifyToken, async (req, res) => {
  try {
    const dbConnection = req.app.get('dbConnection');
    const useMongoDB = dbConnection?.useMongoDB;

    // Get user
    let user;
    if (useMongoDB) {
      user = await UserMongo.findById(req.userId).select('-password');
    } else {
      user = await UserMock.findById(req.userId);
      if (user) {
        delete user.password;
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found'
      });
    }

    // Get user's messages
    let messages;
    if (useMongoDB) {
      messages = await MessageMongo.find({
        $or: [{ sender: req.userId }, { receiver: req.userId }]
      }).select('-deletedBy');
    } else {
      messages = await MessageMock.find({});
      messages = messages.filter(m => 
        m.sender === req.userId || m.receiver === req.userId
      );
    }

    // TODO: Get user's posts, comments, likes, etc.

    const exportData = {
      exportDate: new Date().toISOString(),
      user: user,
      messages: messages,
      posts: [], // TODO: Add posts
      comments: [], // TODO: Add comments
      likes: [] // TODO: Add likes
    };

    res.json({
      success: true,
      data: exportData,
      message: 'Data exported successfully'
    });
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Error exporting data'
    });
  }
});

module.exports = router;
