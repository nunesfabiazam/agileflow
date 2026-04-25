import { useState } from 'react';
import { authApi } from '../../api';

interface Props {
  onClose: () => void;
}

export function ForgotPasswordModal({ onClose }: Props) {
  const [step, setStep]       = useState<'phone' | 'token' | 'password' | 'done'>('phone');
  const [phone, setPhone]     = useState('');
  const [token, setToken]     = useState('');
  const [newPwd, setNewPwd]   = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSendCode = async () => {
    if (!phone.trim()) return setError('Informe seu telefone.');
    setLoading(true); setError(null);
    try {
      await (authApi as any).forgotPassword(phone.trim());
      setStep('token');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Erro ao enviar SMS.');
    } finally { setLoading(false); }
  };

  const handleVerifyToken = async () => {
    if (token.length !== 6) return setError('Digite o código de 6 dígitos.');
    setLoading(true); setError(null);
    try {
      await (authApi as any).verifyResetToken(phone.trim(), token);
      setStep('password');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Código inválido.');
    } finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (newPwd.length < 6) return setError('Senha deve ter ao menos 6 caracteres.');
    if (newPwd !== confirm) return setError('Senhas não coincidem.');
    setLoading(true); setError(null);
    try {
      await (authApi as any).resetPassword(phone.trim(), token, newPwd);
      setStep('done');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Erro ao redefinir senha.');
    } finally { setLoading(false); }
  };

  const steps = ['phone', 'token', 'password'] as const;
  const stepIdx = steps.indexOf(step as any);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 380, padding: 32 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>
              {step === 'done' ? '✅ Senha redefinida' : '🔐 Redefinir senha'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
              {step === 'phone'    && 'Informe o telefone cadastrado na conta'}
              {step === 'token'    && `Código enviado para ${phone}`}
              {step === 'password' && 'Crie sua nova senha'}
              {step === 'done'     && 'Sua senha foi alterada com sucesso!'}
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text3)', fontSize: 18 }}>✕</button>
        </div>

        {/* Step indicators */}
        {step !== 'done' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
            {steps.map((s, i) => (
              <div key={s} style={{
                flex: 1, height: 3, borderRadius: 2,
                background: stepIdx >= i ? 'var(--accent)' : 'var(--bg4, var(--border))',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
        )}

        {/* Step: Phone */}
        {step === 'phone' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group">
              <label className="input-label">Telefone (com DDD e código do país)</label>
              <input
                className="input"
                type="tel"
                placeholder="+55 11 99999-9999"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                style={{ width: '100%' }}
                autoFocus
              />
            </div>
            {error && <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#f87171' }}>{error}</div>}
            <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleSendCode} disabled={loading}>
              {loading ? '⏳ Enviando SMS...' : '📱 Enviar código por SMS'}
            </button>
            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
              Cancelar
            </button>
          </div>
        )}

        {/* Step: Token */}
        {step === 'token' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group">
              <label className="input-label">Código de 6 dígitos</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={token}
                onChange={e => setToken(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleVerifyToken()}
                style={{
                  width: '100%', letterSpacing: 10, fontSize: 22, textAlign: 'center',
                  padding: '10px 14px', borderRadius: 8,
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  color: 'var(--text1)',
                }}
                autoFocus
              />
            </div>
            {error && <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#f87171' }}>{error}</div>}
            <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleVerifyToken} disabled={loading}>
              {loading ? '⏳ Verificando...' : 'Verificar código →'}
            </button>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
              onClick={() => { setStep('phone'); setToken(''); setError(null); }}>
              ← Trocar telefone
            </button>
          </div>
        )}

        {/* Step: New Password */}
        {step === 'password' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group">
              <label className="input-label">Nova senha</label>
              <input type="password" placeholder="Mínimo 6 caracteres"
                value={newPwd} onChange={e => setNewPwd(e.target.value)} style={{ width: '100%' }} autoFocus />
            </div>
            <div className="input-group">
              <label className="input-label">Confirmar senha</label>
              <input type="password" placeholder="Repita a nova senha"
                value={confirm} onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                style={{ width: '100%' }} />
            </div>
            {error && <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#f87171' }}>{error}</div>}
            <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleReset} disabled={loading}>
              {loading ? '⏳ Salvando...' : '🔐 Redefinir senha'}
            </button>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
            <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
              Sua senha foi redefinida com sucesso.<br />Faça login com a nova senha.
            </p>
            <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
              Ir para o login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
