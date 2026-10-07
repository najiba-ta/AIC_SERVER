const jwt = require('jsonwebtoken');

/**
 * Generate a signed JWT token for authenticated user sessions
 * @param {string} userId - MongoDB User ID
 * @param {string} role - User role ('user' | 'admin')
 * @returns {string} Signed JWT Token
 */
const generateToken = (userId, role = 'user') => {
  const secret = process.env.JWT_SECRET || 'aic_jwt_default_secret_fallback_key_2026';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    {
      id: userId,
      role: role,
    },
    secret,
    {
      expiresIn: expiresIn,
    }
  );
};

module.exports = generateToken;
