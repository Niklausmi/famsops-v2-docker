import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Target, ClipboardList, Package, Users, Ticket, Car, TrendingUp, AlertTriangle, Clock, CheckCircle, Bell } from 'lucide-react';
import { Topbar } from '../components/ui/Topbar';
import { PageContent } from '../components/ui/Layout';
import { StatTile } from '../components/ui/StatTile';
import { Badge } from '../components/ui/Badge';
import { api } from '../api/client';
import { useAppStore } from '../store';
import { formatDate, timeAgo } from '../lib/utils';

const LEAD_STATUSES = [
  {s:'New Lead',color:'var(--accent)'},{s:'Contacted',color:'var(--accent2)'},
  {s:'Interested',color:'var(--warn)'},{s:'Negotiation',color:'var(--accent3)'},
  {s:'Won',color:'var(--success)'},{s:'Lost',color:'var(--muted)'},
];

const QUICK_ACTIONS = [
  {icon:Users,        label:'New Customer',  sub:'Start here every time',   to:'/customers?new=1',   roles:['admin','sales','operations','management']},
  {icon:Target,       label:'New Lead',      sub:'Log a sales opportunity',  to:'/leads?new=1',       roles:['admin','sales','management']},
  {icon:ClipboardList,label:'New Job Order', sub:'Schedule installation',    to:'/job-orders?new=1',  roles:['admin','operations']},
  {icon:Package,      label:'Stock In',      sub:'Add trackers or SIMs',     to:'/inventory?new=1',   roles:['admin','operations']},
  {icon:Ticket,       label:'New Ticket',    sub:'Query or complaint',       to:'/tickets?new=1',     roles:['admin','sales','operations']},
  {icon:Car,          label:'View Assets',   sub:'Fleet registry',           to:'/assets',            roles:['admin','sales','operations','management']},
];

const URGENCY_STYLE = {
  overdue:  {bg:'rgba(255,95,109,.1)',  border:'rgba(255,95,109,.2)',  color:'var(--danger)', label:'OVERDUE'},
  today:    {bg:'rgba(255,179,71,.1)',  border:'rgba(255,179,71,.2)',  color:'var(--warn)',   label:'TODAY'},
  upcoming: {bg:'rgba(56,217,245,.05)', border:'rgba(56,217,245,.15)', color:'var(--accent)', label:'UPCOMING'},
};
const ENTITY_ICON = {ticket:'🎫', lead:'🎯', job:'🔧'};
const ENTITY_PATH = {ticket:'/tickets', lead:'/leads', job:'/job-orders'};

export default function Dashboard() {
  const {user} = useAppStore();
  const navigate = useNavigate();
  const [stats,setStats]   = useState(null);
  const [tasks,setTasks]   = useState(null);
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    Promise.all([
      api.dashboard.stats().then(r=>setStats(r.data)).catch(()=>{}),
      api.dashboard.tasks({daysAhead:7}).then(r=>setTasks(r.data)).catch(()=>{}),
    ]).finally(()=>setLoading(false));
  },[]);

  const date = new Date().toLocaleDateString('en-PK',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const { can } = useAppStore();
  const actions = QUICK_ACTIONS.filter(a=>a.roles.includes(user?.role));
  const taskTotal = tasks ? tasks.overdue.length + tasks.today.length + tasks.upcoming.length : 0;

  return (
    <>
      <Topbar title="Dashboard" subtitle={`${user?.name||''} · ${date}`}/>
      <PageContent>

        {/* Alert bar — shows if there are urgent items */}
        {stats?.alerts && (stats.alerts.openTickets > 0 || stats.alerts.amcExpiring > 0 || stats.alerts.overduePayments > 0) && (
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:18}}>
            {stats.alerts.amcExpiring > 0 && (
              <div onClick={()=>navigate('/assets?amcExpiring=true')} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:'rgba(255,179,71,.1)',border:'1px solid rgba(255,179,71,.3)',borderRadius:8,cursor:'pointer',transition:'all .15s'}}
                onMouseOver={e=>e.currentTarget.style.background='rgba(255,179,71,.18)'}
                onMouseOut={e=>e.currentTarget.style.background='rgba(255,179,71,.1)'}>
                <AlertTriangle size={13} style={{color:'var(--warn)'}}/>
                <span style={{fontSize:11,color:'var(--warn)',fontWeight:600}}>{stats.alerts.amcExpiring} AMC{stats.alerts.amcExpiring!==1?'s':''} expiring in 30 days</span>
              </div>
            )}
            {stats.alerts.overduePayments > 0 && (
              <div onClick={()=>navigate('/payments?status=Overdue')} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:'rgba(255,95,109,.1)',border:'1px solid rgba(255,95,109,.25)',borderRadius:8,cursor:'pointer',transition:'all .15s'}}
                onMouseOver={e=>e.currentTarget.style.background='rgba(255,95,109,.18)'}
                onMouseOut={e=>e.currentTarget.style.background='rgba(255,95,109,.1)'}>
                <AlertTriangle size={13} style={{color:'var(--danger)'}}/>
                <span style={{fontSize:11,color:'var(--danger)',fontWeight:600}}>PKR {Number(stats.alerts.overdueAmount||0).toLocaleString()} overdue</span>
              </div>
            )}
            {stats.alerts.openTickets > 0 && (
              <div onClick={()=>navigate('/tickets?status=Open')} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:'rgba(123,111,255,.1)',border:'1px solid rgba(123,111,255,.25)',borderRadius:8,cursor:'pointer',transition:'all .15s'}}
                onMouseOver={e=>e.currentTarget.style.background='rgba(123,111,255,.18)'}
                onMouseOut={e=>e.currentTarget.style.background='rgba(123,111,255,.1)'}>
                <Bell size={13} style={{color:'var(--accent2)'}}/>
                <span style={{fontSize:11,color:'var(--accent2)',fontWeight:600}}>{stats.alerts.openTickets} open ticket{stats.alerts.openTickets!==1?'s':''}</span>
              </div>
            )}
          </div>
        )}

        {/* Main KPI tiles */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
          <StatTile label="Total Leads"        value={loading?'…':stats?.leads?.total}          sub="All time" color="t-cyan"/>
          <StatTile label="Job Orders"         value={loading?'…':stats?.jobs?.total}           sub="All time" color="t-purple"/>
          <StatTile label="Trackers Available" value={loading?'…':stats?.trackers?.available}   sub={`${stats?.trackers?.faulty||0} faulty`} color="t-green"/>
          <StatTile label="SIMs Available"     value={loading?'…':stats?.sims?.available}       sub="In stock" color="t-warn"/>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20}}>

          {/* Quick Actions */}
          <div className="card">
            <div className="section-head">
              <div className="section-icon si-cyan"><TrendingUp size={15}/></div>
              <div>
                <h2 style={{fontFamily:'Syne',fontSize:16,fontWeight:700}}>Quick Actions</h2>
                <p style={{fontSize:11,color:'var(--muted)',marginTop:1}}>Start from Customers — always</p>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {actions.slice(0,6).map(a=>(
                <Link key={a.to} to={a.to}
                  style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:14,textDecoration:'none',display:'block',transition:'all .2s'}}
                  onMouseOver={e=>{e.currentTarget.style.borderColor='var(--border-hi)';e.currentTarget.style.transform='translateY(-2px)';}}
                  onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform='none';}}>
                  <a.icon size={18} style={{color:a.label==='New Customer'?'var(--success)':'var(--accent)',marginBottom:8}}/>
                  <div style={{fontSize:11,color:'var(--text)',fontWeight:600}}>{a.label}</div>
                  <div style={{fontSize:10,color:'var(--muted)',marginTop:3}}>{a.sub}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* Follow-up Tasks */}
          <div className="card">
            <div className="section-head">
              <div className="section-icon si-warn"><Clock size={15}/></div>
              <div>
                <h2 style={{fontFamily:'Syne',fontSize:16,fontWeight:700}}>Follow-up Tasks</h2>
                <p style={{fontSize:11,color:'var(--muted)',marginTop:1}}>
                  {taskTotal>0?`${taskTotal} item${taskTotal!==1?'s':''} due in next 7 days`:'All clear — nothing due'}
                </p>
              </div>
            </div>
            {loading ? <div style={{color:'var(--muted)',fontSize:12}}>Loading…</div>
            : taskTotal===0 ? (
              <div style={{textAlign:'center',padding:'20px 0'}}>
                <CheckCircle size={24} style={{color:'var(--success)',opacity:.5,margin:'0 auto 8px',display:'block'}}/>
                <p style={{fontSize:12,color:'var(--muted)'}}>No follow-ups due</p>
              </div>
            ) : (
              <div style={{maxHeight:280,overflowY:'auto'}}>
                {['overdue','today','upcoming'].flatMap(urgency=>(tasks[urgency]||[]).slice(0,urgency==='upcoming'?3:99).map(t=>{
                  const s = URGENCY_STYLE[urgency];
                  return (
                    <div key={`${t.entity_type}-${t.entity_id}`}
                      onClick={()=>navigate(`${ENTITY_PATH[t.entity_type]}?highlight=${t.entity_id}`)}
                      style={{display:'flex',alignItems:'flex-start',gap:10,padding:'9px 10px',marginBottom:6,background:s.bg,border:`1px solid ${s.border}`,borderRadius:8,cursor:'pointer',transition:'opacity .15s'}}
                      onMouseOver={e=>e.currentTarget.style.opacity='.8'}
                      onMouseOut={e=>e.currentTarget.style.opacity='1'}>
                      <span style={{fontSize:14,flexShrink:0,marginTop:1}}>{ENTITY_ICON[t.entity_type]}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,color:'var(--text)',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</div>
                        <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{t.customer_name} · {t.assigned_to||'Unassigned'}</div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontSize:9,fontWeight:700,color:s.color,letterSpacing:1}}>{s.label}</div>
                        <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{formatDate(t.followup_date)}</div>
                      </div>
                    </div>
                  );
                }))}
              </div>
            )}
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>

          {/* Lead funnel */}
          <div className="card">
            <div className="section-head">
              <div className="section-icon si-purple"><Target size={15}/></div>
              <div><h2 style={{fontFamily:'Syne',fontSize:16,fontWeight:700}}>Lead Funnel</h2></div>
            </div>
            {loading?<div style={{color:'var(--muted)',fontSize:12}}>Loading…</div>
            :stats?.leads?.byStatus?(
              LEAD_STATUSES.map(({s,color})=>{
                const cnt = stats.leads.byStatus[s]||0;
                const pct = stats.leads.total?Math.round(cnt/stats.leads.total*100):0;
                return (
                  <div key={s} style={{marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontSize:11,color:'var(--muted)'}}>{s}</span>
                      <span style={{fontSize:11,color,fontWeight:600}}>{cnt}</span>
                    </div>
                    <div style={{height:5,background:'var(--surface2)',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:3,transition:'width .8s ease'}}/>
                    </div>
                  </div>
                );
              })
            ):<div className="empty-state"><div className="ei">📊</div><p>No lead data</p></div>}
          </div>

          {/* Recent Jobs */}
          <div className="card">
            <div className="section-head">
              <div className="section-icon si-purple"><ClipboardList size={15}/></div>
              <div><h2 style={{fontFamily:'Syne',fontSize:16,fontWeight:700}}>Recent Job Orders</h2></div>
            </div>
            {(stats?.jobs?.recent||[]).map((j,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:i<5?'1px solid var(--border)':'none'}}>
                <div>
                  <div style={{fontSize:12,color:'var(--text)',fontWeight:500}}>{j.customer||'—'}</div>
                  <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{j.vehicle||j.registrationNo} · {j.technicianName||'—'} · {formatDate(j.date)}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <Badge variant={j.status?.toLowerCase().replace(/ /g,'-')}>{j.status}</Badge>
                  <div style={{fontSize:9,color:'var(--muted)',marginTop:3,textTransform:'uppercase',letterSpacing:.8}}>{j.toc}</div>
                </div>
              </div>
            ))}
            {!stats?.jobs?.recent?.length&&!loading&&<div className="empty-state"><div className="ei">📋</div><p>No recent job orders</p></div>}
          </div>
        </div>

      </PageContent>
    </>
  );
}
