import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import { adminApi } from '../api';

const ROLES = ['ADMIN', 'MANAGER', 'DEVELOPER', 'DESIGNER', 'VIEWER'] as const;
type Role = typeof ROLES[number];

const ROLE_LABELS: Record<Role, string> = {
  ADMIN:     '🛡️ Admin',
  MANAGER:   '📋 Manager',
  DEVELOPER: '💻 Developer',
  DESIGNER:  '🎨 Designer',
  VIEWER:    '👁️ Viewer',
};

const ROLE_COLORS: Record<Role, string> = {
  ADMIN:     '#ef4444',
  MANAGER:   '#f59e0b',
  DEVELOPER: '#6366f1',
  DESIGNER:  '#ec4899',
  VIEWER:    '#6b7280',
};

const AVATAR_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#ef4444',
  '#f59e0b','#10b981','#06b6d4','#3b82f6',
  '#84cc16','#f97316','#a855f7','#14b8a6',
];

interface AdminUser {
  id: string; name: string; email: string; role: Role;
  color: string; avatarUrl?: string | null; phone?: string | null;
  isActive: boolean; createdAt: string;
}

interface UserForm {
  name: string; email: string; phone: string;
  role: Role; color: string; avatarUrl: string;
  password?: string;
}

const blankForm = (): UserForm => ({
  name: '', email: '', phone: '', role: 'DEVELOPER', color: '#6366f1', avatarUrl: '', password: '',
});

// ── Avatar component ──────────────────────────────────────────────────────────
function UserAvatar({ user, size = 36 }: { user: { name: string; color: string; avatarUrl?: string | null }; size?: number }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: user.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {user.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

// ── Avatar picker with upload ─────────────────────────────────────────────────
function AvatarPicker({
  name, color, avatarUrl, onColorChange, onAvatarChange,
}: {
  name: string; color: string; avatarUrl: string;
  onColorChange: (c: string) => void;
  onAvatarChange: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Compress + resize image to max 200x200 JPEG before storing
  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
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
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = url;
    });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Imagem deve ter no máximo 5 MB.'); return; }
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      onAvatarChange(compressed);
    } catch {
      alert('Erro ao processar imagem. Tente outro arquivo.');
    } finally {
      setUploading(false);
      // reset input so same file can be re-selected
      e.target.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 8 }}>
      {/* Preview */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          title="Clique para trocar a foto"
          style={{ cursor: uploading ? 'wait' : 'pointer', position: 'relative', display: 'inline-block' }}
        >
          <UserAvatar user={{ name: name || '?', color, avatarUrl: avatarUrl || null }} size={64} />
          {/* hover overlay */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, opacity: uploading ? 1 : 0,
            transition: 'opacity .15s',
          }}
            className="avatar-overlay"
            onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
            onMouseLeave={e => { if (!uploading) (e.currentTarget as HTMLDivElement).style.opacity = '0'; }}
          >
            {uploading ? '⏳' : '📷'}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      </div>

      {/* Color swatches + remove photo */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
          {avatarUrl ? '✅ Foto personalizada' : 'Escolha uma cor — ou clique na foto para fazer upload'}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {AVATAR_COLORS.map(c => (
            <div
              key={c}
              onClick={() => { onColorChange(c); onAvatarChange(''); }}
              title={c}
              style={{
                width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                outline: color === c && !avatarUrl ? `2px solid ${c}` : 'none',
                outlineOffset: 2, transition: 'transform .1s',
                transform: color === c && !avatarUrl ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              fontSize: 11, color: 'var(--accent)', background: 'none',
              border: '1px solid var(--accent)', borderRadius: 5,
              cursor: uploading ? 'wait' : 'pointer', padding: '3px 8px',
            }}
          >
            {uploading ? '⏳ Processando...' : '📷 Fazer upload'}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={() => onAvatarChange('')}
              style={{ fontSize: 11, color: '#ef4444', background: 'none', border: '1px solid #ef444455', borderRadius: 5, cursor: 'pointer', padding: '3px 8px' }}
            >
              × Remover foto
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── User form modal (create + edit) ──────────────────────────────────────────
function UserFormModal({
  title, form, setForm, onSave, onClose, saving, error, isEdit,
}: {
  title: string;
  form: UserForm;
  setForm: React.Dispatch<React.SetStateAction<UserForm>>;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
  isEdit?: boolean;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--bg2)', borderRadius: 14, padding: 28,
        width: 460, maxHeight: '90vh', overflowY: 'auto',
        border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text1)' }}>{title}</h2>
          <button
            onClick={onClose}
            title="Fechar"
            style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              cursor: 'pointer', color: 'var(--text2)', fontSize: 16,
              width: 30, height: 30, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Avatar picker */}
          <AvatarPicker
            name={form.name}
            color={form.color}
            avatarUrl={form.avatarUrl}
            onColorChange={c => setForm(f => ({ ...f, color: c }))}
            onAvatarChange={url => setForm(f => ({ ...f, avatarUrl: url }))}
          />

          {/* Name */}
          <div className="input-group">
            <label className="input-label">Nome completo *</label>
            <input className="input" placeholder="Ana Lima"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ width: '100%' }} />
          </div>

          {/* Email */}
          <div className="input-group">
            <label className="input-label">E-mail *</label>
            <input className="input" type="email" placeholder="ana@empresa.com"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              style={{ width: '100%' }} />
          </div>

          {/* Phone */}
          <div className="input-group">
            <label className="input-label">Telefone <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(para reset de senha via SMS)</span></label>
            <input className="input" type="tel" placeholder="+55 11 99999-9999"
              value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              style={{ width: '100%' }} />
          </div>

          {/* Password — only on create, optional on edit */}
          <div className="input-group">
            <label className="input-label">
              Senha {isEdit && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(deixe em branco para não alterar)</span>}
              {!isEdit && <span style={{ color: '#ef4444' }}>  *</span>}
            </label>
            <input className="input" type="password" placeholder={isEdit ? '••••••• (opcional)' : 'Mínimo 6 caracteres'}
              value={form.password ?? ''} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              style={{ width: '100%' }} />
          </div>

          {/* Role */}
          <div className="input-group">
            <label className="input-label">Papel</label>
            <select className="input" value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
              style={{ width: '100%', color: ROLE_COLORS[form.role], fontWeight: 600 }}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>

          {error && (
            <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#f87171' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}
              onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
              disabled={saving} onClick={onSave}>
              {saving ? '⏳ Salvando...' : isEdit ? '💾 Salvar' : '✅ Criar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function UserManagementPage() {
  const { user: me } = useAppStore();
  const navigate     = useNavigate();
  const qc           = useQueryClient();

  const [showCreate, setShowCreate]   = useState(false);
  const [editUser, setEditUser]       = useState<AdminUser | null>(null);
  const [createForm, setCreateForm]   = useState<UserForm>(blankForm());
  const [editForm, setEditForm]       = useState<UserForm>(blankForm());
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError]     = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [filterRole, setFilterRole]   = useState<Role | 'ALL'>('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.list().then((r: any) => r.data.data as AdminUser[]),
  });

  const createMut = useMutation({
    mutationFn: (d: UserForm) => adminApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setShowCreate(false);
      setCreateForm(blankForm());
      setCreateError(null);
    },
    onError: (e: any) => setCreateError(e?.response?.data?.error ?? 'Erro ao criar usuário.'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) => adminApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setEditUser(null);
      setEditError(null);
    },
    onError: (e: any) => setEditError(e?.response?.data?.error ?? 'Erro ao atualizar.'),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => adminApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  if (me?.role !== 'ADMIN') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <p>Acesso restrito a administradores.</p>
        </div>
      </div>
    );
  }

  const users    = data ?? [];
  const filtered = users.filter((u: AdminUser) => {
    const matchSearch = !search
      || u.name.toLowerCase().includes(search.toLowerCase())
      || u.email.toLowerCase().includes(search.toLowerCase())
      || (u.phone ?? '').includes(search);
    const matchRole = filterRole === 'ALL' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const active   = users.filter((u: AdminUser) => u.isActive).length;
  const inactive = users.filter((u: AdminUser) => !u.isActive).length;

  const openEdit = (u: AdminUser) => {
    setEditForm({
      name: u.name, email: u.email, phone: u.phone ?? '',
      role: u.role, color: u.color, avatarUrl: u.avatarUrl ?? '', password: '',
    });
    setEditUser(u);
    setEditError(null);
  };

  const handleCreate = () => {
    if (!createForm.name.trim()) return setCreateError('Nome é obrigatório.');
    if (!createForm.email.trim()) return setCreateError('E-mail é obrigatório.');
    if (!createForm.password || createForm.password.length < 6) return setCreateError('Senha deve ter ao menos 6 caracteres.');
    createMut.mutate(createForm);
  };

  const handleEdit = () => {
    if (!editUser) return;
    if (!editForm.name.trim()) return setEditError('Nome é obrigatório.');
    if (!editForm.email.trim()) return setEditError('E-mail é obrigatório.');
    const payload: Record<string, any> = {
      name:      editForm.name,
      email:     editForm.email,
      phone:     editForm.phone || null,
      role:      editForm.role,
      color:     editForm.color,
      avatarUrl: editForm.avatarUrl || null,
    };
    if (editForm.password && editForm.password.length >= 6) {
      payload.password = editForm.password;
    }
    updateMut.mutate({ id: editUser.id, data: payload });
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 920, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        {/* Back button — same pattern as ProjectSettingsPage */}
        <button
          onClick={() => navigate(-1)}
          style={{
            color: 'var(--text3)', fontSize: 18, padding: '4px 8px',
            borderRadius: 6, background: 'var(--bg3)',
            border: 'none', cursor: 'pointer', lineHeight: 1,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
          title="Voltar"
        >←</button>

        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text1)' }}>
            👥 Gerenciamento de Usuários
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text3)' }}>
            {active} ativo{active !== 1 ? 's' : ''}
            {inactive > 0 ? ` · ${inactive} inativo${inactive !== 1 ? 's' : ''}` : ''}
            {' · '}Registro público desabilitado
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => { setShowCreate(true); setCreateError(null); setCreateForm(blankForm()); }}
        >+ Novo Usuário</button>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          className="input"
          placeholder="🔍 Buscar por nome, e-mail ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select
          className="input"
          value={filterRole}
          onChange={e => setFilterRole(e.target.value as Role | 'ALL')}
          style={{ minWidth: 140 }}
        >
          <option value="ALL">Todos os papéis</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>Carregando...</div>
      ) : (
        <div style={{ background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2.5fr 2fr 1.2fr 1fr 80px',
            padding: '10px 16px', background: 'var(--bg3)',
            fontSize: 11, fontWeight: 700, color: 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: '.06em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>Usuário</span>
            <span>E-mail / Telefone</span>
            <span>Papel</span>
            <span>Status</span>
            <span style={{ textAlign: 'center' }}>Ações</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              Nenhum usuário encontrado.
            </div>
          ) : filtered.map((u: AdminUser) => (
            <div
              key={u.id}
              style={{
                display: 'grid', gridTemplateColumns: '2.5fr 2fr 1.2fr 1fr 80px',
                padding: '11px 16px', alignItems: 'center',
                borderBottom: '1px solid var(--border)',
                opacity: u.isActive ? 1 : 0.45,
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              {/* Avatar + name — click avatar to open edit */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  onClick={() => openEdit(u)}
                  title="Editar usuário"
                  style={{ cursor: 'pointer', flexShrink: 0, opacity: 0.9, transition: 'opacity .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.9')}
                >
                  <UserAvatar user={u} size={34} />
                </div>
                <div>
                  <div
                    style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', cursor: 'pointer' }}
                    onClick={() => openEdit(u)}
                    title="Editar usuário"
                  >{u.name}</div>
                  {u.id === me?.id && (
                    <div style={{ fontSize: 10, color: 'var(--accent)' }}>você</div>
                  )}
                </div>
              </div>

              {/* Email + phone — click to edit */}
              <div
                onClick={() => openEdit(u)}
                title="Editar dados do usuário"
                style={{ cursor: 'pointer' }}
              >
                <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                {u.phone
                  ? <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.phone}</div>
                  : <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>sem telefone</div>
                }
              </div>

              {/* Role inline selector */}
              <div>
                <select
                  className="input"
                  value={u.role}
                  disabled={u.id === me?.id}
                  onChange={e => updateMut.mutate({ id: u.id, data: { role: e.target.value } })}
                  style={{ fontSize: 11, padding: '3px 6px', height: 26, color: ROLE_COLORS[u.role], fontWeight: 600 }}
                >
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>

              {/* Active toggle */}
              <div>
                <button
                  className="btn btn-sm btn-ghost"
                  style={{ fontSize: 11, color: u.isActive ? '#10b981' : '#6b7280', whiteSpace: 'nowrap' }}
                  disabled={u.id === me?.id}
                  onClick={() => updateMut.mutate({ id: u.id, data: { isActive: !u.isActive } })}
                >
                  {u.isActive ? '✅ Ativo' : '⛔ Inativo'}
                </button>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 14, padding: '2px 7px' }}
                  title="Editar dados"
                  onClick={() => openEdit(u)}
                >✏️</button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#ef4444', fontSize: 16, padding: '2px 6px', lineHeight: 1 }}
                  disabled={u.id === me?.id}
                  title="Desativar usuário"
                  onClick={() => {
                    if (window.confirm(`Desativar ${u.name}?`)) removeMut.mutate(u.id);
                  }}
                >×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create modal ── */}
      {showCreate && (
        <UserFormModal
          title="+ Novo Usuário"
          form={createForm}
          setForm={setCreateForm}
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
          saving={createMut.isPending}
          error={createError}
        />
      )}

      {/* ── Edit modal ── */}
      {editUser && (
        <UserFormModal
          title={`✏️ Editar — ${editUser.name}`}
          form={editForm}
          setForm={setEditForm}
          onSave={handleEdit}
          onClose={() => setEditUser(null)}
          saving={updateMut.isPending}
          error={editError}
          isEdit
        />
      )}
    </div>
  );
}
