const jwt  = require('jsonwebtoken');
const { query } = require('../db');

/**
 * Verifies JWT and attaches req.user
 */
async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Verify user still exists and is active
    const { rows } = await query(
      'SELECT user_id, name, email, role, department, active FROM users WHERE user_id = $1',
      [payload.userId]
    );
    if (!rows.length || !rows[0].active) {
      return res.status(401).json({ message: 'Account inactive or not found' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

/**
 * Role-based access control
 * Usage: rbac('admin', 'management')
 */
function rbac(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: `Access denied. Required: ${allowedRoles.join(' | ')}` });
    }
    next();
  };
}

module.exports = { auth, rbac };
