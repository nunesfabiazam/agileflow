import { useAppStore } from '../store/useAppStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, sprintsApi } from '../api';
import type { Task, Sprint } from '../types';
import { Badge } from '../components/Shared/Badge';
import { Avatar } from '../components/Shared/Avatar';
import { useState, useCallback, memo } from 'react';
import { TaskDetailModal } from '../components/kanban/TaskDetailModal';

const STATUS_LABEL: Record<string, string> = {
  PLANNING: 'Planejado', ACTIVE: 'Ativa', COMPLETED: 'Concluída', CANCELLED: 'Cancelada',
};

export function BacklogPage() {
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const qc = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [showNewSprint, setShowNewSprint] = useState(false);
  const [newSprint, setNewSprint] = useState({ name: '', goal: '', startDate: '', endDate: '' });
  const [showComplete, setShowComplete] = useState<string | null>(null);
  const [moveToSprintId, setMoveToSprintId] = useState('');

  // ── Bulk selection ──────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSprintId, setBulkSprintId] = useState('');

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: string[]) => {
    setSelectedIds(prev => {
      const allSelected = ids.every(id => prev.has(id));
      if (allSelected) return new Set();
      return new Set(ids);
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const { data: sprints = [] } = useQuery<Sprint[]>({
    queryKey: ['sprints', activeProjectId],
    queryFn: () => sprintsApi.list(activeProjectId!).then(r => r.data.data ?? []),
    enabled: !!activeProjectId,
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks', activeProjectId],
    queryFn: () => tasksApi.list({ projectId: activeProjectId! }).then(r => r.data.data ?? []),
    enabled: !!activeProjectId,
  });

  const createSprintMut = useMutation({
    mutationFn: () => sprintsApi.create({
      name:      newSprint.name.trim(),
      goal:      newSprint.goal.trim() || undefined,
      startDate: newSprint.startDate ? new Date(newSprint.startDate).toISOString() : undefined,
      endDate:   newSprint.endDate   ? new Date(newSprint.endDate).toISOString()   : undefined,
      projectId: activeProjectId!,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', activeProjectId] });
      setShowNewSprint(false);
      setNewSprint({ name: '', goal: '', startDate: '', endDate: '' });
    },
  });

  const startSprintMut = useMutation({
    mutationFn: sprintsApi.start,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprints', activeProjectId] }),
  });

  const completeSprintMut = useMutation({
    mutationFn: (id: string) => sprintsApi.complete(id, moveToSprintId || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', activeProjectId] });
      qc.invalidateQueries({ queryKey: ['tasks', activeProjectId] });
      setShowComplete(null);
      setMoveToSprintId('');
    },
  });

  const deleteSprintMut = useMutation({
    mutationFn: sprintsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', activeProjectId] });
      qc.invalidateQueries({ queryKey: ['tasks', activeProjectId] });
    },
  });

  // ── Single task move — optimistic update (sem delay) ───────────────────────
  const moveTaskMut = useMutation({
    mutationFn: ({ taskId, sprintId }: { taskId: string; sprintId: string | null }) =>
      tasksApi.update(taskId, { sprintId } as any),
    onMutate: async ({ taskId, sprintId }) => {
      await qc.cancelQueries({ queryKey: ['tasks', activeProjectId] });
      const prev = qc.getQueriesData<Task[]>({ queryKey: ['tasks', activeProjectId] });
      const targetSprint = sprintId ? (sprints as Sprint[]).find(s => s.id === sprintId) : undefined;
      qc.setQueriesData<Task[]>({ queryKey: ['tasks', activeProjectId] }, (old) => {
        if (!old) return old;
        return old.map(t => t.id === taskId
          ? { ...t, sprint: targetSprint ? { id: targetSprint.id, name: targetSprint.name } : undefined }
          : t
        );
      });
      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      ctx?.prev?.forEach(([key, data]: [any, any]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', activeProjectId] }),
  });

  // ── Bulk sprint assignment ──────────────────────────────────────────────────
  const bulkMoveMut = useMutation({
    mutationFn: ({ ids, sprintId }: { ids: string[]; sprintId: string | null }) =>
      tasksApi.bulkUpdate(ids, { sprintId }),
    onMutate: async ({ ids, sprintId }) => {
      await qc.cancelQueries({ queryKey: ['tasks', activeProjectId] });
      const prev = qc.getQueriesData<Task[]>({ queryKey: ['tasks', activeProjectId] });
      const targetSprint = sprintId ? (sprints as Sprint[]).find(s => s.id === sprintId) : undefined;
      qc.setQueriesData<Task[]>({ queryKey: ['tasks', activeProjectId] }, (old) => {
        if (!old) return old;
        return old.map(t => ids.includes(t.id)
          ? { ...t, sprint: targetSprint ? { id: targetSprint.id, name: targetSprint.name } : undefined }
          : t
        );
      });
      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      ctx?.prev?.forEach(([key, data]: [any, any]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks', activeProjectId] });
      clearSelection();
      setBulkSprintId('');
    },
  });

  if (!activeProjectId) {
    return <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-text">Selecione um projeto para ver o backlog.</div></div>;
  }

  const backlogTasks    = tasks.filter(t => !t.sprint);
  const activeSprints   = (sprints as Sprint[]).filter(s => s.status === 'ACTIVE');
  const planningSprints = (sprints as Sprint[]).filter(s => s.status === 'PLANNING');
  const completedSprints = (sprints as Sprint[]).filter(s => s.status === 'COMPLETED');
  const targetSprints   = [...activeSprints, ...planningSprints];

  const completingSprint      = showComplete ? (sprints as Sprint[]).find(s => s.id === showComplete) : null;
  const completingSprintTasks = showComplete ? tasks.filter(t => t.sprint?.id === showComplete) : [];
  const incompleteTasks       = completingSprintTasks.filter(t => !t.column?.isDefault);
  const otherSprints          = (sprints as Sprint[]).filter(s => s.id !== showComplete && s.status !== 'COMPLETED');

  const backlogIds = backlogTasks.map(t => t.id);
  const selectedCount = [...selectedIds].filter(id => backlogIds.includes(id)).length;

  return (
    <div>
      <div className="page-header">
        <h2>📋 Backlog do Produto</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNewSprint(true)}>+ Nova Sprint</button>
        </div>
      </div>

      {[...activeSprints, ...planningSprints, ...completedSprints].map(sprint => {
        const sprintTasks = tasks.filter(t => t.sprint?.id === sprint.id);
        const pts  = sprintTasks.reduce((a, t) => a + (t.storyPoints ?? 0), 0);
        const done = sprintTasks.filter(t => t.column?.isDefault).length;

        return (
          <div key={sprint.id} style={{ marginBottom: 28 }}>
            <div style={{
              background: sprint.status === 'ACTIVE' ? 'rgba(99,102,241,.08)' : 'var(--bg2)',
              border: `1px solid ${sprint.status === 'ACTIVE' ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 10, padding: '14px 20px', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{sprint.name}</div>
                {sprint.goal && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{sprint.goal}</div>}
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  {sprint.startDate ? new Date(sprint.startDate).toLocaleDateString('pt-BR') : '—'}
                  {' → '}
                  {sprint.endDate ? new Date(sprint.endDate).toLocaleDateString('pt-BR') : '—'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                {[{ v: pts, l: 'Story Pts' }, { v: sprintTasks.length, l: 'Itens' }, { v: done, l: 'Concluídos' }].map(s => (
                  <div key={s.l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{s.v}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.l}</div>
                  </div>
                ))}
              </div>
              <span className={`badge badge-${sprint.status.toLowerCase()}`}>{STATUS_LABEL[sprint.status]}</span>
              {sprint.status === 'PLANNING' && (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => startSprintMut.mutate(sprint.id)}>▶ Iniciar</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', opacity: .7 }}
                    onClick={() => { if (confirm(`Excluir sprint "${sprint.name}"? As tasks voltam para o backlog.`)) deleteSprintMut.mutate(sprint.id); }}>
                    🗑
                  </button>
                </>
              )}
              {sprint.status === 'ACTIVE' && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowComplete(sprint.id)}>✅ Concluir Sprint</button>
              )}
            </div>
            <TaskTable
              tasks={sprintTasks}
              onSelect={setSelectedTask}
              showMoveToSprint={false}
            />
          </div>
        );
      })}

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text3)' }}>📋 Backlog ({backlogTasks.length})</div>
          {backlogTasks.length > 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>sem sprint atribuída</div>}
        </div>

        {/* ── Bulk action bar ── */}
        {selectedCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(99,102,241,.1)', border: '1px solid var(--accent)',
            borderRadius: 8, padding: '8px 14px', marginBottom: 10,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent2)' }}>
              {selectedCount} {selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
            </span>
            <div style={{ flex: 1 }} />
            <select
              value={bulkSprintId}
              onChange={e => setBulkSprintId(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}
            >
              <option value="">— Mover para Sprint...</option>
              <option value="__backlog__">📋 Backlog (remover sprint)</option>
              {targetSprints.map(s => (
                <option key={s.id} value={s.id}>{s.status === 'ACTIVE' ? '🟢 ' : '📅 '}{s.name}</option>
              ))}
            </select>
            <button
              className="btn btn-primary btn-sm"
              disabled={!bulkSprintId || bulkMoveMut.isPending}
              onClick={() => {
                const sprintId = bulkSprintId === '__backlog__' ? null : bulkSprintId;
                bulkMoveMut.mutate({ ids: [...selectedIds].filter(id => backlogIds.includes(id)), sprintId });
              }}
            >
              {bulkMoveMut.isPending ? 'Movendo...' : '✓ Aplicar'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={clearSelection}>✕ Cancelar</button>
          </div>
        )}

        {backlogTasks.length === 0 ? (
          <div style={{ padding: '12px 0', color: 'var(--text3)', fontSize: 13 }}>Nenhuma task no backlog.</div>
        ) : (
          <TaskTable
            tasks={backlogTasks}
            onSelect={setSelectedTask}
            showMoveToSprint
            sprints={targetSprints}
            onMoveToSprint={(taskId, sprintId) => moveTaskMut.mutate({ taskId, sprintId })}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleAll={() => toggleAll(backlogIds)}
          />
        )}
      </div>

      {selectedTask && <TaskDetailModal task={selectedTask} projectId={activeProjectId} onClose={() => setSelectedTask(null)} />}

      {showNewSprint && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNewSprint(false)}>
          <div className="modal" style={{ width: 480, padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>🏃 Nova Sprint</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">Nome *</label>
                <input autoFocus style={{ width: '100%' }} placeholder="Ex: Sprint 1 — Autenticação"
                  value={newSprint.name} onChange={e => setNewSprint(s => ({ ...s, name: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Meta (Goal)</label>
                <input style={{ width: '100%' }} placeholder="O que queremos entregar nesta sprint?"
                  value={newSprint.goal} onChange={e => setNewSprint(s => ({ ...s, goal: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="input-group">
                  <label className="input-label">Início</label>
                  <input type="date" style={{ width: '100%' }} value={newSprint.startDate}
                    onChange={e => setNewSprint(s => ({ ...s, startDate: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Fim</label>
                  <input type="date" style={{ width: '100%' }} value={newSprint.endDate}
                    onChange={e => setNewSprint(s => ({ ...s, endDate: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="btn btn-ghost" onClick={() => setShowNewSprint(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={() => createSprintMut.mutate()}
                  disabled={!newSprint.name.trim() || createSprintMut.isPending}>
                  {createSprintMut.isPending ? 'Criando...' : 'Criar Sprint'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showComplete && completingSprint && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowComplete(null)}>
          <div className="modal" style={{ width: 480, padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>✅ Concluir Sprint</div>
            <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 20 }}>
              <strong>{completingSprint.name}</strong> — {completingSprintTasks.length} tasks, {completingSprintTasks.filter(t => t.column?.isDefault).length} concluídas.
            </div>
            {incompleteTasks.length > 0 ? (
              <>
                <div style={{ background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--yellow)' }}>⚠️ {incompleteTasks.length} task(s) incompleta(s)</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Escolha o que fazer com elas:</div>
                </div>
                <div className="input-group">
                  <label className="input-label">Mover tasks incompletas para</label>
                  <select style={{ width: '100%' }} value={moveToSprintId} onChange={e => setMoveToSprintId(e.target.value)}>
                    <option value="">📋 Backlog (sem sprint)</option>
                    {otherSprints.map(s => (
                      <option key={s.id} value={s.id}>{s.status === 'ACTIVE' ? '🟢' : '📅'} {s.name}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div style={{ background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--green)' }}>🎉 Todas as tasks foram concluídas!</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setShowComplete(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => completeSprintMut.mutate(showComplete)}
                disabled={completeSprintMut.isPending}>
                {completeSprintMut.isPending ? 'Concluindo...' : 'Confirmar Conclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Memoized row — só re-renderiza quando os seus próprios dados mudam ────────
const TaskRow = memo(function TaskRow({
  task, onSelect, isSelected, onToggleSelect, showMoveToSprint, sprints, onMoveToSprint,
}: {
  task: Task;
  onSelect: (t: Task) => void;
  isSelected: boolean;
  onToggleSelect?: (id: string) => void;
  showMoveToSprint?: boolean;
  sprints?: Sprint[];
  onMoveToSprint?: (taskId: string, sprintId: string | null) => void;
}) {
  return (
    <tr
      className="backlog-row"
      style={{ background: isSelected ? 'rgba(99,102,241,.08)' : undefined }}
    >
      {onToggleSelect && (
        <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(task.id)}
            style={{ cursor: 'pointer', accentColor: 'var(--accent)', width: 15, height: 15 }}
          />
        </td>
      )}
      <td onClick={() => onSelect(task)}><code style={{ fontSize: 11, color: 'var(--text3)' }}>{task.taskKey}</code></td>
      <td onClick={() => onSelect(task)}><Badge type="type" value={task.type} /></td>
      <td onClick={() => onSelect(task)} style={{ maxWidth: 300, fontSize: 13 }}>{task.title}</td>
      <td onClick={() => onSelect(task)}>
        {task.epic && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: task.epic.color, display: 'inline-block' }} />{task.epic.title}
        </span>}
      </td>
      <td onClick={() => onSelect(task)}><Badge type="priority" value={task.priority} /></td>
      <td onClick={() => onSelect(task)}>{task.column && <span style={{ fontSize: 12, color: 'var(--text2)' }}>{task.column.name}</span>}</td>
      <td onClick={() => onSelect(task)}>
        <span style={{ fontSize: 12, background: 'var(--bg4)', padding: '1px 6px', borderRadius: 4, color: 'var(--text3)' }}>🎯 {task.storyPoints ?? '—'}</span>
      </td>
      <td onClick={() => onSelect(task)}>
        <div className="avatar-stack">
          {task.assignees?.map(a => <Avatar key={a.user.id} name={a.user.name} color={a.user.color} size="sm" />)}
        </div>
      </td>
      {showMoveToSprint && (
        <td>
          <select
            value={task.sprint?.id ?? ''}
            onChange={e => onMoveToSprint?.(task.id, e.target.value || null)}
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer', maxWidth: 140 }}
          >
            <option value="">— Backlog</option>
            {(sprints ?? []).map(s => (
              <option key={s.id} value={s.id}>{s.status === 'ACTIVE' ? '🟢 ' : '📅 '}{s.name}</option>
            ))}
          </select>
        </td>
      )}
    </tr>
  );
});

function TaskTable({
  tasks, onSelect, showMoveToSprint = false, sprints = [], onMoveToSprint,
  selectedIds, onToggleSelect, onToggleAll,
}: {
  tasks: Task[];
  onSelect: (t: Task) => void;
  showMoveToSprint?: boolean;
  sprints?: Sprint[];
  onMoveToSprint?: (taskId: string, sprintId: string | null) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleAll?: () => void;
}) {
  const selectable = !!selectedIds && !!onToggleSelect;
  const allSelected = selectable && tasks.length > 0 && tasks.every(t => selectedIds!.has(t.id));
  const someSelected = selectable && tasks.some(t => selectedIds!.has(t.id));

  if (!tasks.length) return <div style={{ padding: '12px 0', color: 'var(--text3)', fontSize: 13 }}>Nenhum item.</div>;
  return (
    <table className="backlog-table">
      <thead><tr>
        {selectable && (
          <th style={{ width: 36, textAlign: 'center' }}>
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
              onChange={onToggleAll}
              style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
            />
          </th>
        )}
        <th>ID</th><th>Tipo</th><th>Título</th><th>Épico</th><th>Prioridade</th><th>Status</th><th>Pts</th><th>Responsáveis</th>
        {showMoveToSprint && <th>Sprint</th>}
      </tr></thead>
      <tbody>
        {tasks.map(t => (
          <TaskRow
            key={t.id}
            task={t}
            onSelect={onSelect}
            isSelected={selectable ? selectedIds!.has(t.id) : false}
            onToggleSelect={selectable ? onToggleSelect : undefined}
            showMoveToSprint={showMoveToSprint}
            sprints={sprints}
            onMoveToSprint={onMoveToSprint}
          />
        ))}
      </tbody>
    </table>
  );
}
