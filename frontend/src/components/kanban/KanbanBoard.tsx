import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { columnsApi, tasksApi } from '../../api';
import type { Task, KanbanColumn } from '../../types';
import { KanbanColumnComp } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import { TaskDetailModal } from './TaskDetailModal';
import { TaskFormModal } from './TaskFormModal';
import { AddColumnModal } from './AddColumnModal';

interface Props { projectId: string; sprintId?: string; sprintName?: string; }

export function KanbanBoard({ projectId, sprintId, sprintName: _sprintName }: Props) {
  const qc = useQueryClient();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showAddCol, setShowAddCol] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingColId, setEditingColId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data: colsData } = useQuery({
    queryKey: ['columns', projectId],
    queryFn: () => columnsApi.list(projectId).then(r => r.data.data ?? []),
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks', projectId, sprintId],
    queryFn: () => tasksApi.list({ projectId, ...(sprintId ? { sprintId } : {}) }).then(r => r.data.data ?? []),
  });

  const cols = colsData ?? [];
  const tasks = tasksData ?? [];

  const reorderMut = useMutation({
    mutationFn: tasksApi.reorder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
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

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const task = tasks.find(t => t.id === e.active.id);
    if (task) setActiveTask(task);
  }, [tasks]);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    const newColId = String(over.id);
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.column?.id === newColId) return;
    const colTasks = tasks.filter(t => t.column?.id === newColId);
    reorderMut.mutate([{ id: taskId, columnId: newColId, order: colTasks.length }]);
  }, [tasks, reorderMut]);

  const handleRenameCol = useCallback((colId: string, name: string) => {
    updateColMut.mutate({ id: colId, data: { name } });
    setEditingColId(null);
  }, [updateColMut]);

  return (
    <div>
      <div className="page-header">
        <h2>Kanban {sprintId ? '' : '— Backlog Geral'}</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAddCol(true)}>＋ Nova Coluna</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNewTask(true)}>＋ Nova Task</button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 12 }}>
          {cols.map(col => (
            <KanbanColumnComp
              key={col.id}
              column={col}
              tasks={tasks.filter(t => t.column?.id === col.id)}
              onTaskClick={setSelectedTask}
              onRename={handleRenameCol}
              onRemove={(id) => removeColMut.mutate(id)}
              isEditing={editingColId === col.id}
              onStartEdit={() => setEditingColId(col.id)}
              onCancelEdit={() => setEditingColId(null)}
            />
          ))}

          {/* Add column inline button */}
          <div
            onClick={() => setShowAddCol(true)}
            style={{
              width: 200, minHeight: 80, border: '2px dashed var(--border)', borderRadius: 10,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 6, cursor: 'pointer', color: 'var(--text3)', fontSize: 13, flexShrink: 0,
              transition: 'all .15s',
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
        <AddColumnModal
          projectId={projectId}
          onClose={() => setShowAddCol(false)}
          onCreated={() => { setShowAddCol(false); qc.invalidateQueries({ queryKey: ['columns', projectId] }); }}
        />
      )}

      {showNewTask && (
        <TaskFormModal
          projectId={projectId}
          defaultColumnId={cols[0]?.id}
          onClose={() => setShowNewTask(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['tasks', projectId] })}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          projectId={projectId}
          columns={cols}
          onClose={() => setSelectedTask(null)}
          onUpdated={() => qc.invalidateQueries({ queryKey: ['tasks', projectId] })}
        />
      )}

      <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>
        💡 Dica: duplo clique no nome de uma coluna para renomear. Arraste os cards entre colunas para mover.
      </p>
    </div>
  );
}
