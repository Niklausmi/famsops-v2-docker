import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '../store';
import { api } from '../api/client';

const QUICK_LOGINS = [
  { label: 'Admin',      sub: 'Full access',          email: 'admin@famsops.local',  password: 'admin123',  icon: '⬡' },
  { label: 'Sales',      sub: 'Leads + tickets',      email: 'sales@famsops.local',  password: 'sales123',  icon: '🎯' },
  { label: 'Operations', sub: 'Orders + inventory',   email: 'ops@famsops.local',    password: 'ops123',    icon: '📋' },
  { label: 'Management', sub: 'View + leads',         email: 'mgmt@famsops.local',   password: 'mgmt123',   icon: '📊' },
];

export default function Login() {
  const navigate = useNavigate();
  const { user, setUser, initTheme } = useAppStore();
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [shake, setShake]           = useState(false);

  useEffect(() => {
    initTheme();
    if (user) navigate('/dashboard', { replace: true });
  }, []);

  async function doLogin(e, pEmail, pPass) {
    e?.preventDefault();
    const em = pEmail || email.trim();
    const pw = pPass  || password;
    if (!em || !pw) { setError('Please enter email and password'); return; }
    setLoading(true); setError('');

    try {
      const { data } = await api.auth.login({ email: em, password: pw });
      setUser(data.user, data.token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid email or password';
      setError(msg);
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      fontFamily: 'var(--mono)',
      background: 'var(--bg)',
      color: 'var(--text)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Glows */}
      <div style={{ position: 'fixed', top: -150, left: -150, width: 500, height: 500, background: 'radial-gradient(circle, rgba(123,111,255,0.08), transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: -100, right: -100, width: 400, height: 400, background: 'radial-gradient(circle, rgba(56,217,245,0.07), transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, animation: 'fadeUp 0.5s ease' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, var(--accent2), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--display)', fontSize: 22, fontWeight: 800, color: '#0a0c0f',
            margin: '0 auto 14px',
            boxShadow: '0 0 30px rgba(56,217,245,0.25)',
          }}>
            FO
          </div>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)' }}>
            Fams<span style={{ color: 'var(--accent)' }}>ops</span>
          </h1>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' }}>
            Fleet Operations Suite
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ borderRadius: 16, padding: 32 }}>
          <form onSubmit={doLogin}>
            {/* Email */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 7 }}>
                Email Address
              </label>
              <input
                type="email"
                className="field-input"
                style={{ fontSize: 13, padding: '12px 14px' }}
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 6 }}>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 7 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  className={`field-input ${shake ? 'animate-shake' : ''}`}
                  style={{ fontSize: 13, padding: '12px 44px 12px 14px', paddingRight: 44 }}
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    color: 'var(--muted)', cursor: 'pointer',
                    padding: 4, display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                marginBottom: 12, padding: '10px 14px',
                background: 'rgba(255,95,109,0.1)',
                border: '1px solid rgba(255,95,109,0.3)',
                borderRadius: 8, color: 'var(--danger)', fontSize: 11,
              }}>
                ⚠ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: 13, border: 'none', borderRadius: 9,
                background: 'linear-gradient(135deg, #7b6fff, #38d9f5)',
                color: '#0a0c0f',
                fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700,
                letterSpacing: '1.5px', textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s',
                marginTop: 6,
              }}
            >
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          {/* Quick login */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10, textAlign: 'center' }}>
              Quick Login
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {QUICK_LOGINS.map(q => (
                <button
                  key={q.email}
                  onClick={() => doLogin(null, q.email, q.password)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8, padding: '10px 12px',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s',
                    color: 'var(--text)',
                  }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(56,217,245,0.25)'; e.currentTarget.style.background = 'rgba(56,217,245,0.03)'; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface2)'; }}
                >
                  <div style={{ fontSize: 11, marginBottom: 2 }}>{q.icon} {q.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{q.sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.5px' }}>
          Famsops v2.0 · FAMS-HPL Operations
        </div>
      </div>
    </div>
  );
}
