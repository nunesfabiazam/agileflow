import { useState, useRef, useEffect } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { KanbanColumn, Task } from '../../types';
import { TaskCard } from './TaskCard';

interface Props {
  column: KanbanColumn;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onRename: (colId: string, name: string) => void;
  onRemove: (colId: string) => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  isDragOver?: boolean;
}

export function KanbanColumnComp({
  column, tasks, onTaskClick, onRename, onRemove,
  isEditing, onStartEdit, onCancelEdit, isDragOver,
}: Props) {
  const [label, setLabel] = useState(column.name);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // useSortable makes this column both draggable (for reorder) and droppable (for task drops)
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'column' },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing]);
  useEffect(() => { setLabel(column.name); }, [column.name]);

  const commit = () => { if (label.trim()) onRename(column.id, label.trim()); else onCancelEdit(); };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        width: 280,
        background: isDragOver ? 'var(--bg3)' : 'var(--bg2)',
        borderRadius: 10,
        border: `1px solid ${isDragOver ? 'var(--accent)' : 'var(--border)'}`,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--border)' }}>

        {/* Drag handle — grab here to reorder column */}
        <div
          {...attributes}
          {...listeners}
          title="Arrastar para reordenar"
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
            color: 'var(--text3)',
            fontSize: 14,
            padding: '2px 3px',
            borderRadius: 3,
            flexShrink: 0,
            lineHeight: 1,
            userSelect: 'none',
            opacity: 0.4,
            transition: 'opacity .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
        >⠿</div>

        <div style={{ width: 10, height: 10, borderRadius: '50%', background: column.color, flexShrink: 0 }} />

        {isEditing ? (
          <input
            ref={inputRef}
            value={label}
            onChange={e => setLabel(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancelEdit(); }}
            style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '2px 6px', background: 'var(--bg4)', border: '1px solid var(--accent)', borderRadius: 4 }}
          />
        ) : (
          <span
            style={{ flex: 1, fontWeight: 600, fontSize: 13, cursor: 'text' }}
            onDoubleClick={onStartEdit}
            title="Duplo clique para renomear"
          >{column.name}</span>
        )}

        <span style={{ background: 'var(--bg4)', color: 'var(--text3)', fontSize: 11, padding: '1px 7px', borderRadius: 10 }}>{tasks.length}</span>
        <button onClick={onStartEdit} className="btn btn-sm" style={{ padding: '2px 4px', fontSize: 11, color: 'var(--text3)' }} title="Renomear">✏️</button>
        <button onClick={() => setConfirmRemove(true)} className="btn btn-sm" style={{ padding: '2px 4px', fontSize: 11, color: 'var(--text3)' }} title="Remover">🗑️</button>
      </div>

      {/* Cards */}
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60 }}>
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(t => <TaskCard key={t.id} task={t} onClick={onTaskClick} />)}
        </SortableContext>
        {tasks.length === 0 && (
          <div style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Vazio</div>
        )}
      </div>

      {/* Confirm remove */}
      {confirmRemove && (
        <div style={{ padding: '12px 14px', background: 'var(--bg4)', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Remover coluna "{column.name}"? Tasks serão movidas para o backlog.</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-danger btn-sm" onClick={() => { onRemove(column.id); setConfirmRemove(false); }}>Remover</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmRemove(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
