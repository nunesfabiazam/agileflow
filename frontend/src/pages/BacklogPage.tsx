import { useAppStore } from '../store/useAppStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, sprintsApi, columnsApi, epicsApi } from '../api';
import type { Task, Sprint, KanbanColumn, Epic } from '../types';
import { Badge } from '../components/Shared/Badge';
import { Avatar } from '../components/Shared/Avatar';
import { useState, useCallback, memo, useMemo } from 'react';
import { TaskDetailModal } from '../components/kanban/TaskDetailModal';

const TYPES     = ['STORY','BUG','TASK','SPIKE','EPIC','SUBTASK'];
const TYPE_LABEL: Record<string,string> = { STORY:'História', BUG:'Bug', TASK:'Tarefa', SPIKE:'Spike', EPIC:'Épico', SUBTASK:'Subtarefa' };
const PRIORITIES = ['CRITICAL','HIGH','MEDIUM','LOW'];
const PRIO_LABEL: Record<string,string> = { CRITICAL:'Crítica', HIGH:'Alta', MEDIUM:'Média', LOW:'Baixa' };

const STATUS_LABEL: Record<string, string> = {
  PLANNING: 'Planejado', ACTIVE: 'Ativa', COMPLETED: 'Concluída', CANCELLED: 'Cancelada',
};

export function BacklogPage() {
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const qc = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<'backlog' | 'archive'>('backlog');

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [filterSearch,   setFilterSearch]   = useState('');
  const [filterType,     setFilterType]     = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterEpic,     setFilterEpic]     = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const hasFilter = !!(filterSearch || filterType || filterPriority || filterEpic || filterAssignee || filterStatus);
  const clearFilters = () => { setFilterSearch(''); setFilterType(''); setFilterPriority(''); setFilterEpic(''); setFilterAssignee(''); setFilterStatus(''); };

  const [showNewSprint, setShowNewSprint] = useState(false);
  const [newSprint, setNewSprint] = useState({ name: '', goal: '', startDate: '', endDate: '' });
  const [showComplete, setShowComplete] = useState<string | null>(null);
  const [moveToSprintId, setMoveToSprintId] = useState('');

  // ── Bulk selection ──────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const { data: columns = [] } = useQuery<KanbanColumn[]>({
    queryKey: ['columns', activeProjectId],
    queryFn: () => columnsApi.list(activeProjectId!).then(r => r.data.data ?? []),
    enabled: !!activeProjectId,
  });

  const { data: epics = [] } = useQuery<Epic[]>({
    queryKey: ['epics', activeProjectId],
    queryFn: () => epicsApi.list(activeProjectId!).then(r => r.data.data ?? []),
    enabled: !!activeProjectId,
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks', activeProjectId],
    queryFn: () => tasksApi.list({ projectId: activeProjectId!, limit: '500' }).then(r => r.data.data ?? []),
    enabled: !!activeProjectId,
  });

  const { data: archivedTasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks-archived', activeProjectId],
    queryFn: () => tasksApi.list({ projectId: activeProjectId!, limit: '500', archived: 'true' }).then(r => r.data.data ?? []),
    enabled: !!activeProjectId && viewMode === 'archive',
  });

  const invalidateTasks = () => {
    qc.invalidateQueries({ queryKey: ['tasks', activeProjectId] });
    qc.invalidateQueries({ queryKey: ['tasks-archived', activeProjectId] });
  };

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
      invalidateTasks();
      setShowComplete(null);
      setMoveToSprintId('');
    },
  });

  const deleteSprintMut = useMutation({
    mutationFn: sprintsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', activeProjectId] });
      invalidateTasks();
    },
  });

  // ── Single task move — optimistic update ───────────────────────────────────
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
    onSettled: () => invalidateTasks(),
  });

  // ── Bulk fields state ───────────────────────────────────────────────────────
  const [bulkSprintId,   setBulkSprintId]   = useState('');
  const [bulkColumnId,   setBulkColumnId]   = useState('');
  const [bulkPriority,   setBulkPriority]   = useState('');
  const [bulkType,       setBulkType]       = useState('');
  const [bulkEpicId,     setBulkEpicId]     = useState('');

  const hasBulkChange = !!(bulkSprintId || bulkColumnId || bulkPriority || bulkType || bulkEpicId);

  const clearBulk = () => {
    setBulkSprintId(''); setBulkColumnId(''); setBulkPriority('');
    setBulkType(''); setBulkEpicId('');
  };

  // ── Bulk update mutation ────────────────────────────────────────────────────
  const bulkMoveMut = useMutation({
    mutationFn: ({ ids, data }: { ids: string[]; data: Record<string, any> }) =>
      tasksApi.bulkUpdate(ids, data),
    onSettled: () => {
      invalidateTasks();
      clearSelection();
      clearBulk();
    },
  });

  const bulkArchiveMut = useMutation({
    mutationFn: (ids: string[]) => tasksApi.bulkUpdate(ids, { isArchived: true }),
    onSettled: () => { invalidateTasks(); clearSelection(); },
  });

  const bulkRestoreMut = useMutation({
    mutationFn: (ids: string[]) => tasksApi.bulkUpdate(ids, { isArchived: false }),
    onSettled: () => { invalidateTasks(); clearSelection(); },
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: string[]) => tasksApi.bulkDelete(ids),
    onSettled: () => { invalidateTasks(); clearSelection(); },
  });

  // ── Derived filter options ──────────────────────────────────────────────────
  const epicOptions = useMemo(() => {
    const seen = new Map<string, string>();
    tasks.forEach(t => { if (t.epic) seen.set(t.epic.id, t.epic.title); });
    return [...seen.entries()];
  }, [tasks]);

  const assigneeOptions = useMemo(() => {
    const seen = new Map<string, { name: string; color: string }>();
    tasks.forEach(t => t.assignees?.forEach(a => { if (!seen.has(a.user.id)) seen.set(a.user.id, { name: a.user.name, color: a.user.color }); }));
    return [...seen.entries()];
  }, [tasks]);

  const statusOptions = useMemo(() => {
    const seen = new Map<string, string>();
    tasks.forEach(t => { if (t.column) seen.set(t.column.name, t.column.name); });
    return [...seen.keys()].sort();
  }, [tasks]);

  // ── Apply filters ───────────────────────────────────────────────────────────
  const filteredTasks = useMemo(() => tasks.filter(t => {
    if (filterSearch   && !t.title.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    if (filterType     && t.type !== filterType)       return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterEpic     && t.epic?.id !== filterEpic)   return false;
    if (filterAssignee && !t.assignees?.some(a => a.user.id === filterAssignee)) return false;
    if (filterStatus   && t.column?.name !== filterStatus) return false;
    return true;
  }), [tasks, filterSearch, filterType, filterPriority, filterEpic, filterAssignee, filterStatus]);

  if (!activeProjectId) {
    return <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-text">Selecione um projeto para ver o backlog.</div></div>;
  }

  const backlogTasks    = filteredTasks.filter(t => !t.sprint);
  const activeSprints   = (sprints as Sprint[]).filter(s => s.status === 'ACTIVE');
  const planningSprints = (sprints as Sprint[]).filter(s => s.status === 'PLANNING');
  const completedSprints = (sprints as Sprint[]).filter(s => s.status === 'COMPLETED');
  const targetSprints   = [...activeSprints, ...planningSprints];

  const completingSprint      = showComplete ? (sprints as Sprint[]).find(s => s.id === showComplete) : null;
  const completingSprintTasks = showComplete ? tasks.filter(t => t.sprint?.id === showComplete) : [];
  const incompleteTasks       = completingSprintTasks.filter(t => !t.column?.isDefault);
  const otherSprints          = (sprints as Sprint[]).filter(s => s.id !== showComplete && s.status !== 'COMPLETED');

  const backlogIds = backlogTasks.map(t => t.id);
  const selectedCount = [...selectedIds].filter(id =>
    (viewMode === 'archive' ? archivedTasks : backlogTasks).some(t => t.id === id)
  ).length;

  // ── Archive view ────────────────────────────────────────────────────────────
  if (viewMode === 'archive') {
    const archiveIds = archivedTasks.map(t => t.id);
    return (
      <div>
        <div className="page-header">
          <h2>📦 Arquivo de Tasks</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setViewMode('backlog'); clearSelection(); }}>← Voltar ao Backlog</button>
          </div>
        </div>

        <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>
          Tasks arquivadas não aparecem no backlog nem no kanban. Você pode restaurá-las ou excluí-las permanentemente.
        </p>

        {/* Bulk bar for archive */}
        {selectedCount > 0 && (
          <div style={{
            background: 'rgba(99,102,241,.08)', border: '1px solid var(--accent)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
              {selectedCount} {selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
            </span>
            <div style={{ flex: 1 }} />
            <button className="btn btn-ghost btn-sm" onClick={clearSelection}>✕ Cancelar</button>
            <button
              className="btn btn-sm"
              style={{ background: 'rgba(34,197,94,.12)', color: 'var(--green)', border: '1px solid rgba(34,197,94,.3)' }}
              disabled={bulkRestoreMut.isPending}
              onClick={() => { if (confirm(`Restaurar ${selectedCount} task(s) para o backlog?`)) bulkRestoreMut.mutate([...selectedIds].filter(id => archiveIds.includes(id))); }}
            >
              ♻️ Restaurar
            </button>
            <button
              className="btn btn-sm"
              style={{ background: 'rgba(239,68,68,.12)', color: 'var(--red)', border: '1px solid rgba(239,68,68,.3)' }}
              disabled={bulkDeleteMut.isPending}
              onClick={() => { if (confirm(`Excluir permanentemente ${selectedCount} task(s)? Esta ação não pode ser desfeita.`)) bulkDeleteMut.mutate([...selectedIds].filter(id => archiveIds.includes(id))); }}
            >
              🗑 Excluir
            </button>
          </div>
        )}

        {archivedTasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <div className="empty-text">Nenhuma task arquivada.</div>
          </div>
        ) : (
          <TaskTable
            tasks={archivedTasks}
            onSelect={setSelectedTask}
            showMoveToSprint={false}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleAll={() => toggleAll(archiveIds)}
          />
        )}

        {selectedTask && <TaskDetailModal task={selectedTask} projectId={activeProjectId} onClose={() => setSelectedTask(null)} />}
      </div>
    );
  }

  // ── Normal backlog view ─────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <h2>📋 Backlog do Produto</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setViewMode('archive'); clearSelection(); }}>📦 Arquivo</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNewSprint(true)}>+ Nova Sprint</button>
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        padding: '10px 14px', marginBottom: 20,
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 160, maxWidth: 280 }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: .5 }}>🔍</span>
          <input
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            placeholder="Buscar por título..."
            style={{ width: '100%', paddingLeft: 30, fontSize: 13, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text1)', boxSizing: 'border-box' }}
          />
        </div>

        {/* Type */}
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ fontSize: 12, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: filterType ? 'rgba(99,102,241,.15)' : 'var(--bg3)', color: 'var(--text2)', padding: '0 8px', cursor: 'pointer' }}>
          <option value="">Tipo</option>
          {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>

        {/* Priority */}
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          style={{ fontSize: 12, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: filterPriority ? 'rgba(99,102,241,.15)' : 'var(--bg3)', color: 'var(--text2)', padding: '0 8px', cursor: 'pointer' }}>
          <option value="">Prioridade</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{PRIO_LABEL[p]}</option>)}
        </select>

        {/* Epic */}
        {epicOptions.length > 0 && (
          <select value={filterEpic} onChange={e => setFilterEpic(e.target.value)}
            style={{ fontSize: 12, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: filterEpic ? 'rgba(99,102,241,.15)' : 'var(--bg3)', color: 'var(--text2)', padding: '0 8px', cursor: 'pointer', maxWidth: 160 }}>
            <option value="">Épico</option>
            {epicOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
        )}

        {/* Assignee */}
        {assigneeOptions.length > 0 && (
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
            style={{ fontSize: 12, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: filterAssignee ? 'rgba(99,102,241,.15)' : 'var(--bg3)', color: 'var(--text2)', padding: '0 8px', cursor: 'pointer', maxWidth: 160 }}>
            <option value="">Responsável</option>
            {assigneeOptions.map(([id, u]) => <option key={id} value={id}>{u.name}</option>)}
          </select>
        )}

        {/* Status */}
        {statusOptions.length > 0 && (
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ fontSize: 12, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: filterStatus ? 'rgba(99,102,241,.15)' : 'var(--bg3)', color: 'var(--text2)', padding: '0 8px', cursor: 'pointer', maxWidth: 160 }}>
            <option value="">Status</option>
            {statusOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        )}

        {/* Result count + clear */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {hasFilter && (
            <>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {filteredTasks.length} de {tasks.length} item{tasks.length !== 1 ? 's' : ''}
              </span>
              <button onClick={clearFilters}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text3)', cursor: 'pointer' }}>
                ✕ Limpar filtros
              </button>
            </>
          )}
          {!hasFilter && (
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{tasks.length} item{tasks.length !== 1 ? 's' : ''} no total</span>
          )}
        </div>
      </div>

      {[...activeSprints, ...planningSprints, ...completedSprints].map(sprint => {
        const sprintTasks = filteredTasks.filter(t => t.sprint?.id === sprint.id);
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
            background: 'rgba(99,102,241,.08)', border: '1px solid var(--accent)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 12,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                ✏️ {selectedCount} {selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>— escolha os campos a alterar:</span>
              <div style={{ flex: 1 }} />
              <button className="btn btn-ghost btn-sm" onClick={() => { clearSelection(); clearBulk(); }}>✕ Cancelar seleção</button>
            </div>

            {/* Field selectors */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {/* Status */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Status</span>
                <select value={bulkColumnId} onChange={e => setBulkColumnId(e.target.value)}
                  style={{ fontSize: 12, height: 32, borderRadius: 7, border: `1px solid ${bulkColumnId ? 'var(--accent)' : 'var(--border)'}`, background: bulkColumnId ? 'rgba(99,102,241,.15)' : 'var(--bg3)', color: 'var(--text2)', padding: '0 8px', cursor: 'pointer', minWidth: 140 }}>
                  <option value="">— não alterar —</option>
                  {(columns as KanbanColumn[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Priority */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Prioridade</span>
                <select value={bulkPriority} onChange={e => setBulkPriority(e.target.value)}
                  style={{ fontSize: 12, height: 32, borderRadius: 7, border: `1px solid ${bulkPriority ? 'var(--accent)' : 'var(--border)'}`, background: bulkPriority ? 'rgba(99,102,241,.15)' : 'var(--bg3)', color: 'var(--text2)', padding: '0 8px', cursor: 'pointer', minWidth: 120 }}>
                  <option value="">— não alterar —</option>
                  {PRIORITIES.map(p => <option key={p} value={p}>{PRIO_LABEL[p]}</option>)}
                </select>
              </div>

              {/* Type */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Tipo</span>
                <select value={bulkType} onChange={e => setBulkType(e.target.value)}
                  style={{ fontSize: 12, height: 32, borderRadius: 7, border: `1px solid ${bulkType ? 'var(--accent)' : 'var(--border)'}`, background: bulkType ? 'rgba(99,102,241,.15)' : 'var(--bg3)', color: 'var(--text2)', padding: '0 8px', cursor: 'pointer', minWidth: 120 }}>
                  <option value="">— não alterar —</option>
                  {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </div>

              {/* Epic */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Épico</span>
                <select value={bulkEpicId} onChange={e => setBulkEpicId(e.target.value)}
                  style={{ fontSize: 12, height: 32, borderRadius: 7, border: `1px solid ${bulkEpicId ? 'var(--accent)' : 'var(--border)'}`, background: bulkEpicId ? 'rgba(99,102,241,.15)' : 'var(--bg3)', color: 'var(--text2)', padding: '0 8px', cursor: 'pointer', minWidth: 140 }}>
                  <option value="">— não alterar —</option>
                  <option value="__none__">🚫 Remover épico</option>
                  {(epics as Epic[]).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                </select>
              </div>

              {/* Sprint */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Sprint</span>
                <select value={bulkSprintId} onChange={e => setBulkSprintId(e.target.value)}
                  style={{ fontSize: 12, height: 32, borderRadius: 7, border: `1px solid ${bulkSprintId ? 'var(--accent)' : 'var(--border)'}`, background: bulkSprintId ? 'rgba(99,102,241,.15)' : 'var(--bg3)', color: 'var(--text2)', padding: '0 8px', cursor: 'pointer', minWidth: 160 }}>
                  <option value="">— não alterar —</option>
                  <option value="__backlog__">📋 Mover para backlog</option>
                  {targetSprints.map(s => <option key={s.id} value={s.id}>{s.status === 'ACTIVE' ? '🟢 ' : '📅 '}{s.name}</option>)}
                </select>
              </div>
            </div>

            {/* Apply button + archive/delete actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!hasBulkChange && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Selecione ao menos um campo para alterar.</span>}
              {hasBulkChange && (
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Alterando: {[bulkColumnId && 'status', bulkPriority && 'prioridade', bulkType && 'tipo', bulkEpicId && 'épico', bulkSprintId && 'sprint'].filter(Boolean).join(', ')}
                </span>
              )}
              <div style={{ flex: 1 }} />

              {/* Archive */}
              <button
                className="btn btn-sm"
                style={{ background: 'rgba(251,191,36,.1)', color: 'var(--yellow)', border: '1px solid rgba(251,191,36,.3)' }}
                disabled={bulkArchiveMut.isPending}
                onClick={() => { if (confirm(`Arquivar ${selectedCount} task(s)? Elas poderão ser restauradas na seção Arquivo.`)) bulkArchiveMut.mutate([...selectedIds].filter(id => backlogIds.includes(id))); }}
              >
                📦 Arquivar
              </button>

              {/* Delete */}
              <button
                className="btn btn-sm"
                style={{ background: 'rgba(239,68,68,.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,.3)' }}
                disabled={bulkDeleteMut.isPending}
                onClick={() => { if (confirm(`Excluir permanentemente ${selectedCount} task(s)? Esta ação não pode ser desfeita.`)) bulkDeleteMut.mutate([...selectedIds].filter(id => backlogIds.includes(id))); }}
              >
                🗑 Excluir
              </button>

              {hasBulkChange && (
                <button className="btn btn-ghost btn-sm" onClick={clearBulk}>↩ Limpar campos</button>
              )}
              <button
                className="btn btn-primary btn-sm"
                disabled={!hasBulkChange || bulkMoveMut.isPending}
                onClick={() => {
                  const data: Record<string, any> = {};
                  if (bulkColumnId)  data.columnId  = bulkColumnId;
                  if (bulkPriority)  data.priority  = bulkPriority;
                  if (bulkType)      data.type      = bulkType;
                  if (bulkEpicId)    data.epicId    = bulkEpicId === '__none__' ? null : bulkEpicId;
                  if (bulkSprintId)  data.sprintId  = bulkSprintId === '__backlog__' ? null : bulkSprintId;
                  bulkMoveMut.mutate({ ids: [...selectedIds], data });
                }}
              >
                {bulkMoveMut.isPending ? 'Aplicando...' : `✓ Aplicar em ${selectedCount} ${selectedCount === 1 ? 'item' : 'itens'}`}
              </button>
            </div>
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
            onMoveToSprint={(taskId, sprintId) => moveTaskMut.mutate({ taskId, sprintId: sprintId })}
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

// ── Memoized row ───────────────────────────────────────────────────────────────
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
    <tr className="backlog-row" style={{ background: isSelected ? 'rgba(99,102,241,.08)' : undefined }}>
      {onToggleSelect && (
        <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(task.id)}
            style={{ cursor: 'pointer', accentColor: 'var(--accent)', width: 15, height: 15 }} />
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
          <select value={task.sprint?.id ?? ''} onChange={e => onMoveToSprint?.(task.id, e.target.value || null)}
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer', maxWidth: 140 }}>
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
            <input type="checkbox" checked={allSelected}
              ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
              onChange={onToggleAll} style={{ cursor: 'pointer', accentColor: 'var(--accent)' }} />
          </th>
        )}
        <th>ID</th><th>Tipo</th><th>Título</th><th>Épico</th><th>Prioridade</th><th>Status</th><th>Pts</th><th>Responsáveis</th>
        {showMoveToSprint && <th>Sprint</th>}
      </tr></thead>
      <tbody>
        {tasks.map(t => (
          <TaskRow key={t.id} task={t} onSelect={onSelect}
            isSelected={selectable ? selectedIds!.has(t.id) : false}
            onToggleSelect={selectable ? onToggleSelect : undefined}
            showMoveToSprint={showMoveToSprint} sprints={sprints} onMoveToSprint={onMoveToSprint}
          />
        ))}
      </tbody>
    </table>
  );
}
