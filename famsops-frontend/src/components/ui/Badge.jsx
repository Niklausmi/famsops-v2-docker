import { cn } from '../../lib/utils';

const variants = {
  default:     'badge-open',
  open:        'badge-open',
  closed:      'badge-closed',
  won:         'badge-won',
  lost:        'badge-lost',
  active:      'badge-active',
  inactive:    'badge-inactive',
  hot:         'badge-hot',
  warn:        'badge-warn',
  purple:      'badge-purple',
  admin:       'badge-admin',
  sales:       'badge-sales',
  operations:  'badge-operations',
  management:  'badge-management',
  available:   'badge-active',
  assigned:    'badge-purple',
  installed:   'badge-active',
  removed:     'badge-inactive',
  faulty:      'badge-warn',
  lead:        'badge-active',
  query:       'badge-purple',
  complaint:   'badge-hot',
  new:         'badge-open',
  contacted:   'badge-purple',
  interested:  'badge-warn',
  negotiation: 'badge-warn',
  'in progress': 'badge-warn',
  resolved:    'badge-active',
};

export function Badge({ children, variant, className }) {
  const v = (variant || String(children || '').toLowerCase()).toLowerCase();
  const cls = variants[v] || 'badge-closed';
  return (
    <span className={cn('badge', cls, className)}>
      {children}
    </span>
  );
}
