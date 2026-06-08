const router = require('express').Router();
const pricingService = require('../services/pricingService');
const { auth, can } = require('../middleware/auth');

/**
 * Pricing Override Routes
 */

// GET /api/v1/pricing/overrides/:customerId
router.get('/overrides/:customerId', auth, can('customers', 'read'), async (req, res) => {
  try {
    const data = await pricingService.listByCustomer(req.params.customerId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/v1/pricing/overrides
router.post('/overrides', auth, can('customers', 'update'), async (req, res) => {
  try {
    const { customerId, itemType, customRate, notes } = req.body;
    if (!customerId || !itemType || customRate === undefined) {
      return res.status(400).json({ message: 'customerId, itemType, and customRate are required' });
    }
    const data = await pricingService.upsertOverride({ customerId, itemType, customRate, notes });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/v1/pricing/overrides/:customerId/:itemType
router.delete('/overrides/:customerId/:itemType', auth, can('customers', 'update'), async (req, res) => {
  try {
    await pricingService.removeOverride(req.params.customerId, req.params.itemType);
    res.json({ message: 'Override removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
