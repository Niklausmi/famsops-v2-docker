const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { query } = require('../db');
const { auth }  = require('../middleware/auth');

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const { rows } = await query(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );

  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  if (!user.active) {
    return res.status(403).json({ message: 'Account is disabled. Contact your administrator.' });
  }

  // Update last_login
  await query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [user.user_id]);

  const token = jwt.sign(
    { userId: user.user_id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );

  res.json({
    token,
    user: {
      userId:     user.user_id,
      name:       user.name,
      email:      user.email,
      role:       user.role,
      department: user.department,
      avatar:     user.avatar,
    },
  });
});

// POST /api/v1/auth/logout  (client drops token; server logs it)
router.post('/logout', auth, async (req, res) => {
  res.json({ message: 'Logged out' });
});

// GET /api/v1/auth/me
router.get('/me', auth, async (req, res) => {
  const { rows } = await query(
    'SELECT user_id, name, email, role, department, avatar, last_login FROM users WHERE user_id = $1',
    [req.user.user_id]
  );
  if (!rows.length) return res.status(404).json({ message: 'User not found' });
  res.json(rows[0]);
});

module.exports = router;
