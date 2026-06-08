import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-PK', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return String(d); }
}

export function timeAgo(d) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function genId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-8)}`;
}

export const CITIES   = ['Karachi','Lahore','Islamabad','Rawalpindi','Faisalabad','Multan','Peshawar','Quetta','Sialkot','Gujranwala','Hyderabad','Other'];
export const PACKAGES = ['Basic Tracker','Standard','Premium','Fleet Bundle','Enterprise / Custom'];

export const TICKET_TYPES    = ['Query','Complaint'];
export const TICKET_STATUSES = ['Open','In Progress','Resolved','Closed'];
export const LEAD_STATUSES   = ['New Lead','Contacted','Interested','Negotiation','Won','Lost'];
export const ASSET_STATUSES  = ['Active','Inactive','Transferred'];

export const ROLE_COLORS = {
  admin:      '#ff7eb3',
  sales:      '#38d9f5',
  operations: '#7b6fff',
  accounts:   '#3dffa0',
  support:    '#ffb347',
  management: '#ff5f6d',
  technician: '#38d9f5',
};

export const ROLE_LABELS = {
  admin:      'System Admin',
  sales:      'Sales Team',
  operations: 'Operations Team',
  accounts:   'Accounts Team',
  support:    'Support Team',
  management: 'Management',
  technician: 'Field Technician',
};
