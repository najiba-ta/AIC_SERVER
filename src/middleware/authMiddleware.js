const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to protect user routes via JWT authentication
 */
const protect = async (req, res, next) => {
  let token = null;

  // Extract Bearer token from Authorization header or cookie
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7).trim();
  } else if (req.cookies && (req.cookies.token || req.cookies.admin_token)) {
    token = (req.cookies.token || req.cookies.admin_token).trim();
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized. Authentication token is missing.',
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'aic_jwt_default_secret_fallback_key_2026';
    const decoded = jwt.verify(token, secret);

    // If it's the master admin synthetic user ID
    if (decoded.id === 'admin_master') {
      req.user = {
        _id: 'admin_master',
        id: 'admin_master',
        name: 'Master Administrator',
        email: 'admin@alhidayah.org',
        role: 'admin',
      };
      return next();
    }

    // Fetch user from database excluding password
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The account associated with this token no longer exists.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated. Please contact support.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('[Auth Middleware Error]:', err.message);
    return res.status(401).json({
      success: false,
      message: 'Not authorized. Token is invalid or expired.',
    });
  }
};

/**
 * Middleware to restrict access to specific roles (e.g. 'admin')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to perform this action.',
      });
    }
    next();
  };
};

/**
 * Hybrid Middleware for Admin routes:
 * Accepts EITHER:
 * 1. An Admin API Key (in `x-admin-key`, `x-admin-api-key`, or `Authorization: Bearer <ADMIN_API_KEY>`)
 * 2. A valid JWT token belonging to an Admin user
 */
const requireAdminAuth = async (req, res, next) => {
  const configuredApiKey = (process.env.ADMIN_API_KEY || '').trim();

  // Helper for diagnostic logging without ever exposing secrets
  const logAuth = (method, hasCredential, success, status) => {
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_AUTH_LOGS === 'true') {
      console.log(
        `[Admin Auth] method=${method} credentialExists=${hasCredential} success=${success} endpoint=${req.originalUrl || req.url} status=${status}`
      );
    }
  };

  // 1. Check for direct Admin API Key in headers (x-admin-key, x-admin-api-key)
  const customKey = (
    req.headers['x-admin-key'] ||
    req.headers['x-admin-api-key'] ||
    ''
  ).trim();

  if (configuredApiKey && customKey && customKey === configuredApiKey) {
    req.user = {
      _id: 'admin_master',
      id: 'admin_master',
      name: 'Administrator (API Key)',
      email: 'admin@alhidayah.org',
      role: 'admin',
    };
    logAuth('x-admin-key', true, true, 200);
    return next();
  }

  // 2. Check for token in Authorization header or cookie
  const authHeader = req.headers.authorization;
  let token = null;
  let authMethod = 'none';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
    authMethod = 'bearer';
  } else if (req.cookies && (req.cookies.admin_token || req.cookies.token || req.cookies.admin_session)) {
    token = (req.cookies.admin_token || req.cookies.token || req.cookies.admin_session || '').trim();
    authMethod = 'cookie';
  }

  // 2a. Check if Bearer token matches the direct ADMIN_API_KEY string
  if (configuredApiKey && token && token === configuredApiKey) {
    req.user = {
      _id: 'admin_master',
      id: 'admin_master',
      name: 'Administrator (API Key)',
      email: 'admin@alhidayah.org',
      role: 'admin',
    };
    logAuth('bearer-api-key', true, true, 200);
    return next();
  }

  // 2b. Otherwise, if token exists, verify as JWT
  if (token) {
    try {
      const secret = process.env.JWT_SECRET || 'aic_jwt_default_secret_fallback_key_2026';
      const decoded = jwt.verify(token, secret);

      // Synthetic master admin token
      if (decoded.id === 'admin_master') {
        req.user = {
          _id: 'admin_master',
          id: 'admin_master',
          name: 'Master Administrator',
          email: 'admin@alhidayah.org',
          role: 'admin',
        };
        logAuth(authMethod === 'cookie' ? 'cookie-jwt' : 'bearer-jwt', true, true, 200);
        return next();
      }

      // Database-backed user token
      if (decoded.id) {
        const user = await User.findById(decoded.id).select('-password');
        if (user && user.role === 'admin' && user.isActive) {
          req.user = user;
          logAuth(authMethod === 'cookie' ? 'cookie-jwt' : 'bearer-jwt', true, true, 200);
          return next();
        }

        if (user && user.role !== 'admin') {
          logAuth(authMethod === 'cookie' ? 'cookie-jwt' : 'bearer-jwt', true, false, 403);
          return res.status(403).json({
            success: false,
            message: 'Access denied. Administrator privileges required.',
          });
        }
      }

      // Fallback for role='admin' in token if user lookup is not needed
      if (decoded.role === 'admin') {
        req.user = {
          _id: decoded.id || 'admin_master',
          id: decoded.id || 'admin_master',
          name: decoded.name || 'Administrator',
          email: decoded.email || 'admin@alhidayah.org',
          role: 'admin',
        };
        logAuth(authMethod === 'cookie' ? 'cookie-jwt' : 'bearer-jwt', true, true, 200);
        return next();
      }

      logAuth(authMethod === 'cookie' ? 'cookie-jwt' : 'bearer-jwt', true, false, 403);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.',
      });
    } catch (err) {
      logAuth(authMethod === 'cookie' ? 'cookie-jwt' : 'bearer-jwt', true, false, 401);
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. Invalid admin authentication token or API key.',
      });
    }
  }

  // 3. Neither valid key nor token provided
  logAuth(customKey ? 'x-admin-key' : 'none', Boolean(customKey || authHeader), false, 401);
  return res.status(401).json({
    success: false,
    message: 'Unauthorized. Admin authentication is required.',
  });
};

module.exports = {
  protect,
  restrictTo,
  requireAdminAuth,
};
