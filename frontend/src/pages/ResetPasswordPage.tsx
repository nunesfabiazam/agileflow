import { useState, FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { useAppStore } from '../store/useAppStore';

export function ResetPasswordPage() {
  const [searchParams]    = useSearchParams();
  const navigate          = useNavigate();
  const theme             = useAppStore(s => s.theme);
  const setTheme          = useAppStore(s => s.setTheme);

  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';

  const [newPwd,   setNewPwd]   = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [done,     setDone]     = useState(false);

  const invalid = !token || !email;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 6)    return setError('A senha deve ter pelo menos 6 caracteres.');
    if (newPwd !== confirm)   return setError('As senhas não coincidem.');
    setError('');
    setLoading(true);
    try {
      await (authApi as any).resetPassword(email, token, newPwd);
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Erro ao redefinir senha. Tente solicitar um novo link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', position: 'relative',
    }}>

      {/* Theme toggle */}
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
        >
          <span style={{ fontSize: 15 }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
        </button>
      </div>

      <div style={{
        width: 420, padding: 40,
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 16, boxShadow: 'var(--shadow)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40, background: 'var(--accent)', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 16, color: '#fff',
          }}>AF</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>AgileFlow</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Gestão ágil de projetos</div>
          </div>
        </div>

        {/* Link inválido */}
        {invalid && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Link inválido</div>
            <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 24 }}>
              Este link de redefinição é inválido ou está incompleto.<br />
              Solicite um novo na tela de login.
            </p>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/login')}>
              Ir para o login
            </button>
          </div>
        )}

        {/* Concluído */}
        {!invalid && done && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Senha redefinida!</div>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 24 }}>
              Sua nova senha foi salva com sucesso.<br />Faça login para continuar.
            </p>
            <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/login')}>
              Ir para o login
            </button>
          </div>
        )}

        {/* Formulário */}
        {!invalid && !done && (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Criar nova senha 🔐</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                Redefinindo senha para <strong style={{ color: 'var(--text2)' }}>{email}</strong>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="input-group">
                <label className="input-label">Nova senha</label>
                <input
                  required
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  style={{ width: '100%' }}
                  autoFocus
                />
              </div>

              <div className="input-group">
                <label className="input-label">Confirmar nova senha</label>
                <input
                  required
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Medidor de força */}
              {newPwd.length > 0 && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {[1, 2, 3, 4].map(i => {
                    const strength = newPwd.length >= 12 ? 4 : newPwd.length >= 8 ? 3 : newPwd.length >= 6 ? 2 : 1;
                    const colors   = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];
                    return (
                      <div key={i} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        background: i <= strength ? colors[strength] : 'var(--bg4)',
                        transition: 'background .2s',
                      }} />
                    );
                  })}
                </div>
              )}

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
                  ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Salvando...</>
                  : '🔐 Salvar nova senha'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
