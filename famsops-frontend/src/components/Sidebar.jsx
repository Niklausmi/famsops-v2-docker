import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Ticket, ClipboardList,
  Car, Target, Package, UserCog, CreditCard,
  LogOut, Menu, Sun, Moon, Wrench,
  FileText, RefreshCw, Bell, CheckSquare,
  Receipt, Layers, Shield, DollarSign,
} from 'lucide-react';
import { useAppStore } from '../store';

// Every nav item declares which permission it needs.
// The sidebar only renders items the user can access.
const ALL_LINKS = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard',      perm: ['dashboard','read'] },
  { to: '/customers',     icon: Users,            label: 'Customers',      perm: ['customers','read'] },
  { to: '/leads',         icon: Target,           label: 'Sales Leads',    perm: ['leads','read'] },
  { to: '/quotations',    icon: FileText,          label: 'Quotations',     perm: ['quotations','read'] },
  { to: '/tickets',       icon: Ticket,            label: 'Tickets',        perm: ['tickets','read'] },
  { to: '/job-orders',    icon: ClipboardList,     label: 'Job Orders',     perm: ['job_orders','read'] },
  { to: '/assets',        icon: Car,               label: 'Assets',         perm: ['assets','read'] },
  { to: '/inventory',     icon: Package,           label: 'Inventory',      perm: ['inventory','read'] },
  { to: '/subscriptions', icon: Layers,            label: 'Subscriptions',  perm: ['subscriptions','read'] },
  { to: '/invoices',      icon: Receipt,           label: 'Invoices',       perm: ['invoices','read'] },
  { to: '/payments',      icon: CreditCard,        label: 'Payments',       perm: ['payments','read'] },
  { to: '/tasks',         icon: CheckSquare,       label: 'Tasks',          perm: ['tasks','read'] },
  { to: '/technicians',   icon: Wrench,            label: 'Technicians',    perm: ['technicians','read'] },
  { to: '/users',         icon: UserCog,           label: 'Users',          perm: ['users','read'] },
  { to: '/rates',          icon: DollarSign,        label: 'Rate Config',    perm: ['payments','update'] },
  { to: '/permissions',    icon: Shield,            label: 'Permissions',    perm: ['users','update'] },
];

const ROLE_COLORS = {
  admin:      '#ff7eb3',
  sales:      '#38d9f5',
  operations: '#7b6fff',
  accounts:   '#3dffa0',
  support:    '#ffb347',
  management: '#ff5f6d',
  technician: '#38d9f5',
};

export function Sidebar() {
  const { user, logout, theme, toggleTheme, navCollapsed, toggleNav, can } = useAppStore();

  const links     = ALL_LINKS.filter(l => can(l.perm[0], l.perm[1]));
  const avatar    = (user?.name || 'FO').slice(0, 2).toUpperCase();
  const collapsed = navCollapsed;
  const roleColor = user?.roleColor || ROLE_COLORS[user?.role] || 'var(--accent)';

  return (
    <nav className="crm-nav" style={{ width: collapsed ? 58 : 220, transition: 'width 0.25s' }}>

      {/* Logo */}
      <div style={{
        padding: collapsed ? '18px 0' : '20px 18px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
      }}>
        {!collapsed && (
          <div>
            <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--text)' }}>
              Fams<span style={{ color: 'var(--accent)' }}>ops</span>
            </div>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 2 }}>
              v2 · Operations Suite
            </div>
          </div>
        )}
        <button onClick={toggleNav} style={{
          background: 'none', border: 'none', color: 'var(--muted)',
          cursor: 'pointer', padding: 6, borderRadius: 6,
          display: 'flex', alignItems: 'center', transition: 'color .15s',
        }}
          onMouseOver={e => e.currentTarget.style.color = 'var(--text)'}
          onMouseOut={e => e.currentTarget.style.color = 'var(--muted)'}
        >
          <Menu size={16} />
        </button>
      </div>

      {/* Links */}
      <div style={{ flex: 1, padding: collapsed ? '10px 4px' : '10px 8px', overflowY: 'auto' }}>
        {links.map(({ to, icon: Icon, label, perm }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 10,
              padding: collapsed ? '12px' : '9px 11px',
              borderRadius: 8, marginBottom: 2,
              color: isActive ? 'var(--accent)' : 'var(--muted)',
              background: isActive ? 'rgba(56,217,245,0.08)' : 'transparent',
              border: isActive ? '1px solid rgba(56,217,245,0.15)' : '1px solid transparent',
              fontSize: 11, cursor: 'pointer',
              transition: 'all .15s', textDecoration: 'none',
              justifyContent: collapsed ? 'center' : 'flex-start',
            })}
          >
            <Icon size={15} style={{ flexShrink: 0 }} />
            {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: collapsed ? '8px 4px' : '10px 8px', borderTop: '1px solid var(--border)' }}>

        {/* Theme toggle */}
        <button onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} style={{
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 10, width: '100%',
          padding: collapsed ? '10px' : '8px 11px',
          borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--surface2)', color: 'var(--muted)',
          cursor: 'pointer', fontSize: 11, marginBottom: 6,
          justifyContent: collapsed ? 'center' : 'flex-start',
          transition: 'all .15s',
        }}>
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        {/* User tile */}
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 10, padding: collapsed ? '8px' : '10px 11px',
          borderRadius: 8, background: 'var(--surface2)',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          {/* Avatar */}
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: `linear-gradient(135deg, ${roleColor}cc, ${roleColor})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Syne', fontSize: 11, fontWeight: 800, color: '#0a0c0f',
          }}>
            {avatar}
          </div>

          {!collapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, color: 'var(--text)', fontWeight: 600,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {user?.name}
                </div>
                <div style={{
                  fontSize: 9, letterSpacing: 1, textTransform: 'uppercase',
                  color: roleColor, marginTop: 2,
                }}>
                  {user?.roleLabel || user?.role}
                </div>
              </div>
              <button onClick={logout} title="Logout" style={{
                background: 'none', border: 'none', color: 'var(--muted)',
                cursor: 'pointer', padding: '4px 6px', borderRadius: 6,
                flexShrink: 0, display: 'flex', alignItems: 'center',
                transition: 'all .15s',
              }}
                onMouseOver={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgba(255,95,109,0.1)'; }}
                onMouseOut={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
              >
                <LogOut size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
