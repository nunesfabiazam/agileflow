import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { epicsApi } from '../api';
import type { Epic } from '../types';

const COLORS = [
  '#6366f1','#a855f7','#ec4899','#ef4444','#f97316',
  '#eab308','#22c55e','#14b8a6','#3b82f6','#64748b',
];

type FormState = {
  title: string;
  description: string;
  color: string;
  startDate: string;
  dueDate: string;
};

const EMPTY_FORM: FormState = { title: '', description: '', color: '#6366f1', startDate: '', dueDate: '' };

export function EpicsPage() {
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const qc = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editEpic, setEditEpic]   = useState<Epic | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId]   = useState<string | null>(null);

  const { data: epics = [], isLoading } = useQuery<Epic[]>({
    queryKey: ['epics', activeProjectId],
    queryFn:  () => epicsApi.list(activeProjectId!).then(r => r.data.data ?? []),
    enabled:  !!activeProjectId,
  });

  const createMut = useMutation({
    mutationFn: () => epicsApi.create({
      title: form.title, description: form.description || undefined,
      color: form.color, projectId: activeProjectId!,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
      dueDate:   form.dueDate   ? new Date(form.dueDate).toISOString()   : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['epics', activeProjectId] }); closeModal(); },
  });

  const updateMut = useMutation({
    mutationFn: () => epicsApi.update(editEpic!.id, {
      title: form.title, description: form.description || undefined,
      color: form.color,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
      dueDate:   form.dueDate   ? new Date(form.dueDate).toISOString()   : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['epics', activeProjectId] }); closeModal(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => epicsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['epics', activeProjectId] }); setDeleteId(null); },
  });

  const closeModal = () => { setShowModal(false); setEditEpic(null); setForm(EMPTY_FORM); };
  const openCreate = () => { setEditEpic(null); setForm(EMPTY_FORM); setShowModal(true); };

  const openEdit = (e: Epic) => {
    setEditEpic(e);
    setForm({
      title: e.title, description: e.description ?? '', color: e.color,
      startDate: e.startDate ? e.startDate.slice(0, 10) : '',
      dueDate:   e.dueDate   ? e.dueDate.slice(0, 10)   : '',
    });
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    editEpic ? updateMut.mutate() : createMut.mutate();
  };

  if (!activeProjectId) return (
    <div className="empty-state">
      <div className="empty-icon">🏔️</div>
      <div className="empty-text">Nenhum projeto selecionado</div>
      <div className="empty-sub">Selecione um projeto na barra lateral para ver os épicos.</div>
    </div>
  );

  const totalEpics      = epics.length;
  const completedEpics  = epics.filter(e => (e.progress ?? 0) >= 100).length;
  const inProgressEpics = epics.filter(e => (e.progress ?? 0) > 0 && (e.progress ?? 0) < 100).length;

  return (
    <div>
      <div className="page-header">
        <h2>Épicos</h2>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Novo Épico</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { icon: '🏔️', label: 'Total',        value: totalEpics      },
          { icon: '🔄', label: 'Em andamento', value: inProgressEpics },
          { icon: '✅', label: 'Concluídos',   value: completedEpics  },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: 1, textAlign: 'center', padding: '14px 16px' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><div className="spinner" /></div>
      ) : epics.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏔️</div>
          <div className="empty-text">Nenhum épico ainda</div>
          <div className="empty-sub">Épicos agrupam histórias e tarefas em grandes iniciativas de produto.</div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openCreate}>+ Criar primeiro épico</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {epics.map(epic => {
            const prog = epic.progress ?? 0;
            const isOverdue = epic.dueDate && new Date(epic.dueDate) < new Date() && prog < 100;
            return (
              <div key={epic.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: epic.color }} />
                <div style={{ paddingTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: epic.color, flexShrink: 0, marginTop: 3 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{epic.title}</div>
                      {epic.description && (
                        <div style={{
                          fontSize: 12, color: 'var(--text3)', marginTop: 4, lineHeight: 1.4,
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>{epic.description}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button onClick={() => openEdit(epic)}
                        style={{ padding: '3px 6px', borderRadius: 4, color: 'var(--text3)', fontSize: 13 }}
                        title="Editar">✏️</button>
                      <button onClick={() => setDeleteId(epic.id)}
                        style={{ padding: '3px 6px', borderRadius: 4, color: 'var(--text3)', fontSize: 13 }}
                        title="Excluir">🗑️</button>
                    </div>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                      <span>{epic.completedTasks ?? 0}/{epic.totalTasks ?? 0} tarefas</span>
                      <span style={{ color: prog >= 100 ? '#22c55e' : 'var(--text2)', fontWeight: 600 }}>{prog}%</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3, transition: 'width .3s',
                        background: prog >= 100 ? '#22c55e' : epic.color,
                        width: `${prog}%`,
                      }} />
                    </div>
                  </div>

                  {(epic.startDate || epic.dueDate) && (
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: isOverdue ? '#ef4444' : 'var(--text3)' }}>
                      {epic.startDate && <span>🗓️ {new Date(epic.startDate).toLocaleDateString('pt-BR')}</span>}
                      {epic.dueDate   && <span>{isOverdue ? '⚠️ ' : '⏳ '}{new Date(epic.dueDate).toLocaleDateString('pt-BR')}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal" style={{ width: 500, padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>
              {editEpic ? 'Editar Épico' : 'Novo Épico'}
            </div>

            <div className="input-group">
              <label className="input-label">Título *</label>
              <input
                autoFocus value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex.: Redesign do checkout, Migração de banco..."
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Descrição</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Objetivo e contexto do épico..."
                rows={3} style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Cor</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                    boxShadow: form.color === c ? `0 0 0 2px var(--bg1), 0 0 0 4px ${c}` : 'none',
                    transition: 'box-shadow .15s',
                  }} />
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Data de Início</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Data de Entrega</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>

            {form.title && (
              <div style={{ margin: '0 0 16px', padding: '10px 14px', borderRadius: 8, background: 'var(--bg3)', borderLeft: `4px solid ${form.color}` }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{form.title}</div>
                {form.description && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{form.description}</div>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSubmit}
                disabled={!form.title.trim() || createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? 'Salvando...' : editEpic ? 'Salvar' : 'Criar Épico'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="modal" style={{ width: 380, padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Excluir Épico</div>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
              As tarefas vinculadas não serão excluídas — apenas o vínculo ao épico é removido. Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancelar</button>
              <button style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => deleteMut.mutate(deleteId!)} disabled={deleteMut.isPending}>
                {deleteMut.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
