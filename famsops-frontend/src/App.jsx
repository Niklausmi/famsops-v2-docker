import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppStore } from './store';
import { Layout } from './components/ui/Layout';

import Login         from './pages/Login';
import Dashboard     from './pages/Dashboard';
import Customers     from './pages/Customers';
import Tickets       from './pages/Tickets';
import JobOrders     from './pages/JobOrders';
import Assets        from './pages/Assets';
import Leads         from './pages/Leads';
import Inventory     from './pages/Inventory';
import Payments      from './pages/Payments';
import Users         from './pages/Users';
import Technicians   from './pages/Technicians';
import Quotations    from './pages/Quotations';
import Subscriptions from './pages/Subscriptions';
import Invoices      from './pages/Invoices';
import Tasks         from './pages/Tasks';
import Permissions   from './pages/Permissions';

function NotFound() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:12 }}>
      <div style={{ fontSize:48, opacity:.2 }}>⬡</div>
      <div style={{ fontFamily:'Syne', fontSize:22, fontWeight:800, color:'var(--text)' }}>404</div>
      <div style={{ fontSize:12, color:'var(--muted)' }}>Page not found</div>
      <a href="/dashboard" className="btn btn-primary" style={{ marginTop:8 }}>← Dashboard</a>
    </div>
  );
}

export default function App() {
  const { initTheme } = useAppStore();
  useEffect(() => { initTheme(); }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/"               element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"      element={<Dashboard />} />
          <Route path="/customers"      element={<Customers />} />
          <Route path="/leads"          element={<Leads />} />
          <Route path="/quotations"     element={<Quotations />} />
          <Route path="/tickets"        element={<Tickets />} />
          <Route path="/job-orders"     element={<JobOrders />} />
          <Route path="/assets"         element={<Assets />} />
          <Route path="/inventory"      element={<Inventory />} />
          <Route path="/subscriptions"  element={<Subscriptions />} />
          <Route path="/invoices"       element={<Invoices />} />
          <Route path="/payments"       element={<Payments />} />
          <Route path="/tasks"          element={<Tasks />} />
          <Route path="/technicians"    element={<Technicians />} />
          <Route path="/users"          element={<Users />} />
          <Route path="/permissions"    element={<Permissions />} />
          <Route path="*"               element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
