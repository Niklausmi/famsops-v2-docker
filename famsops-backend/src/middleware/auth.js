const jwt    = require('jsonwebtoken');
const { query } = require('../db');

/**
 * Verify JWT, attach req.user with full permission set loaded from DB
 */
async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer '))
    return res.status(401).json({ message: 'No token provided' });

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await query(`
      SELECT
        u.user_id, u.name, u.email, u.role, u.role_id,
        u.department, u.phone, u.active, u.technician_id,
        r.name  AS role_name,
        r.label AS role_label,
        r.color AS role_color,
        COALESCE(
          array_agg(DISTINCT p.module || '.' || p.action)
          FILTER (WHERE p.id IS NOT NULL),
          ARRAY[]::TEXT[]
        ) AS permissions
      FROM users u
      LEFT JOIN roles r            ON r.id  = u.role_id
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p      ON p.id  = rp.permission_id
      WHERE u.user_id = $1
      GROUP BY u.id, u.user_id, u.name, u.email, u.role, u.role_id,
               u.department, u.phone, u.active, u.technician_id,
               r.name, r.label, r.color
    `, [payload.userId]);

    if (!rows.length || !rows[0].active)
      return res.status(401).json({ message: 'Account inactive or not found' });

    const u = rows[0];
    req.user = {
      userId:       u.user_id,
      name:         u.name,
      email:        u.email,
      role:         u.role_name || u.role,       // prefer DB role name
      roleId:       u.role_id,
      roleLabel:    u.role_label,
      roleColor:    u.role_color,
      department:   u.department,
      phone:        u.phone,
      technicianId: u.technician_id,
      permissions:  new Set(u.permissions || []),
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

/**
 * Fine-grained permission check.
 * Usage: can('customers', 'read')
 *        can('quotations', 'approve')
 */
function can(module, action) {
  return (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ message: 'Unauthorized' });
    if (req.user.role === 'admin')
      return next();
    if (!req.user.permissions.has(`${module}.${action}`)) {
      return res.status(403).json({
        message: `Access denied — requires "${module}.${action}"`,
        required: `${module}.${action}`,
        role:     req.user.role,
      });
    }
    next();
  };
}

/**
 * Legacy role guard — kept during transition. Prefer can() for new routes.
 */
function rbac(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ message: 'Unauthorized' });
    if (req.user.role === 'admin' || allowedRoles.includes(req.user.role))
      return next();
    return res.status(403).json({
      message: `Access denied. Required: ${allowedRoles.join(' | ')}`,
    });
  };
}

/**
 * Technician guard — adds req.technicianFilter so routes can
 * scope queries to only the technician's own jobs.
 */
function technicianSelf(req, res, next) {
  if (req.user.role === 'technician') {
    req.technicianFilter = req.user.technicianId;
  }
  next();
}

module.exports = { auth, can, rbac, technicianSelf };