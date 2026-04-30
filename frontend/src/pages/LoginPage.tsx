import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { useAppStore } from '../store/useAppStore';
import { ForgotPasswordModal } from '../components/Auth/ForgotPasswordModal';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth  = useAppStore(s => s.setAuth);
  const theme    = useAppStore(s => s.theme);
  const setTheme = useAppStore(s => s.setTheme);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      const { user, token } = res.data.data!;
      setAuth(user, token);
      navigate('/kanban');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'E-mail ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', position: 'relative',
    }}>

      {/* Theme toggle — top right corner */}
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 14px', borderRadius: 20,
            background: 'var(--bg2)', border: '1px solid var(--border)',
            color: 'var(--text2)', fontSize: 13, cursor: 'pointer',
            transition: 'all .15s', boxShadow: 'var(--shadow)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text2)'; }}
          title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        >
          <span style={{ fontSize: 15 }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
        </button>
      </div>

      <div style={{
        width: 400, padding: 40,
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16,
        boxShadow: 'var(--shadow)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40, fontSize: 18,
            background: 'var(--accent)', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, color: '#fff',
          }}>AF</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>AgileFlow</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Gestão ágil de projetos</div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text1)', marginBottom: 4 }}>
            Bem-vindo de volta 👋
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            Entre com suas credenciais para acessar
          </div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label className="input-label">E-mail</label>
            <input
              required
              type="email"
              placeholder="ana@empresa.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%' }}
              autoFocus
            />
          </div>

          <div className="input-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="input-label" style={{ marginBottom: 0 }}>Senha</label>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: 'var(--accent)', padding: 0,
                  textDecoration: 'underline', textUnderlineOffset: 2,
                }}
              >
                Esqueceu sua senha?
              </button>
            </div>
            <input
              required
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          {error && (
            <div style={{
              background: '#ef444420', border: '1px solid #ef4444',
              borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#f87171',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            disabled={loading}
          >
            {loading
              ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              : 'Entrar'}
          </button>
        </form>

        <div style={{
          marginTop: 24, padding: '14px 16px',
          background: 'var(--bg3)', borderRadius: 10,
          fontSize: 12, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6,
        }}>
          Não tem conta? Entre em contato com um<br />
          <strong style={{ color: 'var(--text2)' }}>administrador</strong> para criar seu acesso.
        </div>
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
}
