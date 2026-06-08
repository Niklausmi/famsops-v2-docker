import { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, Search, CheckSquare } from 'lucide-react';
import { Topbar }     from '../components/ui/Topbar';
import { PageContent } from '../components/ui/Layout';
import { StatTile }   from '../components/ui/StatTile';
import { DataTable }  from '../components/ui/DataTable';
import { Modal, ModalButtons } from '../components/ui/Modal';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { api } from '../api/client';
import { usePermission } from '../hooks/usePermission';
import { formatDate } from '../lib/utils';

const PRIORITY_COLOR = { Low:'var(--muted)', Medium:'var(--accent)', High:'var(--warn)', Critical:'var(--danger)' };
const STATUS_COLOR   = { Open:'var(--accent)', 'In Progress':'var(--warn)', Done:'var(--success)', Cancelled:'var(--muted)' };
const ENTITY_ICON    = { lead:'🎯', ticket:'🎫', quotation:'📄', subscription:'🔁', customer:'👤', job:'🔧' };

const BLANK = { title:'', description:'', priority:'Medium', assignedTo:'', assignedName:'', dueDate:'', entityType:'', entityId:'' };

export default function Tasks() {
  const canCreate = usePermission('tasks','create');
  const canUpdate = usePermission('tasks','update');

  const [tasks,setTasks]     = useState([]);
  const [users,setUsers]     = useState([]);
  const [loading,setLoading] = useState(false);
  const [search,setSearch]   = useState('');
  const [statFilter,setStatFilter] = useState('Open');
  const [showNew,setShowNew] = useState(false);
  const [form,setForm]       = useState(BLANK);
  const [saving,setSaving]   = useState(false);
  const [formErr,setFormErr] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [td, ud] = await Promise.all([api.tasks.list({status: statFilter||undefined}), api.users.list()]);
      setTasks(td.data.data||td.data||[]);
      setUsers(ud.data.data||ud.data||[]);
    } catch { setTasks([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statFilter]);

  const filtered = useMemo(() => {
    if (!search) return tasks;
    const q = search.toLowerCase();
    return tasks.filter(t=>[t.title,t.assignedName,t.entityId].some(v=>(v||'').toLowerCase().includes(q)));
  }, [tasks, search]);

  const counts = useMemo(() => ({
    open:     tasks.filter(t=>t.status==='Open').length,
    inprog:   tasks.filter(t=>t.status==='In Progress').length,
    overdue:  tasks.filter(t=>t.dueDate&&new Date(t.dueDate)<new Date()&&!['Done','Cancelled'].includes(t.status)).length,
    done:     tasks.filter(t=>t.status==='Done').length,
  }), [tasks]);

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const save = async () => {
    if (!form.title) { setFormErr('Title required'); return; }
    setSaving(true); setFormErr('');
    try { await api.tasks.create(form); setShowNew(false); load(); }
    catch(e) { setFormErr(e.response?.data?.message||'Save failed'); }
    finally { setSaving(false); }
  };

  const markDone = async id => {
    try { await api.tasks.update(id,{status:'Done'}); load(); }
    catch(e) { alert(e.response?.data?.message||'Failed'); }
  };

  const columns = [
    {key:'dueDate',      label:'Due',      render:v=>{
      if (!v) return <span style={{color:'var(--muted)',fontSize:11}}>—</span>;
      const over = new Date(v)<new Date();
      return <span style={{fontSize:11,color:over?'var(--danger)':'var(--muted)',fontWeight:over?600:400}}>{formatDate(v)}</span>;
    }},
    {key:'priority',     label:'Priority', render:v=><span style={{fontSize:10,fontWeight:700,color:PRIORITY_COLOR[v]||'var(--muted)',textTransform:'uppercase',letterSpacing:.8}}>{v}</span>},
    {key:'title',        label:'Task',     render:(v,row)=>(
      <div>
        <div style={{fontSize:12,color:'var(--text)',fontWeight:500}}>{v}</div>
        {row.entityType&&<div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{ENTITY_ICON[row.entityType]||'📌'} {row.entityType} · {row.entityId}</div>}
      </div>
    )},
    {key:'assignedName', label:'Assigned', render:v=><span style={{fontSize:11,color:'var(--muted)'}}>{v||'—'}</span>},
    {key:'status',       label:'Status',   render:v=><span style={{fontSize:10,fontWeight:600,color:STATUS_COLOR[v]||'var(--muted)',textTransform:'uppercase',letterSpacing:.8}}>{v}</span>},
    {key:'taskId',       label:'',         sortable:false, render:(_,row)=>(
      <div style={{display:'flex',gap:5}}>
        {canUpdate && row.status!=='Done' && (
          <button className="btn btn-ghost btn-sm" style={{color:'var(--success)'}} onClick={e=>{e.stopPropagation();markDone(row.taskId);}}>✓ Done</button>
        )}
      </div>
    )},
  ];

  return (
    <>
      <Topbar title="Tasks" subtitle="Follow-ups, reminders and action items"
        actions={canCreate && <button className="btn btn-solid btn-sm" onClick={()=>{setForm(BLANK);setFormErr('');setShowNew(true);}}><Plus size={13}/> New Task</button>}/>
      <PageContent>

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:22}}>
          <StatTile label="Open"       value={counts.open}   color="t-cyan"/>
          <StatTile label="In Progress" value={counts.inprog} color="t-purple"/>
          <StatTile label="Overdue"    value={counts.overdue} color="t-pink"/>
          <StatTile label="Done Today" value={counts.done}   color="t-green"/>
        </div>

        <div className="card">
          <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:200,position:'relative'}}>
              <Search size={13} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--muted)'}}/>
              <input className="field-input" style={{paddingLeft:34}} placeholder="Task title, assignee, entity ID…"
                value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <div style={{display:'flex',gap:6}}>
              {['Open','In Progress','Done',''].map(s=>(
                <button key={s||'all'} className={`btn btn-sm ${statFilter===s?'btn-primary':'btn-ghost'}`}
                  onClick={()=>setStatFilter(s)}>{s||'All'}</button>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12}/></button>
          </div>
          <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No tasks found"/>
        </div>
      </PageContent>

      <Modal open={showNew} onClose={()=>setShowNew(false)} title="New Task" size="sm">
        <Field label="Title *"><Input value={form.title} onChange={set('title')} placeholder="e.g. Follow up with Ahmed — renewal"/></Field>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 18px'}}>
          <Field label="Priority">
            <Select value={form.priority} onChange={set('priority')}>{['Low','Medium','High','Critical'].map(p=><option key={p}>{p}</option>)}</Select>
          </Field>
          <Field label="Due Date"><Input type="date" value={form.dueDate} onChange={set('dueDate')}/></Field>
          <Field label="Assigned To">
            <Select value={form.assignedTo} onChange={e=>{const u=users.find(x=>x.userId===e.target.value);setForm(f=>({...f,assignedTo:e.target.value,assignedName:u?.name||''}));}}>
              <option value="">Unassigned</option>
              {users.filter(u=>u.active!==false).map(u=><option key={u.userId} value={u.userId}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Related To">
            <Select value={form.entityType} onChange={set('entityType')}>
              <option value="">None</option>
              {['lead','ticket','quotation','subscription','customer','job'].map(e=><option key={e}>{e}</option>)}
            </Select>
          </Field>
          {form.entityType && <Field label="Entity ID"><Input value={form.entityId} onChange={set('entityId')} placeholder={`${form.entityType.toUpperCase()}-ID`}/></Field>}
        </div>
        <Field label="Description"><Textarea value={form.description} onChange={set('description')} style={{minHeight:60}}/></Field>
        {formErr&&<div style={{padding:'10px 14px',background:'rgba(255,95,109,.08)',border:'1px solid rgba(255,95,109,.3)',borderRadius:8,color:'var(--danger)',fontSize:11,marginBottom:8}}>⚠ {formErr}</div>}
        <ModalButtons>
          <button className="btn btn-ghost" onClick={()=>setShowNew(false)}>Cancel</button>
          <button className="btn btn-solid" disabled={saving} onClick={save}>{saving?'Saving…':'Create Task'}</button>
        </ModalButtons>
      </Modal>
    </>
  );
}
