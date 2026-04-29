import { useState } from 'react';
import { authApi } from '../../api';

interface Props {
  onClose: () => void;
}

export function ForgotPasswordModal({ onClose }: Props) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [sent,    setSent]    = useState(false);

  const handleSend = async () => {
    if (!email.trim()) return setError('Informe seu e-mail.');
    setLoading(true);
    setError(null);
    try {
      await (authApi as any).forgotPassword(email.trim());
      setSent(true);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Erro ao enviar e-mail. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 400, padding: 36 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>
              {sent ? '📬 E-mail enviado!' : '🔐 Redefinir senha'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
              {sent
                ? `Verifique a caixa de entrada de ${email}`
                : 'Informe seu e-mail para receber o link de redefinição'}
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text3)', fontSize: 18, lineHeight: 1, marginLeft: 12 }}>✕</button>
        </div>

        {!sent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="input-group">
              <label className="input-label">E-mail cadastrado</label>
              <input
                type="email"
                placeholder="ana@empresa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                style={{ width: '100%' }}
                autoFocus
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
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleSend}
              disabled={loading}
            >
              {loading
                ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Enviando...</>
                : '📧 Enviar link de redefinição'}
            </button>

            <button
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={onClose}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: 'var(--bg3)', borderRadius: 10, padding: 20,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                Enviamos um link de redefinição para <strong style={{ color: 'var(--text)' }}>{email}</strong>.
                <br />O link expira em <strong>1 hora</strong>.
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                💡 Não encontrou? Verifique a pasta de spam ou lixo eletrônico.
              </div>
            </div>

            <button
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
              onClick={() => { setSent(false); setEmail(''); }}
            >
              ← Tentar com outro e-mail
            </button>

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
