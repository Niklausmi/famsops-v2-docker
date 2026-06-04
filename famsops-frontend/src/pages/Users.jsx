import { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { Topbar } from '../components/ui/Topbar';
import { PageContent } from '../components/ui/Layout';
import { StatTile } from '../components/ui/StatTile';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { Modal, ModalButtons } from '../components/ui/Modal';
import { Field, Input, Select } from '../components/ui/Field';
import { api } from '../api/client';
import { formatDate, genId } from '../lib/utils';

const ROLES       = ['admin', 'sales', 'operations', 'management'];
const DEPTS       = ['Operations', 'Sales', 'Technical', 'Management', 'Finance', 'HR'];
const ROLE_DESC   = {
  admin:      'Full access to all modules',
  sales:      'Dashboard, Customers, Tickets, Leads',
  operations: 'Dashboard, Customers, Tickets, Job Orders, Assets, Inventory',
  management: 'Dashboard, Customers, Tickets, Leads, Job Orders, Assets, Inventory',
};

const BLANK = {
  userId: '', name: '', email: '', role: 'operations',
  department: '', phone: '', active: true, password: '', confirmPassword: '',
};

export default function Users() {
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showEdit, setShowEdit]     = useState(false);
  const [form, setForm]             = useState(BLANK);
  const [saving, setSaving]         = useState(false);
  const [formErr, setFormErr]       = useState('');
  const [confirmToggle, setConfirmToggle] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.users.list(); setUsers(data.data || data || []); }
    catch { setUsers([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let r = users;
    if (search)     r = r.filter(u => [u.name, u.email, u.department, u.userId].some(v => (v||'').toLowerCase().includes(search.toLowerCase())));
    if (roleFilter) r = r.filter(u => u.role === roleFilter);
    return r;
  }, [users, search, roleFilter]);

  const counts = useMemo(() => ({
    total:  users.length,
    active: users.filter(u => u.active !== false).length,
    ...Object.fromEntries(ROLES.map(r => [r, users.filter(u => u.role === r).length])),
  }), [users]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const openNew  = () => { setForm(BLANK); setFormErr(''); setShowEdit(true); };
  const openEdit = (u) => { setForm({ ...BLANK, ...u, password: '', confirmPassword: '' }); setFormErr(''); setShowEdit(true); };

  const save = async () => {
    if (!form.name)  { setFormErr('Name is required'); return; }
    if (!form.email) { setFormErr('Email is required'); return; }
    if (!form.userId && !form.password) { setFormErr('Password is required for new users'); return; }
    if (form.password && form.password !== form.confirmPassword) { setFormErr('Passwords do not match'); return; }
    setSaving(true); setFormErr('');
    try {
      const { confirmPassword, ...payload } = { ...form, userId: form.userId || genId('USR') };
      if (!payload.password) delete payload.password;
      if (form.userId) await api.users.update(form.userId, payload);
      else             await api.users.create(payload);
      setShowEdit(false); load();
    } catch(e) { setFormErr(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const toggleUser = async (u) => {
    try { await api.users.toggle(u.userId); load(); setConfirmToggle(null); }
    catch(e) { alert('Failed: ' + e.message); }
  };

  const ROLE_COLORS = {
    admin:      { badge: 'badge-admin',       bg: 'rgba(255,126,179,0.08)', border: 'rgba(255,126,179,0.2)', color: 'var(--accent3)' },
    sales:      { badge: 'badge-sales',       bg: 'rgba(56,217,245,0.08)',  border: 'rgba(56,217,245,0.2)',  color: 'var(--accent)' },
    operations: { badge: 'badge-operations',  bg: 'rgba(123,111,255,0.08)', border: 'rgba(123,111,255,0.2)', color: 'var(--accent2)' },
    management: { badge: 'badge-management',  bg: 'rgba(61,255,160,0.08)',  border: 'rgba(61,255,160,0.2)',  color: 'var(--success)' },
  };

  const columns = [
    { key: 'name',       label: 'Name',       render: (v, row) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'linear-gradient(135deg,var(--accent2),var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--display)', fontSize: 11, fontWeight: 700, color: '#0a0c0f' }}>
          {(v||'?').slice(0,2).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{v}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{row.department || '—'}</div>
        </div>
      </div>
    )},
    { key: 'email',      label: 'Email',      render: v => <span style={{ fontSize: 11, color: 'var(--muted)' }}>{v}</span> },
    { key: 'role',       label: 'Role',       render: v => <span className={`badge ${ROLE_COLORS[v]?.badge || 'badge-closed'}`}>{v}</span> },
    { key: 'phone',      label: 'Phone',      render: v => <span style={{ fontSize: 11, color: 'var(--muted)' }}>{v || '—'}</span> },
    { key: 'lastLogin',  label: 'Last Login', render: v => <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(v)}</span> },
    { key: 'active',     label: 'Status',     render: v => <Badge variant={v !== false ? 'active' : 'inactive'}>{v !== false ? 'Active' : 'Inactive'}</Badge> },
    { key: 'userId',     label: 'Actions',    sortable: false, render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); openEdit(row); }}>Edit</button>
        <button
          className={`btn btn-sm ${row.active !== false ? 'btn-danger' : 'btn-primary'}`}
          onClick={e => { e.stopPropagation(); setConfirmToggle(row); }}
        >
          {row.active !== false ? 'Disable' : 'Enable'}
        </button>
      </div>
    )},
  ];

  return (
    <>
      <Topbar
        title="Users"
        subtitle="Team management & access control"
        actions={<button className="btn btn-solid btn-sm" onClick={openNew}><Plus size={13} /> Add User</button>}
      />
      <PageContent>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 22 }}>
          <StatTile label="Total"      value={counts.total}      color="t-cyan"   />
          <StatTile label="Active"     value={counts.active}     color="t-green"  />
          <StatTile label="Admin"      value={counts.admin}      color="t-pink"   />
          <StatTile label="Sales"      value={counts.sales}      color="t-cyan"   />
          <StatTile label="Operations" value={counts.operations} color="t-purple" />
          <StatTile label="Management" value={counts.management} color="t-green"  />
        </div>

        {/* Role permission cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
          {ROLES.map(r => {
            const c = ROLE_COLORS[r];
            const cnt = counts[r] || 0;
            return (
              <div key={r} style={{ background: 'var(--surface)', border: `1px solid ${c.border}`, borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize', color: c.color }}>{r}</span>
                  <span style={{ fontFamily: 'var(--display)', fontSize: 20, fontWeight: 800, color: c.color }}>{cnt}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>{ROLE_DESC[r]}</div>
              </div>
            );
          })}
        </div>

        {/* Table */}
        <div className="card">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input className="field-input" style={{ paddingLeft: 34 }} placeholder="Name, email, department…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="field-input" style={{ width: 140, appearance: 'none', cursor: 'pointer' }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="">All Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12} /></button>
          </div>
          <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No users found" />
        </div>

      </PageContent>

      {/* Add / Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={form.userId ? 'Edit User' : 'Add New User'} size="md">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
          <Field label="Full Name *"><Input placeholder="Muhammad Ali" value={form.name} onChange={set('name')} /></Field>
          <Field label="Email *"><Input type="email" placeholder="user@famsops.local" value={form.email} onChange={set('email')} /></Field>
          <Field label="Role *">
            <Select value={form.role} onChange={set('role')}>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </Select>
          </Field>
          <Field label="Department">
            <Select value={form.department} onChange={set('department')}>
              <option value="">Select…</option>
              {DEPTS.map(d => <option key={d}>{d}</option>)}
            </Select>
          </Field>
          <Field label="Phone"><Input placeholder="+92 3XX XXXXXXX" value={form.phone} onChange={set('phone')} /></Field>
          <div /> {/* spacer */}
          <Field label={form.userId ? 'New Password (leave blank to keep)' : 'Password *'}>
            <Input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
          </Field>
          <Field label="Confirm Password">
            <Input type="password" value={form.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" />
          </Field>
        </div>

        {/* Role info */}
        {form.role && (
          <div style={{ padding: '10px 14px', background: `${ROLE_COLORS[form.role]?.bg}`, border: `1px solid ${ROLE_COLORS[form.role]?.border}`, borderRadius: 8, fontSize: 11, color: ROLE_COLORS[form.role]?.color, marginTop: 4 }}>
            <strong>Access: </strong>{ROLE_DESC[form.role]}
          </div>
        )}

        {formErr && <div style={{ padding: '10px 14px', background: 'rgba(255,95,109,0.08)', border: '1px solid rgba(255,95,109,0.3)', borderRadius: 8, color: 'var(--danger)', fontSize: 11, marginTop: 12, marginBottom: 0 }}>⚠ {formErr}</div>}
        <ModalButtons>
          <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
          <button className="btn btn-solid" disabled={saving} onClick={save}>{saving ? 'Saving…' : (form.userId ? 'Save Changes' : 'Create User')}</button>
        </ModalButtons>
      </Modal>

      {/* Confirm toggle modal */}
      <Modal open={!!confirmToggle} onClose={() => setConfirmToggle(null)} title="Confirm Action" size="sm">
        <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
          Are you sure you want to <strong style={{ color: confirmToggle?.active !== false ? 'var(--danger)' : 'var(--success)' }}>
            {confirmToggle?.active !== false ? 'disable' : 'enable'}
          </strong> user <strong>{confirmToggle?.name}</strong>?
          {confirmToggle?.active !== false && ' They will no longer be able to log in.'}
        </p>
        <ModalButtons>
          <button className="btn btn-ghost" onClick={() => setConfirmToggle(null)}>Cancel</button>
          <button
            className={`btn ${confirmToggle?.active !== false ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => toggleUser(confirmToggle)}
          >
            {confirmToggle?.active !== false ? 'Yes, Disable' : 'Yes, Enable'}
          </button>
        </ModalButtons>
      </Modal>
    </>
  );
}
