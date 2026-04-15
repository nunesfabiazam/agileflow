import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api';
import { useAppStore } from '../store/useAppStore';
import type { Project } from '../types';

const COLORS = ['#6366f1','#22c55e','#f97316','#3b82f6','#a855f7','#eab308','#ef4444','#06b6d4'];

export function ProjectsPage() {
  const { setActiveProject, addRecentProject } = useAppStore();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', key: '', description: '', color: '#6366f1', iconEmoji: '📦' });
  const [error, setError] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then(r => r.data.data ?? []),
  });

  const createMut = useMutation({
    mutationFn: () => projectsApi.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setShowCreate(false); setForm({ name: '', key: '', description: '', color: '#6366f1', iconEmoji: '📦' }); },
    onError: (e: any) => setError(e?.response?.data?.error ?? 'Erro ao criar projeto.'),
  });

  const handleSelect = (p: Project) => { setActiveProject(p.id); addRecentProject(p); };

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h2>Projetos</h2>
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowCreate(true)}>+ Novo Projeto</button>
      </div>

      {(projects as Project[]).length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📦</div><div className="empty-text">Nenhum projeto ainda.</div><div className="empty-sub">Crie seu primeiro projeto para começar.</div><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>Criar Projeto</button></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {(projects as Project[]).map(p => (
            <div key={p.id} className="card" style={{ cursor: 'pointer', borderLeft: `4px solid ${p.color}`, transition: 'all .15s' }}
              onClick={() => handleSelect(p)}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 24 }}>{p.iconEmoji}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                  <code style={{ fontSize: 11, color: 'var(--text3)' }}>{p.key}</code>
                </div>
              </div>
              {p.description && <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>{p.description}</div>}
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text3)' }}>
                <span>📋 {p._count?.tasks ?? 0} tasks</span>
                <span>👥 {p._count?.members ?? 0} membros</span>
                <span>🏃 {p._count?.sprints ?? 0} sprints</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal" style={{ width: 460, padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Novo Projeto</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">Nome do projeto</label>
                <input style={{ width: '100%' }} placeholder="Ex: Plataforma AgileFlow" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Chave do projeto (2-6 letras)</label>
                <input style={{ width: '100%' }} placeholder="AF" maxLength={6} value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value.toUpperCase() }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Descrição (opcional)</label>
                <textarea rows={2} style={{ width: '100%' }} placeholder="Descreva brevemente o projeto..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Cor</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {COLORS.map(c => (
                    <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '3px solid #fff' : '3px solid transparent', boxShadow: form.color === c ? '0 0 0 2px var(--accent)' : 'none' }} />
                  ))}
                </div>
              </div>
              {error && <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#f87171' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={() => createMut.mutate()} disabled={!form.name.trim() || !form.key.trim()}>Criar Projeto</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
