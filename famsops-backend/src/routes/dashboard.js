const router = require('express').Router();
const svc    = require('../services/dashboardService');
const { auth } = require('../middleware/auth');

// GET /api/v1/dashboard
router.get('/', auth, async (req, res) => {
  const stats = await svc.getStats();
  res.json(stats);
});

// GET /api/v1/dashboard/tasks?daysAhead=7
router.get('/tasks', auth, async (req, res) => {
  const tasks = await svc.getTasks({
    daysAhead: Number(req.query.daysAhead) || 7,
    userId:    req.user.user_id,
    role:      req.user.role,
  });
  res.json(tasks);
});

// GET /api/v1/dashboard/amc-report?daysAhead=30
router.get('/amc-report', auth, async (req, res) => {
  const rows = await svc.getAmcReport(Number(req.query.daysAhead) || 30);
  res.json({ data: rows, total: rows.length });
});

module.exports = router;
