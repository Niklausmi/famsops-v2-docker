const router = require('express').Router();
const svc    = require('../services/jobOrderService');
const { auth, rbac } = require('../middleware/auth');

// GET /api/v1/job-orders
router.get('/', auth, async (req, res) => {
  const data = await svc.list(req.query);
  res.json({ data, total: data.length });
});

// GET /api/v1/job-orders/:id
router.get('/:id', auth, async (req, res) => {
  const j = await svc.getById(req.params.id);
  if (!j) return res.status(404).json({ message: 'Job order not found' });
  res.json(j);
});

// POST /api/v1/job-orders
router.post('/', auth, async (req, res) => {
  const d = req.body;
  if (!d.customerId) return res.status(400).json({ message: 'customerId is required' });
  const j = await svc.create(d, req.user.user_id);
  res.status(201).json(j);
});

// PATCH /api/v1/job-orders/:id
router.patch('/:id', auth, async (req, res) => {
  const j = await svc.update(req.params.id, req.body);
  if (!j) return res.status(404).json({ message: 'Job order not found' });
  res.json(j);
});

// POST /api/v1/job-orders/convert-lead/:leadId
// Converts a Won lead into a pre-filled Job Order
router.post('/convert-lead/:leadId', auth, async (req, res) => {
  const j = await svc.convertFromLead(req.params.leadId, req.user.user_id);
  res.status(201).json(j);
});

// POST /api/v1/job-orders/renew-amc/:assetId
// Creates an AMC renewal Job Order for an asset
router.post('/renew-amc/:assetId', auth, async (req, res) => {
  const j = await svc.renewAmc(req.params.assetId, req.body, req.user.user_id);
  res.status(201).json(j);
});

module.exports = router;
