import { useState, useEffect } from 'react';
import { Topbar }     from '../components/ui/Topbar';
import { PageContent } from '../components/ui/Layout';
import { api } from '../api/client';
import { usePermission } from '../hooks/usePermission';

const ROLE_COLORS = {
  admin:'#ff7eb3', sales:'#38d9f5', operations:'#7b6fff',
  accounts:'#3dffa0', support:'#ffb347', management:'#ff5f6d', technician:'#38d9f5',
};

export default function Permissions() {
  const canUpdate = usePermission('users','update');
  const [data,setData]     = useState(null);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState({});
  const [module,setModule] = useState('all');

  const load = async () => {
    setLoading(true);
    try { const {data} = await api.auth.permissions(); setData(data); }
    catch { setData(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (roleId, permId, currentlyGranted) => {
    const key = `${roleId}-${permId}`;
    setSaving(s=>({...s,[key]:true}));
    try {
      await api.auth.rolePermission({ roleId, permissionId: permId, grant: !currentlyGranted });
      // Optimistic update
      setData(d => {
        const roles = d.roles.map(r => {
          if (r.id !== roleId) return r;
          const perms = currentlyGranted
            ? r.permissions.filter(p => p.id !== permId)
            : [...r.permissions, d.allPermissions.find(p => p.id === permId)];
          return { ...r, permissions: perms };
        });
        return { ...d, roles };
      });
    } catch(e) { alert(e.response?.data?.message||'Failed'); }
    finally { setSaving(s=>({...s,[key]:false})); }
  };

  if (loading) return (
    <>
      <Topbar title="Permissions" subtitle="Role & permission management"/>
      <PageContent><div style={{color:'var(--muted)',fontSize:12,padding:'40px 0',textAlign:'center'}}>Loading permission matrix…</div></PageContent>
    </>
  );

  if (!data) return (
    <>
      <Topbar title="Permissions" subtitle="Role & permission management"/>
      <PageContent><div style={{color:'var(--danger)',fontSize:12}}>Failed to load permissions. Admin access required.</div></PageContent>
    </>
  );

  const { roles, allPermissions } = data;

  // Group permissions by module
  const modules = [...new Set(allPermissions.map(p => p.module))].sort();
  const filteredModules = module === 'all' ? modules : [module];

  // Check if a role has a permission
  const has = (role, permId) => role.permissions?.some(p => p.id === permId) || false;

  const CheckBox = ({ roleId, perm, granted, roleName }) => {
    const key = `${roleId}-${perm.id}`;
    const isLoading = saving[key];
    const isAdmin = roleName === 'admin';
    return (
      <td key={perm.id} style={{ textAlign:'center', padding:'6px 4px', borderBottom:'1px solid var(--border)', borderRight:'1px solid var(--border)' }}>
        <button
          disabled={!canUpdate || isAdmin || isLoading}
          onClick={() => toggle(roleId, perm.id, granted)}
          title={isAdmin ? 'Admin always has all permissions' : (granted ? `Revoke from ${roleName}` : `Grant to ${roleName}`)}
          style={{
            width: 22, height: 22, borderRadius: 5,
            border: `1px solid ${granted ? 'rgba(61,255,160,.4)' : 'var(--border)'}`,
            background: granted ? 'rgba(61,255,160,.15)' : 'var(--surface2)',
            cursor: (!canUpdate||isAdmin) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: isAdmin ? 0.4 : 1,
            transition: 'all .15s', margin: '0 auto',
            fontSize: 12,
          }}
        >
          {isLoading ? '…' : isAdmin ? '✓' : granted ? '✓' : ''}
        </button>
      </td>
    );
  };

  return (
    <>
      <Topbar title="Permissions" subtitle="Role-based access control matrix"/>
      <PageContent>

        {/* Role summary cards */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:10,marginBottom:22}}>
          {roles.map(r=>(
            <div key={r.id} style={{background:'var(--surface)',border:`1px solid ${ROLE_COLORS[r.name]||'var(--border)'}33`,borderRadius:10,padding:'12px 14px'}}>
              <div style={{width:10,height:10,borderRadius:'50%',background:ROLE_COLORS[r.name]||'var(--accent)',marginBottom:8}}/>
              <div style={{fontFamily:'Syne',fontSize:12,fontWeight:700,color:ROLE_COLORS[r.name]||'var(--text)',textTransform:'capitalize'}}>{r.name}</div>
              <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{r.permissions?.length||0} permissions</div>
            </div>
          ))}
        </div>

        {/* Module filter */}
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
          <button className={`btn btn-sm ${module==='all'?'btn-primary':'btn-ghost'}`} onClick={()=>setModule('all')}>All Modules</button>
          {modules.map(m=>(
            <button key={m} className={`btn btn-sm ${module===m?'btn-primary':'btn-ghost'}`} onClick={()=>setModule(m)} style={{textTransform:'capitalize'}}>
              {m.replace('_',' ')}
            </button>
          ))}
        </div>

        {!canUpdate && (
          <div style={{padding:'10px 14px',background:'rgba(255,179,71,.08)',border:'1px solid rgba(255,179,71,.25)',borderRadius:8,color:'var(--warn)',fontSize:11,marginBottom:16}}>
            👀 View only — you need "users.update" permission to modify permissions
          </div>
        )}

        {/* Matrix table */}
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{minWidth:'100%'}}>
              <thead>
                <tr>
                  <th style={{minWidth:180,textAlign:'left',padding:'12px 16px',borderBottom:'1px solid var(--border)',borderRight:'1px solid var(--border)',background:'var(--surface2)',position:'sticky',left:0,zIndex:2}}>
                    Permission
                  </th>
                  {roles.map(r=>(
                    <th key={r.id} style={{minWidth:90,textAlign:'center',padding:'12px 8px',borderBottom:'1px solid var(--border)',borderRight:'1px solid var(--border)',background:'var(--surface2)'}}>
                      <div style={{fontSize:10,fontWeight:700,color:ROLE_COLORS[r.name]||'var(--muted)',textTransform:'capitalize',letterSpacing:.5}}>{r.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredModules.map(mod => {
                  const modPerms = allPermissions.filter(p => p.module === mod);
                  return modPerms.map((perm, i) => (
                    <tr key={perm.id} style={{background: i%2===0?'transparent':'rgba(255,255,255,.01)'}}>
                      {i === 0 ? (
                        <td rowSpan={modPerms.length} style={{
                          padding:'0 16px',textAlign:'left',
                          borderBottom:'1px solid var(--border)',
                          borderRight:'1px solid var(--border)',
                          background:'var(--surface)',
                          position:'sticky',left:0,zIndex:1,
                          verticalAlign:'top',
                        }}>
                          <div style={{padding:'10px 0 4px',fontSize:9,letterSpacing:2,textTransform:'uppercase',color:'var(--accent)',fontWeight:700}}>{mod.replace('_',' ')}</div>
                          {modPerms.map((p,pi)=>(
                            <div key={p.id} style={{padding:'7px 0',fontSize:11,color:'var(--muted)',borderBottom:pi<modPerms.length-1?'1px solid var(--border)':undefined}}>
                              {p.action}
                            </div>
                          ))}
                        </td>
                      ) : null}
                      {i > 0 && (
                        <td style={{padding:'0 16px',textAlign:'left',borderBottom:'1px solid var(--border)',borderRight:'1px solid var(--border)',background:'var(--surface)',position:'sticky',left:0,zIndex:1}}>
                          <div style={{padding:'7px 0',fontSize:11,color:'var(--muted)'}}>{perm.action}</div>
                        </td>
                      )}
                      {roles.map(role => (
                        <CheckBox key={role.id} roleId={role.id} perm={perm} granted={has(role,perm.id)} roleName={role.name}/>
                      ))}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{marginTop:12,fontSize:10,color:'var(--muted)',textAlign:'center'}}>
          Changes take effect immediately for new logins. Existing sessions are not affected until the user re-authenticates.
        </div>
      </PageContent>
    </>
  );
}
