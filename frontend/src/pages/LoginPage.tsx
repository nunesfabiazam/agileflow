import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { useAppStore } from '../store/useAppStore';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAppStore(s => s.setAuth);
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'DEVELOPER' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = tab === 'login'
        ? await authApi.login(form.email, form.password)
        : await authApi.register({ name: form.name, email: form.email, password: form.password, role: form.role });
      const { user, token } = res.data.data!;
      setAuth(user, token);
      navigate('/kanban');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Erro ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 400, padding: 40, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div className="logo-icon" style={{ width: 40, height: 40, fontSize: 18, background: 'var(--accent)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff' }}>AF</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>AgileFlow</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Gestão ágil de projetos</div>
          </div>
        </div>

        <div className="tabs" style={{ marginBottom: 24 }}>
          <div className={`tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Entrar</div>
          <div className={`tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Criar conta</div>
        </div>

        <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tab === 'register' && (
            <>
              <div className="input-group">
                <label className="input-label">Nome completo</label>
                <input required placeholder="Ana Lima" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div className="input-group">
                <label className="input-label">Função</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ width: '100%' }}>
                  <option value="DEVELOPER">Desenvolvedor(a)</option>
                  <option value="QA">QA</option>
                  <option value="UX">UX Designer</option>
                  <option value="PM">Product Manager</option>
                  <option value="SCRUM_MASTER">Scrum Master</option>
                  <option value="STAKEHOLDER">Stakeholder</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </>
          )}
          <div className="input-group">
            <label className="input-label">E-mail</label>
            <input required type="email" placeholder="ana@empresa.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="input-group">
            <label className="input-label">Senha</label>
            <input required type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={{ width: '100%' }} />
          </div>
          {error && <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#f87171' }}>{error}</div>}
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={loading}>
            {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : tab === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  );
}
