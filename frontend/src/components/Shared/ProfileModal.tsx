import { useState, useRef } from 'react';
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
  MANAGER: '📋 Manager', DESIGNER: '🎨 Designer',
};

interface Props { onClose: () => void; }

// Redimensiona e comprime imagem para base64 (máx 200×200 JPEG)
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao carregar imagem')); };
    img.src = url;
  });
}

export function ProfileModal({ onClose }: Props) {
  const qc = useQueryClient();
  const { user, setAuth, token } = useAppStore();

  const [name,      setName]      = useState(user?.name ?? '');
  const [phone,     setPhone]     = useState(user?.phone ?? '');
  const [color,     setColor]     = useState(user?.color ?? '#6366f1');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  const updateMut = useMutation({
    mutationFn: (data: { name: string; color: string; avatarUrl?: string | null; phone?: string | null }) =>
      usersApi.update(user!.id, data as any),
    onSuccess: (res) => {
      const updated = res.data.data;
      if (updated && token) setAuth(updated, token);
      qc.invalidateQueries({ queryKey: ['me'] });
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e: any) => {
      setSaving(false);
      setError(e?.response?.data?.error ?? 'Erro ao salvar.');
    },
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Imagem deve ter no máximo 5 MB.'); return; }
    setUploading(true);
    setError('');
    try {
      const compressed = await compressImage(file);
      setAvatarUrl(compressed);
    } catch {
      setError('Erro ao processar imagem.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = () => {
    setError('');
    if (!name.trim()) { setError('Nome não pode ser vazio.'); return; }
    setSaving(true);
    updateMut.mutate({
      name:      name.trim(),
      color,
      avatarUrl: avatarUrl || null,
      phone:     phone.trim() || null,
    });
  };

  if (!user) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 440, padding: 32 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>👤 Meu Perfil</div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              cursor: 'pointer', color: 'var(--text2)', fontSize: 16,
              width: 30, height: 30, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {/* Avatar preview + upload */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: 16, background: 'var(--bg3)', borderRadius: 12 }}>
          {/* Avatar clicável */}
          <div style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }} onClick={() => !uploading && fileRef.current?.click()} title="Clique para trocar foto">
            <Avatar name={name || user.name} color={color} avatarUrl={avatarUrl || undefined} size="lg" />
            <div
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(0,0,0,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, opacity: uploading ? 1 : 0, transition: 'opacity .15s',
              }}
              onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
              onMouseLeave={e => { if (!uploading) (e.currentTarget as HTMLDivElement).style.opacity = '0'; }}
            >
              {uploading ? '⏳' : '📷'}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || user.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{user.email}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, background: 'rgba(99,102,241,.2)', color: 'var(--accent2)', borderRadius: 10, padding: '2px 9px', fontWeight: 600 }}>
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  style={{ fontSize: 11, color: '#ef4444', background: 'none', border: '1px solid #ef444455', borderRadius: 10, cursor: 'pointer', padding: '2px 8px' }}
                >× remover foto</button>
              )}
            </div>
          </div>
        </div>

        {/* Upload button */}
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              width: '100%', padding: '8px 0', borderRadius: 7, fontSize: 13,
              background: 'var(--bg3)', border: '1px dashed var(--border)',
              color: 'var(--text2)', cursor: uploading ? 'wait' : 'pointer',
            }}
          >
            {uploading ? '⏳ Processando imagem...' : '📷 Fazer upload de foto de perfil'}
          </button>
        </div>

        {/* Name */}
        <div className="input-group" style={{ marginBottom: 14 }}>
          <label className="input-label">Nome</label>
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%' }}
            placeholder="Seu nome"
          />
        </div>

        {/* Phone */}
        <div className="input-group" style={{ marginBottom: 14 }}>
          <label className="input-label">Telefone</label>
          <input
            className="input"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            style={{ width: '100%' }}
            placeholder="+55 11 99999-9999"
          />
        </div>

        {/* Email (read-only) */}
        <div className="input-group" style={{ marginBottom: 14 }}>
          <label className="input-label">E-mail <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(somente leitura)</span></label>
          <input className="input" value={user.email} readOnly style={{ width: '100%', opacity: .6, cursor: 'default' }} />
        </div>

        {/* Função (read-only) */}
        <div className="input-group" style={{ marginBottom: 20 }}>
          <label className="input-label">Função <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(gerenciado pelo admin)</span></label>
          <input className="input" value={ROLE_LABELS[user.role] ?? user.role} readOnly style={{ width: '100%', opacity: .6, cursor: 'default' }} />
        </div>

        {/* Color picker */}
        <div style={{ marginBottom: 24 }}>
          <div className="input-label" style={{ marginBottom: 10 }}>Cor do avatar</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PRESET_COLORS.map(c => (
              <div
                key={c}
                onClick={() => { setColor(c); setAvatarUrl(''); }}
                title={c}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: color === c && !avatarUrl ? `3px solid #fff` : '3px solid transparent',
                  boxShadow: color === c && !avatarUrl ? `0 0 0 2px ${c}` : 'none',
                  transition: 'all .15s',
                  transform: color === c && !avatarUrl ? 'scale(1.15)' : 'scale(1)',
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
            disabled={saving || updateMut.isPending || uploading}
          >
            {updateMut.isPending || saving ? '⏳ Salvando...' : saved ? '✅ Salvo!' : '💾 Salvar alterações'}
          </button>
        </div>

      </div>
    </div>
  );
}
