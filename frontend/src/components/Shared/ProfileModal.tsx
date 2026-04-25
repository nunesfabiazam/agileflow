import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api';
import { useAppStore } from '../../store/useAppStore';
import { Avatar } from './Avatar';

const PRESET_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#ef4444',
  '#f97316','#eab308','#22c55e','#14b8a6',
  '#3b82f6','#06b6d4','#64748b','#475569',
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: '👑 Admin', PM: '📋 PM', DEVELOPER: '💻 Dev',
  QA: '🧪 QA', UX: '🎨 UX', SCRUM_MASTER: '🔄 Scrum Master',
  STAKEHOLDER: '👁️ Stakeholder', VIEWER: '👀 Viewer',
};

interface Props { onClose: () => void; }

export function ProfileModal({ onClose }: Props) {
  const qc = useQueryClient();
  const { user, setAuth, token } = useAppStore();
  const [name, setName]     = useState(user?.name ?? '');
  const [color, setColor]   = useState(user?.color ?? '#6366f1');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  const updateMut = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      usersApi.update(user!.id, data),
    onSuccess: (res) => {
      const updated = res.data.data;
      if (updated && token) setAuth(updated, token);
      qc.invalidateQueries({ queryKey: ['me'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e: any) => setError(e?.response?.data?.error ?? 'Erro ao salvar.'),
  });

  const handleSave = () => {
    setError('');
    if (!name.trim()) { setError('Nome não pode ser vazio.'); return; }
    updateMut.mutate({ name: name.trim(), color });
  };

  if (!user) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 420, padding: 32 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>👤 Meu Perfil</div>
          <button onClick={onClose} style={{ color: 'var(--text3)', fontSize: 18 }}>✕</button>
        </div>

        {/* Avatar preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '16px', background: 'var(--bg3)', borderRadius: 12 }}>
          <Avatar name={name || user.name} color={color} size="lg" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{name || user.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{user.email}</div>
            <div style={{ marginTop: 6 }}>
              <span style={{ fontSize: 11, background: 'rgba(99,102,241,.2)', color: 'var(--accent2)', borderRadius: 10, padding: '2px 9px', fontWeight: 600 }}>
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Name */}
        <div className="input-group" style={{ marginBottom: 16 }}>
          <label className="input-label">Nome</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%' }}
            placeholder="Seu nome"
          />
        </div>

        {/* Email (read-only) */}
        <div className="input-group" style={{ marginBottom: 16 }}>
          <label className="input-label">E-mail <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(somente leitura)</span></label>
          <input value={user.email} readOnly style={{ width: '100%', opacity: .6, cursor: 'default' }} />
        </div>

        {/* Função (read-only) */}
        <div className="input-group" style={{ marginBottom: 20 }}>
          <label className="input-label">Função <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(gerenciado pelo admin)</span></label>
          <input value={ROLE_LABELS[user.role] ?? user.role} readOnly style={{ width: '100%', opacity: .6, cursor: 'default' }} />
        </div>

        {/* Color picker */}
        <div style={{ marginBottom: 24 }}>
          <div className="input-label" style={{ marginBottom: 10 }}>Cor do avatar</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PRESET_COLORS.map(c => (
              <div
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: color === c ? `3px solid #fff` : '3px solid transparent',
                  boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                  transition: 'all .15s',
                }}
              />
            ))}
          </div>
        </div>

        {error && (
          <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#f87171', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            style={{ flex: 2, justifyContent: 'center' }}
            onClick={handleSave}
            disabled={saving || updateMut.isPending}
          >
            {updateMut.isPending ? '⏳ Salvando...' : saved ? '✅ Salvo!' : '💾 Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
