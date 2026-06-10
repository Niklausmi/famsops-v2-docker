const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { query }     = require('../db');
const { auth, can } = require('../middleware/auth');

// ── POST /api/v1/auth/login ───────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' });

  const { rows } = await query(`
    SELECT
      u.id,
      u.user_id,
      u.name,
      u.email,
      u.password_hash,
      u.role,
      u.role_id,
      u.department,
      u.phone,
      u.active,
      u.avatar,
      u.technician_id,
      u.last_login,
      r.name  AS role_name,
      r.label AS role_label,
      r.color AS role_color,
      COALESCE(
        array_agg(DISTINCT p.module || '.' || p.action)
        FILTER (WHERE p.id IS NOT NULL),
        ARRAY[]::TEXT[]
      ) AS permissions
    FROM users u
    LEFT JOIN roles r             ON r.id  = u.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p       ON p.id  = rp.permission_id
    WHERE u.email = $1
    GROUP BY
      u.id,
      u.user_id,
      u.name,
      u.email,
      u.password_hash,
      u.role,
      u.role_id,
      u.department,
      u.phone,
      u.active,
      u.avatar,
      u.technician_id,
      u.last_login,
      r.name,
      r.label,
      r.color
  `, [email.toLowerCase().trim()]);

  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ message: 'Invalid email or password' });
  if (!user.active)
    return res.status(403).json({ message: 'Account disabled. Contact administrator.' });

  await query(
    'UPDATE users SET last_login = NOW() WHERE user_id = $1',
    [user.user_id]
  );

  const token = jwt.sign(
    { userId: user.user_id, role: user.role_name || user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );

  res.json({
    token,
    user: {
      userId:       user.user_id,
      name:         user.name,
      email:        user.email,
      role:         user.role_name || user.role,
      roleLabel:    user.role_label,
      roleColor:    user.role_color,
      department:   user.department,
      phone:        user.phone,
      avatar:       user.avatar,
      technicianId: user.technician_id,
      permissions:  user.permissions || [],
    },
  });
});

// ── POST /api/v1/auth/logout ──────────────────────────────────
router.post('/logout', auth, (req, res) => {
  res.json({ message: 'Logged out' });
});

// ── GET /api/v1/auth/me ───────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  const { rows } = await query(`
    SELECT
      u.id,
      u.user_id,
      u.name,
      u.email,
      u.role,
      u.role_id,
      u.department,
      u.phone,
      u.avatar,
      u.last_login,
      r.name  AS role_name,
      r.label AS role_label,
      r.color AS role_color,
      COALESCE(
        array_agg(DISTINCT p.module || '.' || p.action)
        FILTER (WHERE p.id IS NOT NULL),
        ARRAY[]::TEXT[]
      ) AS permissions
    FROM users u
    LEFT JOIN roles r             ON r.id  = u.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p       ON p.id  = rp.permission_id
    WHERE u.user_id = $1
    GROUP BY
      u.id,
      u.user_id,
      u.name,
      u.email,
      u.role,
      u.role_id,
      u.department,
      u.phone,
      u.avatar,
      u.last_login,
      r.name,
      r.label,
      r.color
  `, [req.user.userId]);

  if (!rows.length) return res.status(404).json({ message: 'Not found' });
  const u = rows[0];
  res.json({
    userId:      u.user_id,
    name:        u.name,
    email:       u.email,
    role:        u.role_name || u.role,
    roleLabel:   u.role_label,
    roleColor:   u.role_color,
    department:  u.department,
    phone:       u.phone,
    avatar:      u.avatar,
    lastLogin:   u.last_login,
    permissions: u.permissions || [],
  });
});

// ── GET /api/v1/auth/permissions ─────────────────────────────
router.get('/permissions', auth, can('users', 'read'), async (req, res) => {
  const { rows: roles } = await query(`
    SELECT r.*,
      COALESCE(
        json_agg(
          json_build_object('module', p.module, 'action', p.action, 'label', p.label, 'id', p.id)
        ) FILTER (WHERE p.id IS NOT NULL),
        '[]'
      ) AS permissions
    FROM roles r
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p       ON p.id = rp.permission_id
    GROUP BY r.id
    ORDER BY r.id
  `);
  const { rows: allPerms } = await query(
    'SELECT * FROM permissions ORDER BY module, action'
  );
  res.json({ roles, allPermissions: allPerms });
});

// ── PATCH /api/v1/auth/role-permissions ──────────────────────
router.patch('/role-permissions', auth, can('users', 'update'), async (req, res) => {
  const { roleId, permissionId, grant } = req.body;
  if (!roleId || !permissionId)
    return res.status(400).json({ message: 'roleId and permissionId required' });

  if (grant) {
    await query(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [roleId, permissionId]
    );
  } else {
    await query(
      'DELETE FROM role_permissions WHERE role_id=$1 AND permission_id=$2',
      [roleId, permissionId]
    );
  }
  res.json({ message: grant ? 'Permission granted' : 'Permission revoked' });
});

module.exports = router;
