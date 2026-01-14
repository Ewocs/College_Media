/**
 * ============================================================
 * AUTH & ROLE-BASED ACCESS CONTROL MIDDLEWARE
 * ============================================================
 * File: middlewares/auth.middleware.js
 *
 * Responsibilities:
 * - Verify JWT token
 * - Attach authenticated user to request
 * - Handle token expiry & invalid tokens
 * - Provide role-based authorization (Admin / Alumni)
 * - Attach request metadata for audit logging
 * - Centralized error handling patterns
 *
 * ============================================================
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * ------------------------------------------------------------
 * Utility: Send standardized error response
 * ------------------------------------------------------------
 */
const sendError = (res, statusCode, message, error = null) => {
  res.status(statusCode).json({
    success: false,
    message,
    stack:
      process.env.NODE_ENV === 'production'
        ? null
        : error?.stack || null
  });
};

/**
 * ------------------------------------------------------------
 * Utility: Extract token from Authorization header
 * ------------------------------------------------------------
 */
const extractToken = (req) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};

/**
 * ------------------------------------------------------------
 * Utility: Verify JWT token safely
 * ------------------------------------------------------------
 */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * ------------------------------------------------------------
 * Utility: Attach request metadata (for audit logs)
 * ------------------------------------------------------------
 */
const attachRequestMeta = (req) => {
  req.requestMeta = {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  };
};

/**
 * ============================================================
 * @desc    Protect Routes Middleware
 * @usage   protect
 * ============================================================
 */
const protect = async (req, res, next) => {
  let token;

  try {
    // Attach request metadata early
    attachRequestMeta(req);

    // Step 1: Extract token
    token = extractToken(req);

    if (!token) {
      return sendError(res, 401, 'Not authorized, no token provided');
    }

    // Step 2: Verify token
    const decoded = verifyToken(token);

    /**
     * Support both:
     * - decoded.id
     * - decoded.userId
     * (Backward compatibility)
     */
    const userId = decoded.userId || decoded.id;

    if (!userId) {
      return sendError(res, 401, 'Invalid token payload');
    }

    // Step 3: Fetch user
    const user = await User.findById(userId).select('-password');

    if (!user) {
      return sendError(res, 401, 'Not authorized, user not found');
    }

    /**
     * Optional security checks
     * ----------------------------------------------------------
     * - isActive flag
     * - isBlocked flag
     * - accountLocked flag
     */
    if (user.isBlocked) {
      return sendError(res, 403, 'Account is blocked');
    }

    if (user.isDeleted) {
      return sendError(res, 403, 'Account no longer exists');
    }

    // Step 4: Attach user to request
    req.user = user;

    // Step 5: Attach auth context
    req.auth = {
      userId: user._id,
      role: user.role,
      tokenIssuedAt: decoded.iat,
      tokenExpiry: decoded.exp
    };

    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);

    if (error.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Not authorized, token expired', error);
    }

    if (error.name === 'JsonWebTokenError') {
      return sendError(res, 401, 'Not authorized, invalid token', error);
    }

    return sendError(res, 401, 'Not authorized, token failed', error);
  }
};

/**
 * ============================================================
 * @desc    Admin Role Middleware
 * @usage   admin
 * ============================================================
 */
const admin = (req, res, next) => {
  try {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required');
    }

    if (req.user.role !== 'admin') {
      return sendError(res, 403, 'Not authorized as an admin');
    }

    /**
     * Attach admin context
     * (useful for audit logs & sensitive actions)
     */
    req.adminContext = {
      adminId: req.user._id,
      adminEmail: req.user.email,
      verifiedAt: new Date().toISOString()
    };

    next();
  } catch (error) {
    return sendError(res, 500, 'Admin authorization failed', error);
  }
};

/**
 * ============================================================
 * @desc    Alumni Role Middleware
 * @usage   alumni
 * ============================================================
 */
const alumni = (req, res, next) => {
  try {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required');
    }

    if (
      req.user.role !== 'alumni' &&
      req.user.role !== 'admin'
    ) {
      return sendError(res, 403, 'Not authorized as alumni');
    }

    next();
  } catch (error) {
    return sendError(res, 500, 'Alumni authorization failed', error);
  }
};

/**
 * ============================================================
 * FUTURE EXTENSIONS (Hooks)
 * ============================================================
 */

/**
 * @desc    MFA verification hook (placeholder)
 */
const requireMFA = (req, res, next) => {
  /**
   * Example:
   * if (!req.user.mfaVerified) {
   *   return sendError(res, 403, 'MFA verification required');
   * }
   */
  next();
};

/**
 * @desc    Permission-based authorization (RBAC)
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required');
    }

    if (!req.user.permissions?.includes(permission)) {
      return sendError(
        res,
        403,
        `Missing required permission: ${permission}`
      );
    }

    next();
  };
};

/**
 * ============================================================
 * EXPORTS
 * ============================================================
 */
module.exports = {
  protect,
  admin,
  alumni,
  requireMFA,
  requirePermission
};
