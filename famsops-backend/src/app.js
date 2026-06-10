require('dotenv').config();
require('express-async-errors');

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');

const authRoutes   = require('./routes/auth');
const custRoutes   = require('./routes/customers');
const ticketRoutes = require('./routes/tickets');
const jobRoutes    = require('./routes/jobOrders');
const leadRoutes   = require('./routes/leads');
const assetRoutes  = require('./routes/assets');
const techRoutes   = require('./routes/technicians');
const dashRoutes   = require('./routes/dashboard');
const quotRoutes   = require('./routes/quotations');
const billRoutes   = require('./routes/billing');   // subscriptions + invoices
const miscRoutes   = require('./routes/misc');
const ratesRoutes  = require('./routes/rates');      // inventory,payments,users,contacts,drivers,tasks,notifications

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'famsops-api', ts: new Date().toISOString() });
});

// Routes
app.use('/api/v1/auth',        authRoutes);
app.use('/api/v1/customers',   custRoutes);
app.use('/api/v1/tickets',     ticketRoutes);
app.use('/api/v1/job-orders',  jobRoutes);
app.use('/api/v1/leads',       leadRoutes);
app.use('/api/v1/assets',      assetRoutes);
app.use('/api/v1/technicians', techRoutes);
app.use('/api/v1/dashboard',   dashRoutes);
app.use('/api/v1/quotations',  quotRoutes);
app.use('/api/v1',             billRoutes);   // /subscriptions /invoices
app.use('/api/v1',             ratesRoutes);  // rates, billing preview, overrides
app.use('/api/v1',             miscRoutes);   // everything else

// 404
app.use((req, res) => {
  res.status(404).json({ message: `Cannot ${req.method} ${req.path}` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  if (err.code === '23505') return res.status(409).json({ message: 'Duplicate entry — record already exists' });
  if (err.code === '23503') return res.status(400).json({ message: 'Referenced record does not exist' });
  if (err.code === '23514') return res.status(400).json({ message: 'Value violates constraint: ' + (err.detail||err.message) });
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Famsops API  →  http://localhost:${PORT}`);
  console.log(`   Health       →  http://localhost:${PORT}/health\n`);
});

module.exports = app;
