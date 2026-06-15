import axios from 'axios';
import { useAppStore } from '../store';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = useAppStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      useAppStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const api = {
  auth: {
    login:            d       => client.post('/auth/login', d),
    logout:           ()      => client.post('/auth/logout'),
    me:               ()      => client.get('/auth/me'),
    permissions:      ()      => client.get('/auth/permissions'),
    rolePermission:   d       => client.patch('/auth/role-permissions', d),
  },
  customers: {
    list:   p       => client.get('/customers', { params: p }),
    get:    id      => client.get(`/customers/${id}`),
    create: d       => client.post('/customers', d),
    update: (id,d)  => client.patch(`/customers/${id}`, d),
    hub:    id      => client.get(`/customers/${id}/hub`),
  },
  contacts: {
    list:   p       => client.get('/contacts', { params: p }),
    create: d       => client.post('/contacts', d),
    update: (id,d)  => client.patch(`/contacts/${id}`, d),
  },
  drivers: {
    list:   p       => client.get('/drivers', { params: p }),
    create: d       => client.post('/drivers', d),
    update: (id,d)  => client.patch(`/drivers/${id}`, d),
  },
  tickets: {
    list:        p      => client.get('/tickets', { params: p }),
    get:         id     => client.get(`/tickets/${id}`),
    create:      d      => client.post('/tickets', d),
    update:      (id,d) => client.patch(`/tickets/${id}`, d),
    comments:    id     => client.get(`/tickets/${id}/comments`),
    addComment:  (id,d) => client.post(`/tickets/${id}/comments`, d),
  },
  jobOrders: {
    list:        p          => client.get('/job-orders', { params: p }),
    get:         id         => client.get(`/job-orders/${id}`),
    create:      d          => client.post('/job-orders', d),
    update:      (id,d)     => client.patch(`/job-orders/${id}`, d),
    convertLead: leadId     => client.post(`/job-orders/convert-lead/${leadId}`),
    renewAmc:    (assetId,d)=> client.post(`/job-orders/renew-amc/${assetId}`, d),
  },
  leads: {
    list:   p       => client.get('/leads', { params: p }),
    get:    id      => client.get(`/leads/${id}`),
    create: d       => client.post('/leads', d),
    update: (id,d)  => client.patch(`/leads/${id}`, d),
  },
  assets: {
    list:     p       => client.get('/assets', { params: p }),
    get:      id      => client.get(`/assets/${id}`),
    create:   d       => client.post('/assets', d),
    update:   (id,d)  => client.patch(`/assets/${id}`, d),
    renewAmc: (id,d)  => client.post(`/assets/${id}/renew-amc`, d),
  },
  inventory: {
    trackers:      p      => client.get('/inventory/trackers', { params: p }),
    sims:          p      => client.get('/inventory/sims', { params: p }),
    stockIn:       d      => client.post('/inventory/stock-in', d),
    updateTracker: (id,d) => client.patch(`/inventory/trackers/${id}`, d),
    updateSim:     (id,d) => client.patch(`/inventory/sims/${id}`, d),
  },
  quotations: {
    list:    p      => client.get('/quotations', { params: p }),
    get:     id     => client.get(`/quotations/${id}`),
    create:  d      => client.post('/quotations', d),
    update:  (id,d) => client.patch(`/quotations/${id}`, d),
    send:    id     => client.post(`/quotations/${id}/send`),
    approve: (id,d) => client.post(`/quotations/${id}/approve`, d),
    reject:  (id,d) => client.post(`/quotations/${id}/reject`, d),
  },
  subscriptions: {
    list:     p      => client.get('/subscriptions', { params: p }),
    get:      id     => client.get(`/subscriptions/${id}`),
    create:   d      => client.post('/subscriptions', d),
    update:   (id,d) => client.patch(`/subscriptions/${id}`, d),
    activate: id     => client.post(`/subscriptions/${id}/activate`),
    cancel:   (id,d) => client.post(`/subscriptions/${id}/cancel`, d),
  },
  invoices: {
    list:   p      => client.get('/invoices', { params: p }),
    get:    id     => client.get(`/invoices/${id}`),
    create: d      => client.post('/invoices', d),
    update: (id,d) => client.patch(`/invoices/${id}`, d),
    send:   id     => client.post(`/invoices/${id}/send`),
    void:   id     => client.post(`/invoices/${id}/void`),
  },
  payments: {
    list:   p      => client.get('/payments', { params: p }),
    create: d      => client.post('/payments', d),
    update: (id,d) => client.patch(`/payments/${id}`, d),
  },
  technicians: {
    list:   ()      => client.get('/technicians'),
    get:    id      => client.get(`/technicians/${id}`),
    create: d       => client.post('/technicians', d),
    update: (id,d)  => client.patch(`/technicians/${id}`, d),
  },
  tasks: {
    list:   p      => client.get('/tasks', { params: p }),
    create: d      => client.post('/tasks', d),
    update: (id,d) => client.patch(`/tasks/${id}`, d),
  },
  notifications: {
    list:    ()  => client.get('/notifications'),
    read:    id  => client.patch(`/notifications/${id}/read`),
    readAll: ()  => client.patch('/notifications/read-all'),
  },
  users: {
    list:   ()      => client.get('/users'),
    create: d       => client.post('/users', d),
    update: (id,d)  => client.patch(`/users/${id}`, d),
    toggle: id      => client.patch(`/users/${id}/toggle`),
  },
  rates: {
    list:            ()          => client.get('/rates'),
    update:          (type,d)    => client.patch(`/rates/${type}`, d),
    tocRules:        ()          => client.get('/rates/toc-rules'),
    updateTocRule:   (toc,d)     => client.patch(`/rates/toc-rules/${encodeURIComponent(toc)}`, d),
    customerRates:   (custId)    => client.get(`/rates/customer/${custId}`),
    setOverride:     (custId,type,d) => client.put(`/rates/customer/${custId}/${type}`, d),
    removeOverride:  (custId,type)   => client.delete(`/rates/customer/${custId}/${type}`),
  },
  billing: {
    preview:         (params, overrides) => overrides
      ? client.post('/billing/preview', { ...params, priceOverrides: overrides })
      : client.get('/billing/preview', { params }),
    trigger:         (invNo)     => client.post(`/billing/trigger/${invNo}`),
    history:         (custId)    => client.get(`/billing/history/${custId}`),
  },
  dashboard: {
    stats:     ()  => client.get('/dashboard'),
    tasks:     p   => client.get('/dashboard/tasks', { params: p }),
    amcReport: p   => client.get('/dashboard/amc-report', { params: p }),
  },
};
