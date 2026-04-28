import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
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
  const [overColId,    setOverColId]    = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showAddCol, setShowAddCol] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data: colsData } = useQuery({
    queryKey: ['columns', projectId],
    queryFn: () => columnsApi.list(projectId).then(r => r.data.data ?? []),
    staleTime: 2 * 60_000, // columns rarely change — cache for 2 min
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks', projectId, sprintId],
    queryFn: () => tasksApi.list({ projectId, ...(sprintId ? { sprintId } : {}) }).then(r => r.data.data ?? []),
  });

  const cols = colsData ?? [];
  const tasks = tasksData ?? [];

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

  const reorderMut = useMutation({
    mutationFn: tasksApi.reorder,
    onMutate: async (updates) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await qc.cancelQueries({ queryKey: ['tasks', projectId] });
      // Snapshot all matching task caches
      const prevEntries = qc.getQueriesData<Task[]>({ queryKey: ['tasks', projectId] });
      // Apply optimistic update to every matching cache entry
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
      // Rollback all cache entries on error
      ctx?.prevEntries?.forEach(([key, data]: [any, any]) => {
        qc.setQueryData(key, data);
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
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

  // Resolve over.id → column id (over can be a column OR a task inside a column)
  const resolveColId = useCallback((overId: string): string | null => {
    if (cols.find(c => c.id === overId)) return overId;           // dropped on column
    const overTask = tasks.find((t: Task) => t.id === overId);
    return overTask?.column?.id ?? null;                          // dropped on a task
  }, [cols, tasks]);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const task = tasks.find((t: Task) => t.id === e.active.id);
    if (task) setActiveTask(task);
  }, [tasks]);

  const handleDragOver = useCallback((e: DragOverEvent) => {
    if (!e.over) { setOverColId(null); return; }
    setOverColId(resolveColId(String(e.over.id)));
  }, [resolveColId]);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveTask(null);
    setOverColId(null);
    const { active, over } = e;
    if (!over) return;

    const taskId   = String(active.id);
    const newColId = resolveColId(String(over.id));
    if (!newColId) return;

    const task = tasks.find((t: Task) => t.id === taskId);
    if (!task || task.column?.id === newColId) return;

    const colTasks = tasks.filter((t: Task) => t.column?.id === newColId);
    reorderMut.mutate([{ id: taskId, columnId: newColId, order: colTasks.length }]);
  }, [tasks, cols, reorderMut, resolveColId]);

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
              isDragOver={overColId === col.id}
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

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} onClick={() => {}} isDragging /> : null}
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
        💡 Dica: duplo clique no nome de uma coluna para renomear. Arraste os cards entre colunas para mover.
      </p>
    </div>
  );
}
