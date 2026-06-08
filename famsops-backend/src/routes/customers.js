const router  = require('express').Router();
const svc     = require('../services/customerService');
const { auth } = require('../middleware/auth');

// GET /api/v1/customers
router.get('/', auth, async (req, res) => {
  const data = await svc.list(req.query);
  res.json({ data, total: data.length });
});

// GET /api/v1/customers/:id
router.get('/:id', auth, async (req, res) => {
  const c = await svc.getById(req.params.id);
  if (!c) return res.status(404).json({ message: 'Customer not found' });
  res.json(c);
});

// GET /api/v1/customers/:id/hub
router.get('/:id/hub', auth, async (req, res) => {
  const hub = await svc.getHub(req.params.id);
  if (!hub) return res.status(404).json({ message: 'Customer not found' });
  res.json(hub);
});

// POST /api/v1/customers
router.post('/', auth, async (req, res) => {
  const d = req.body;
  if (!d.customerName) return res.status(400).json({ message: 'customerName is required' });
  if (!d.contact)      return res.status(400).json({ message: 'contact is required' });
  const c = await svc.create(d);
  res.status(201).json(c);
});

// PATCH /api/v1/customers/:id
router.patch('/:id', auth, async (req, res) => {
  const c = await svc.update(req.params.id, req.body);
  if (!c) return res.status(404).json({ message: 'Customer not found' });
  res.json(c);
});

module.exports = router;
