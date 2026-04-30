import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../../types';
import { TypeBadge, PriorityBadge } from '../Shared/Badge';
import { AvatarGroup } from '../Shared/Avatar';

interface Props {
  task: Task;
  onClick: (task: Task) => void;
  isDragging?: boolean;
}

export function TaskCard({ task, onClick, isDragging }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortDragging ? 0.4 : 1,
  };

  const doneCriteria  = task.criteria?.filter(c => c.isDone).length ?? 0;
  const totalCriteria = task.criteria?.length ?? 0;
  const isBlocked     = (task._count?.blockedBy ?? (task.blockedBy?.length ?? 0)) > 0;
  const isBlocking    = (task.blocks?.length ?? 0) > 0;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: 'var(--bg3)',
        border: `1px solid ${isDragging ? 'var(--accent)' : isBlocked ? 'rgba(239,68,68,.35)' : 'var(--border)'}`,
        borderLeft: isBlocked ? '3px solid #ef4444' : isDragging ? '3px solid var(--accent)' : undefined,
        borderRadius: 8, padding: 12, cursor: 'grab', transition: 'all .15s',
        boxShadow: isDragging ? '0 8px 24px rgba(99,102,241,.3)' : 'none',
      }}
      {...attributes}
      {...listeners}
      onClick={() => onClick(task)}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = isBlocked ? '#ef4444' : 'var(--accent)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = isBlocked ? 'rgba(239,68,68,.35)' : 'var(--border)';
        (e.currentTarget as HTMLDivElement).style.transform = '';
      }}
    >
      {(isBlocked || isBlocking) && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {isBlocked && (
            <span style={{ fontSize: 10, background: 'rgba(239,68,68,.15)', color: '#ef4444', borderRadius: 3, padding: '1px 6px', fontWeight: 700 }}>
              ⛔ Bloqueada
            </span>
          )}
          {isBlocking && !isBlocked && (
            <span style={{ fontSize: 10, background: 'rgba(249,115,22,.12)', color: '#f97316', borderRadius: 3, padding: '1px 6px', fontWeight: 700 }}>
              🔗 Bloqueia
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>{task.taskKey}</span>
        <TypeBadge type={task.type} />
        <PriorityBadge priority={task.priority} />
      </div>

      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, marginBottom: 8 }}>{task.title}</div>

      {totalCriteria > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ height: 3, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--green)', width: `${Math.round((doneCriteria / totalCriteria) * 100)}%`, borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{doneCriteria}/{totalCriteria} critérios</div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {task.storyPoints != null && (
            <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg4)', padding: '1px 6px', borderRadius: 4 }}>🎯 {task.storyPoints}pts</span>
          )}
          {(task._count?.comments ?? 0) > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>💬 {task._count?.comments}</span>
          )}
          {(task._count?.documents ?? 0) > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>📄 {task._count?.documents}</span>
          )}
        </div>
        <AvatarGroup users={task.assignees.map(a => a.user)} max={3} size="sm" />
      </div>
    </div>
  );
}
