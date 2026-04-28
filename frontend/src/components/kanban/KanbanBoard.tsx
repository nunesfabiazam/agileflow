import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { columnsApi, tasksApi } from '../../api';
import { useAppStore } from '../../store/useAppStore';
import type { Task, KanbanColumn } from '../../types';
import { KanbanColumnComp } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import { TaskDetailModal } from './TaskDetailModal';
import { TaskFormModal } from './TaskFormModal';
import { AddColumnModal } from './AddColumnModal';
import { KanbanFilterBar, FilterState, EMPTY_FILTERS } from './KanbanFilterBar';

interface Props { projectId: string; sprintId?: string; sprintName?: string; }

export function KanbanBoard({ projectId, sprintId }: Props) {
  const qc = useQueryClient();
  const user = useAppStore(s => s.user);
  const [activeTask,   setActiveTask]   = useState<Task | null>(null);
  const [activeCol,    setActiveCol]    = useState<KanbanColumn | null>(null);
  const [overColId,    setOverColId]    = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showAddCol,   setShowAddCol]   = useState(false);
  const [showNewTask,  setShowNewTask]  = useState(false);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [filters,      setFilters]      = useState<FilterState>(EMPTY_FILTERS);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data: colsData } = useQuery({
    queryKey: ['columns', projectId],
    queryFn: () => columnsApi.list(projectId).then(r => r.data.data ?? []),
    staleTime: 2 * 60_000,
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks', projectId, sprintId],
    queryFn: () => tasksApi.list({ projectId, ...(sprintId ? { sprintId } : {}) }).then(r => r.data.data ?? []),
  });

  const cols  = (colsData  ?? []) as KanbanColumn[];
  const tasks = (tasksData ?? []) as Task[];

  const filteredTasks = useMemo(() => {
    return tasks.filter((task: Task) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !(task.taskKey?.toLowerCase().includes(q))) return false;
      }
      if (filters.myTasks && user?.id) {
        if (!task.assignees.some(a => a.user.id === user.id)) return false;
      }
      if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) return false;
      if (filters.types.length > 0 && !filters.types.includes(task.type)) return false;
      if (filters.epicId && task.epic?.id !== filters.epicId) return false;
      return true;
    });
  }, [tasks, filters, user?.id]);

  const hasActiveFilter = filters.search || filters.myTasks
    || filters.priorities.length > 0 || filters.types.length > 0 || filters.epicId;

  // ── Task reorder mutation ──────────────────────────────────────────────────
  const reorderMut = useMutation({
    mutationFn: tasksApi.reorder,
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: ['tasks', projectId] });
      const prevEntries = qc.getQueriesData<Task[]>({ queryKey: ['tasks', projectId] });
      qc.setQueriesData<Task[]>({ queryKey: ['tasks', projectId] }, (old) => {
        if (!old) return old;
        return old.map((t: Task) => {
          const u = updates.find(u => u.id === t.id);
          if (!u) return t;
          const newCol = cols.find(c => c.id === u.columnId);
          return { ...t, column: newCol ?? t.column, columnId: u.columnId, order: u.order };
        });
      });
      return { prevEntries };
    },
    onError: (_err: any, _vars: any, ctx: any) => {
      ctx?.prevEntries?.forEach(([key, data]: [any, any]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  // ── Column reorder mutation ────────────────────────────────────────────────
  const reorderColMut = useMutation({
    mutationFn: columnsApi.reorder,
    onError: () => qc.invalidateQueries({ queryKey: ['columns', projectId] }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['columns', projectId] }),
  });

  const updateColMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<KanbanColumn> }) => columnsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['columns', projectId] }),
  });

  const removeColMut = useMutation({
    mutationFn: columnsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['columns', projectId] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  // over.id can be a column id OR a task id inside a column
  const resolveColId = useCallback((overId: string): string | null => {
    if (cols.find(c => c.id === overId)) return overId;
    const overTask = tasks.find((t: Task) => t.id === overId);
    return overTask?.column?.id ?? null;
  }, [cols, tasks]);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const type = (e.active.data.current as any)?.type;
    if (type === 'column') {
      const col = cols.find(c => c.id === String(e.active.id));
      if (col) { setActiveCol(col); return; }
    }
    const task = tasks.find((t: Task) => t.id === String(e.active.id));
    if (task) setActiveTask(task);
  }, [tasks, cols]);

  const handleDragOver = useCallback((e: DragOverEvent) => {
    // skip column drags — we don't want overColId highlighted when reordering columns
    if ((e.active.data.current as any)?.type === 'column') return;
    if (!e.over) { setOverColId(null); return; }
    setOverColId(resolveColId(String(e.over.id)));
  }, [resolveColId]);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    setActiveTask(null);
    setActiveCol(null);
    setOverColId(null);
    if (!over) return;

    const type = (active.data.current as any)?.type;

    // ── Column reorder ───────────────────────────────────────────────────────
    if (type === 'column') {
      const oldIndex = cols.findIndex(c => c.id === String(active.id));
      const newIndex = cols.findIndex(c => c.id === String(over.id));
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const newCols = arrayMove([...cols], oldIndex, newIndex);
      // Optimistic update
      qc.setQueryData(['columns', projectId], newCols.map((c, i) => ({ ...c, order: i })));
      reorderColMut.mutate(newCols.map((c, i) => ({ id: c.id, order: i })));
      return;
    }

    // ── Task move ───────────────────────────────────────────────────────────
    const taskId   = String(active.id);
    const newColId = resolveColId(String(over.id));
    if (!newColId) return;
    const task = tasks.find((t: Task) => t.id === taskId);
    if (!task || task.column?.id === newColId) return;
    const colTasks = tasks.filter((t: Task) => t.column?.id === newColId);
    reorderMut.mutate([{ id: taskId, columnId: newColId, order: colTasks.length }]);
  }, [tasks, cols, reorderMut, reorderColMut, resolveColId, qc, projectId]);

  const handleRenameCol = useCallback((colId: string, name: string) => {
    updateColMut.mutate({ id: colId, data: { name } });
    setEditingColId(null);
  }, [updateColMut]);

  return (
    <div>
      <div className="page-header">
        <h2>Kanban {sprintId ? '' : '— Backlog Geral'}</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasActiveFilter && (
            <span style={{ fontSize: 11, background: 'rgba(99,102,241,.15)', color: 'var(--accent2)', borderRadius: 12, padding: '2px 8px', fontWeight: 600 }}>
              {filteredTasks.length}/{tasks.length} tarefas
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAddCol(true)}>＋ Nova Coluna</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNewTask(true)}>＋ Nova Task</button>
        </div>
      </div>

      <KanbanFilterBar projectId={projectId} filters={filters} onChange={setFilters} />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <SortableContext items={cols.map(c => c.id)} strategy={horizontalListSortingStrategy}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 12 }}>
            {cols.map((col: KanbanColumn) => (
              <KanbanColumnComp
                key={col.id}
                column={col}
                tasks={filteredTasks.filter((t: Task) => t.column?.id === col.id)}
                onTaskClick={setSelectedTask}
                onRename={handleRenameCol}
                onRemove={(id) => removeColMut.mutate(id)}
                isEditing={editingColId === col.id}
                onStartEdit={() => setEditingColId(col.id)}
                onCancelEdit={() => setEditingColId(null)}
                isDragOver={overColId === col.id && !activeCol}
              />
            ))}

            <div
              onClick={() => setShowAddCol(true)}
              style={{
                width: 200, minHeight: 80, border: '2px dashed var(--border)', borderRadius: 10,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 6, cursor: 'pointer', color: 'var(--text3)', fontSize: 13, flexShrink: 0, transition: 'all .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.color = 'var(--accent2)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.color = 'var(--text3)'; }}
            >
              <span style={{ fontSize: 22 }}>＋</span>
              <span>Adicionar Coluna</span>
            </div>
          </div>
        </SortableContext>

        <DragOverlay>
          {activeCol
            ? <ColumnDragGhost column={activeCol} taskCount={filteredTasks.filter(t => t.column?.id === activeCol.id).length} />
            : activeTask
            ? <TaskCard task={activeTask} onClick={() => {}} isDragging />
            : null}
        </DragOverlay>
      </DndContext>

      {showAddCol && (
        <AddColumnModal projectId={projectId} onClose={() => setShowAddCol(false)}
          onCreated={() => { setShowAddCol(false); qc.invalidateQueries({ queryKey: ['columns', projectId] }); }} />
      )}
      {showNewTask && (
        <TaskFormModal projectId={projectId} defaultColumnId={cols[0]?.id}
          onClose={() => setShowNewTask(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['tasks', projectId] })} />
      )}
      {selectedTask && (
        <TaskDetailModal task={selectedTask} projectId={projectId} columns={cols}
          onClose={() => setSelectedTask(null)}
          onUpdated={() => qc.invalidateQueries({ queryKey: ['tasks', projectId] })} />
      )}

      <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>
        💡 Dica: arraste pelo ícone ⠿ no cabeçalho para reordenar colunas. Duplo clique no nome para renomear.
      </p>
    </div>
  );
}

// Ghost preview rendered inside DragOverlay while a column is being dragged
function ColumnDragGhost({ column, taskCount }: { column: KanbanColumn; taskCount: number }) {
  return (
    <div style={{
      width: 280, background: 'var(--bg2)', borderRadius: 10,
      border: `2px solid var(--accent)`, flexShrink: 0,
      opacity: 0.85, boxShadow: '0 12px 32px rgba(99,102,241,.35)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: column.color, flexShrink: 0 }} />
        <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{column.name}</span>
        <span style={{ background: 'var(--bg4)', color: 'var(--text3)', fontSize: 11, padding: '1px 7px', borderRadius: 10 }}>{taskCount}</span>
      </div>
      <div style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 12, textAlign: 'center' }}>
        {taskCount} {taskCount === 1 ? 'card' : 'cards'}
      </div>
    </div>
  );
}
