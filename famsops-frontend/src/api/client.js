import axios from 'axios';
import { useAppStore } from '../store';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
client.interceptors.request.use((config) => {
  const token = useAppStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAppStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────
export const api = {
  auth: {
    login:   (data) => client.post('/auth/login', data),
    logout:  ()     => client.post('/auth/logout'),
    me:      ()     => client.get('/auth/me'),
  },
  customers: {
    list:    (p)    => client.get('/customers', { params: p }),
    get:     (id)   => client.get(`/customers/${id}`),
    create:  (d)    => client.post('/customers', d),
    update:  (id,d) => client.patch(`/customers/${id}`, d),
    hub:     (id)   => client.get(`/customers/${id}/hub`),
  },
  tickets: {
    list:    (p)    => client.get('/tickets', { params: p }),
    get:     (id)   => client.get(`/tickets/${id}`),
    create:  (d)    => client.post('/tickets', d),
    update:  (id,d) => client.patch(`/tickets/${id}`, d),
  },
  jobOrders: {
    list:    (p)    => client.get('/job-orders', { params: p }),
    get:     (id)   => client.get(`/job-orders/${id}`),
    create:  (d)    => client.post('/job-orders', d),
    update:  (id,d) => client.patch(`/job-orders/${id}`, d),
  },
  leads: {
    list:    (p)    => client.get('/leads', { params: p }),
    get:     (id)   => client.get(`/leads/${id}`),
    create:  (d)    => client.post('/leads', d),
    update:  (id,d) => client.patch(`/leads/${id}`, d),
  },
  assets: {
    list:    (p)    => client.get('/assets', { params: p }),
    get:     (id)   => client.get(`/assets/${id}`),
    create:  (d)    => client.post('/assets', d),
    update:  (id,d) => client.patch(`/assets/${id}`, d),
  },
  inventory: {
    trackers: (p)   => client.get('/inventory/trackers', { params: p }),
    sims:     (p)   => client.get('/inventory/sims', { params: p }),
    stockIn:  (d)   => client.post('/inventory/stock-in', d),
    stockOut: (d)   => client.post('/inventory/stock-out', d),
    assign:   (d)   => client.post('/inventory/assign', d),
    updateTracker: (id,d) => client.patch(`/inventory/trackers/${id}`, d),
    updateSim:     (id,d) => client.patch(`/inventory/sims/${id}`, d),
  },
  payments: {
    list:    (p)    => client.get('/payments', { params: p }),
    create:  (d)    => client.post('/payments', d),
    update:  (id,d) => client.patch(`/payments/${id}`, d),
  },
  users: {
    list:    ()     => client.get('/users'),
    create:  (d)    => client.post('/users', d),
    update:  (id,d) => client.patch(`/users/${id}`, d),
    toggle:  (id)   => client.patch(`/users/${id}/toggle`),
  },
  dashboard: {
    stats:   ()     => client.get('/dashboard'),
  },
};
