import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { epicsApi } from '../api';
import { useAppStore } from '../store/useAppStore';
import type { Epic } from '../types';

const COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316',
  '#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6',
];

const emptyForm = { title: '', description: '', color: '#6366f1', startDate: '', dueDate: '' };

export function EpicsPage() {
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });

  const { data: epics = [] } = useQuery<Epic[]>({
    queryKey: ['epics', activeProjectId],
    queryFn: () => epicsApi.list(activeProjectId!).then(r => r.data.data ?? []),
    enabled: !!activeProjectId,
  });

  const createMut = useMutation({
    mutationFn: () => epicsApi.create({
      title:       form.title.trim(),
      description: form.description.trim() || undefined,
      color:       form.color,
      startDate:   form.startDate ? new Date(form.startDate).toISOString() : undefined,
      dueDate:     form.dueDate   ? new Date(form.dueDate).toISOString()   : undefined,
      projectId:   activeProjectId!,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['epics', activeProjectId] });
      setShowCreate(false);
      setForm({ ...emptyForm });
    },
  });

  const updateMut = useMutation({
    mutationFn: () => epicsApi.update(editId!, {
      title:       editForm.title.trim(),
      description: editForm.description.trim() || undefined,
      color:       editForm.color,
      startDate:   editForm.startDate ? new Date(editForm.startDate).toISOString() : undefined,
      dueDate:     editForm.dueDate   ? new Date(editForm.dueDate).toISOString()   : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['epics', activeProjectId] });
      setEditId(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => epicsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['epics', activeProjectId] }),
  });

  const openEdit = (ep: Epic & { totalTasks?: number; completedTasks?: number; progress?: number }) => {
    setEditId(ep.id);
    setEditForm({
      title:       ep.title,
      description: ep.description ?? '',
      color:       ep.color,
      startDate:   ep.startDate ? ep.startDate.split('T')[0] : '',
      dueDate:     ep.dueDate   ? ep.dueDate.split('T')[0]   : '',
    });
  };

  if (!activeProjectId) return (
    <div className="empty-state">
      <div className="empty-icon">🏔️</div>
      <div className="empty-text">Selecione um projeto.</div>
    </div>
  );

  const epicList = epics as Array<Epic & { totalTasks?: number; completedTasks?: number; progress?: number }>;

  return (
    <div>
      <div className="page-header">
        <h2>🏔️ Épicos</h2>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Novo Épico</button>
        </div>
      </div>

      {epicList.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏔️</div>
          <div className="empty-text">Nenhum épico criado ainda.</div>
          <div className="empty-sub">Épicos agrupam histórias e tarefas em grandes entregas.</div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>
            Criar Primeiro Épico
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {epicList.map(ep => {
            const total    = ep.totalTasks ?? 0;
            const done     = ep.completedTasks ?? 0;
            const progress = ep.progress ?? (total > 0 ? Math.round((done / total) * 100) : 0);

            return (
              <div key={ep.id} className="card" style={{ borderLeft: `4px solid ${ep.color}`, position: 'relative' }}>
                {/* Actions */}
                <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, padding: '2px 7px' }}
                    onClick={() => openEdit(ep)}>✏️</button>
                  <button className="btn btn-ghost btn-sm"
                    style={{ fontSize: 12, padding: '2px 7px', color: 'var(--red)' }}
                    onClick={() => { if (confirm(`Excluir épico "${ep.title}"? As tasks perderão o vínculo.`)) deleteMut.mutate(ep.id); }}>
                    🗑
                  </button>
                </div>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, paddingRight: 60 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: ep.color, flexShrink: 0, marginTop: 4 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{ep.title}</div>
                    {ep.description && (
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3, lineHeight: 1.4 }}>{ep.description}</div>
                    )}
                  </div>
                </div>

                {/* Dates */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12, color: 'var(--text3)' }}>
                  {ep.startDate && <span>📅 {new Date(ep.startDate).toLocaleDateString('pt-BR')}</span>}
                  {ep.dueDate   && <span>🏁 {new Date(ep.dueDate).toLocaleDateString('pt-BR')}</span>}
                  {!ep.startDate && !ep.dueDate && <span>Sem datas definidas</span>}
                </div>

                {/* Progress */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: 'var(--text3)' }}>{done}/{total} tasks</span>
                    <span style={{ fontWeight: 700, color: progress === 100 ? 'var(--green)' : 'var(--text)' }}>{progress}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: progress === 100 ? 'var(--green)' : ep.color,
                      width: `${progress}%`, transition: 'width .4s',
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Novo Épico Modal ── */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal" style={{ width: 480, padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>🏔️ Novo Épico</div>
            <EpicForm form={form} setForm={setForm} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => createMut.mutate()}
                disabled={!form.title.trim() || createMut.isPending}>
                {createMut.isPending ? 'Criando...' : 'Criar Épico'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Editar Épico Modal ── */}
      {editId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditId(null)}>
          <div className="modal" style={{ width: 480, padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>✏️ Editar Épico</div>
            <EpicForm form={editForm} setForm={setEditForm} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setEditId(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => updateMut.mutate()}
                disabled={!editForm.title.trim() || updateMut.isPending}>
                {updateMut.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Formulário reutilizável ────────────────────────────────────────────────────
type FormState = { title: string; description: string; color: string; startDate: string; dueDate: string };

function EpicForm({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const COLORS = [
    '#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316',
    '#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6',
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="input-group">
        <label className="input-label">Título *</label>
        <input autoFocus style={{ width: '100%' }} placeholder="Ex: Autenticação e Onboarding"
          value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      </div>
      <div className="input-group">
        <label className="input-label">Descrição</label>
        <input style={{ width: '100%' }} placeholder="Objetivo do épico..."
          value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="input-group">
        <label className="input-label">Cor</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {COLORS.map(c => (
            <div key={c} onClick={() => setForm({ ...form, color: c })} style={{
              width: 28, height: 28, borderRadius: 6, background: c, cursor: 'pointer',
              boxShadow: form.color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : 'none',
              transition: 'box-shadow .15s',
            }} />
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="input-group">
          <label className="input-label">Início</label>
          <input type="date" style={{ width: '100%' }} value={form.startDate}
            onChange={e => setForm({ ...form, startDate: e.target.value })} />
        </div>
        <div className="input-group">
          <label className="input-label">Prazo</label>
          <input type="date" style={{ width: '100%' }} value={form.dueDate}
            onChange={e => setForm({ ...form, dueDate: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
