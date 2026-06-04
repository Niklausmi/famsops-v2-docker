import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Ticket, ClipboardList,
  Car, Target, Package, UserCog, CreditCard,
  LogOut, Menu, Sun, Moon,
} from 'lucide-react';
import { useAppStore } from '../store';
import { ROLE_PAGES } from '../lib/utils';

const ALL_LINKS = [
  { id: 'dashboard', to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard'   },
  { id: 'customers', to: '/customers',  icon: Users,            label: 'Customers'   },
  { id: 'tickets',   to: '/tickets',    icon: Ticket,           label: 'Tickets'     },
  { id: 'jolist',    to: '/job-orders', icon: ClipboardList,    label: 'Job Orders'  },
  { id: 'assets',    to: '/assets',     icon: Car,              label: 'Assets'      },
  { id: 'leads',     to: '/leads',      icon: Target,           label: 'Sales Leads' },
  { id: 'inventory', to: '/inventory',  icon: Package,          label: 'Inventory'   },
  { id: 'payments',  to: '/payments',   icon: CreditCard,       label: 'Payments'    },
  { id: 'users',     to: '/users',      icon: UserCog,          label: 'Users'       },
];

export function Sidebar() {
  const { user, logout, theme, toggleTheme, navCollapsed, toggleNav } = useAppStore();
  const allowed = ROLE_PAGES[user?.role] || [];
  const links   = ALL_LINKS.filter(l => allowed.includes(l.id));
  const avatar  = (user?.avatar || user?.name?.slice(0, 2) || 'FC').toUpperCase();
  const collapsed = navCollapsed;

  return (
    <nav className="crm-nav" style={{ width: collapsed ? 58 : 220, transition: 'width 0.25s' }}>

      {/* Logo */}
      <div style={{
        padding: collapsed ? '18px 0' : '22px 20px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
      }}>
        {!collapsed && (
          <div>
            <div style={{
              fontFamily: 'var(--display)', fontSize: 15, fontWeight: 800,
              letterSpacing: '-0.3px', color: 'var(--text)',
            }}>
              Fams<span style={{ color: 'var(--accent)' }}>ops</span>
            </div>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 3 }}>
              Operations Suite
            </div>
          </div>
        )}
        <button
          onClick={toggleNav}
          style={{
            background: 'none', border: 'none',
            color: 'var(--muted)', cursor: 'pointer',
            padding: 6, borderRadius: 6,
            display: 'flex', alignItems: 'center',
            transition: 'color 0.15s',
          }}
          onMouseOver={e => e.currentTarget.style.color = 'var(--text)'}
          onMouseOut={e => e.currentTarget.style.color = 'var(--muted)'}
        >
          <Menu size={16} />
        </button>
      </div>

      {/* Links */}
      <div style={{ flex: 1, padding: collapsed ? '12px 4px' : '12px 8px', overflowY: 'auto' }}>
        {!collapsed && (
          <div style={{
            fontSize: 8, letterSpacing: 2, textTransform: 'uppercase',
            color: 'var(--muted2)', padding: '14px 10px 6px',
          }}>
            Navigation
          </div>
        )}
        {links.map(({ id, to, icon: Icon, label }) => (
          <NavLink
            key={id}
            to={to}
            title={collapsed ? label : undefined}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 10,
              padding: collapsed ? '13px' : '10px 12px',
              borderRadius: 8,
              color: isActive ? 'var(--accent)' : 'var(--muted)',
              background: isActive ? 'rgba(56,217,245,0.08)' : 'transparent',
              border: isActive ? '1px solid rgba(56,217,245,0.15)' : '1px solid transparent',
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.15s',
              textDecoration: 'none',
              marginBottom: 2,
              justifyContent: collapsed ? 'center' : 'flex-start',
            })}
          >
            <Icon size={16} style={{ flexShrink: 0 }} />
            {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: collapsed ? '8px 4px' : '12px 8px', borderTop: '1px solid var(--border)' }}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            display: 'flex', alignItems: 'center',
            gap: collapsed ? 0 : 10,
            width: '100%',
            padding: collapsed ? '10px' : '9px 12px',
            borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--surface2)',
            color: 'var(--muted)', cursor: 'pointer',
            fontSize: 11, marginBottom: 6,
            justifyContent: collapsed ? 'center' : 'flex-start',
            transition: 'all 0.15s',
          }}
          onMouseOver={e => e.currentTarget.style.borderColor = 'var(--border-hi)'}
          onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          {theme === 'dark'
            ? <Sun size={14} />
            : <Moon size={14} />}
          {!collapsed && (
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          )}
        </button>

        {/* User */}
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 10,
          padding: collapsed ? '10px' : '10px 12px',
          borderRadius: 8,
          background: 'var(--surface2)',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent2), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--display)', fontSize: 11, fontWeight: 700,
            color: '#0a0c0f',
          }}>
            {avatar}
          </div>
          {!collapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, color: 'var(--text)', fontWeight: 500,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {user?.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'capitalize' }}>
                  {user?.role}
                </div>
              </div>
              <button
                onClick={logout}
                title="Logout"
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--muted)', cursor: 'pointer',
                  padding: '4px 6px', borderRadius: 6,
                  transition: 'all 0.15s', flexShrink: 0,
                  display: 'flex', alignItems: 'center',
                }}
                onMouseOver={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgba(255,95,109,0.1)'; }}
                onMouseOut={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
              >
                <LogOut size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
