import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store';
import api from '../api';

const adminApi = {
  list:   ()                          => api.get<any>('/admin/users'),
  create: (data: any)                 => api.post<any>('/admin/users', data),
  update: (id: string, data: any)     => api.patch<any>(`/admin/users/${id}`, data),
  remove: (id: string)                => api.delete<any>(`/admin/users/${id}`),
};

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

interface User {
  id: string; name: string; email: string; role: Role;
  color: string; phone?: string; isActive: boolean; createdAt: string;
}

interface CreateForm {
  name: string; email: string; password: string;
  role: Role; color: string; phone: string;
}

const defaultForm: CreateForm = {
  name: '', email: '', password: '', role: 'DEVELOPER', color: '#6366f1', phone: '',
};

export default function UserManagementPage() {
  const { auth } = useAppStore();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]             = useState<CreateForm>(defaultForm);
  const [formError, setFormError]   = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [filterRole, setFilterRole] = useState<Role | 'ALL'>('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.list().then(r => r.data.data as User[]),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateForm) => adminApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setShowCreate(false);
      setForm(defaultForm);
      setFormError(null);
    },
    onError: (e: any) => setFormError(e?.response?.data?.error ?? 'Erro ao criar usuário.'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => adminApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  if (auth?.role !== 'ADMIN') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <p>Acesso restrito a administradores.</p>
        </div>
      </div>
    );
  }

  const users = data ?? [];
  const filtered = users.filter(u => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole   = filterRole === 'ALL' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const active   = users.filter(u => u.isActive).length;
  const inactive = users.filter(u => !u.isActive).length;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text1)' }}>
            👥 Gerenciamento de Usuários
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
            {active} ativo{active !== 1 ? 's' : ''}{inactive > 0 ? ` · ${inactive} inativo${inactive !== 1 ? 's' : ''}` : ''} · Registro público desabilitado
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { setShowCreate(true); setFormError(null); }}
        >+ Novo Usuário</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          className="input"
          placeholder="🔍 Buscar por nome ou e-mail..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select
          className="input"
          value={filterRole}
          onChange={e => setFilterRole(e.target.value as any)}
          style={{ minWidth: 140 }}
        >
          <option value="ALL">Todos os papéis</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>

      {/* User Table */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>Carregando...</div>
      ) : (
        <div style={{ background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 2fr 1.2fr 1fr auto',
            padding: '10px 16px', background: 'var(--bg3)',
            fontSize: 11, fontWeight: 700, color: 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: '.06em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>Usuário</span>
            <span>E-mail / Telefone</span>
            <span>Papel</span>
            <span>Status</span>
            <span>Ações</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              Nenhum usuário encontrado.
            </div>
          ) : filtered.map(user => (
            <div key={user.id} style={{
              display: 'grid', gridTemplateColumns: '2fr 2fr 1.2fr 1fr auto',
              padding: '12px 16px', alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              opacity: user.isActive ? 1 : 0.5,
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              {/* Avatar + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: user.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>{user.name}</div>
                  {user.id === auth?.id && (
                    <div style={{ fontSize: 10, color: 'var(--accent)' }}>você</div>
                  )}
                </div>
              </div>

              {/* Email + phone */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{user.email}</div>
                {user.phone && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{user.phone}</div>}
              </div>

              {/* Role selector */}
              <div>
                <select
                  className="input"
                  value={user.role}
                  disabled={user.id === auth?.id}
                  onChange={e => updateMut.mutate({ id: user.id, data: { role: e.target.value } })}
                  style={{
                    fontSize: 11, padding: '3px 8px', height: 28,
                    color: ROLE_COLORS[user.role],
                    fontWeight: 600,
                  }}
                >
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>

              {/* Active toggle */}
              <div>
                <button
                  className={`btn btn-sm ${user.isActive ? 'btn-ghost' : 'btn-primary'}`}
                  style={{
                    fontSize: 11,
                    color: user.isActive ? '#10b981' : '#6b7280',
                    borderColor: user.isActive ? '#10b981' : undefined,
                  }}
                  disabled={user.id === auth?.id}
                  onClick={() => updateMut.mutate({ id: user.id, data: { isActive: !user.isActive } })}
                >
                  {user.isActive ? '✅ Ativo' : '⛔ Inativo'}
                </button>
              </div>

              {/* Delete (deactivate) */}
              <div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#ef4444', fontSize: 16, padding: '2px 6px' }}
                  disabled={user.id === auth?.id}
                  title="Desativar usuário"
                  onClick={() => {
                    if (confirm(`Desativar ${user.name}?`)) removeMut.mutate(user.id);
                  }}
                >×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create User Modal */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: 'var(--bg2)', borderRadius: 12, padding: 28,
            width: 420, border: '1px solid var(--border)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text1)' }}>+ Criar Usuário</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 20 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Avatar preview */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', background: form.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: '#fff',
                }}>
                  {form.name ? form.name.slice(0, 2).toUpperCase() : '?'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {AVATAR_COLORS.map(c => (
                    <div
                      key={c}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      style={{
                        width: 18, height: 18, borderRadius: '50%', background: c,
                        cursor: 'pointer',
                        outline: form.color === c ? `2px solid ${c}` : 'none',
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
              </div>

              <input className="input" placeholder="Nome completo *" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <input className="input" type="email" placeholder="E-mail *" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <input className="input" type="password" placeholder="Senha (mín. 6 caracteres) *" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              <input className="input" type="tel" placeholder="Telefone (ex: +55 11 99999-9999)" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />

              <select className="input" value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>

              {formError && <div style={{ fontSize: 12, color: '#ef4444' }}>{formError}</div>}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setShowCreate(false)}>Cancelar</button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                  disabled={createMut.isPending}
                  onClick={() => createMut.mutate(form)}>
                  {createMut.isPending ? '⏳ Criando...' : '✅ Criar Usuário'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
