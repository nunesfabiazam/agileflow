interface Props { type: 'type' | 'priority' | 'status'; value: string; }

const TYPE_MAP: Record<string, { label: string; cls: string }> = {
  STORY:   { label: 'História', cls: 'badge-story' },
  BUG:     { label: 'Bug',      cls: 'badge-bug'   },
  TASK:    { label: 'Task',     cls: 'badge-task'  },
  SPIKE:   { label: 'Spike',   cls: 'badge-spike' },
  EPIC:    { label: 'Épico',   cls: 'badge-epic'  },
  SUBTASK: { label: 'Sub',     cls: 'badge-subtask'},
};
const PRIORITY_MAP: Record<string, { label: string; cls: string }> = {
  CRITICAL: { label: 'Crítica', cls: 'badge-critical' },
  HIGH:     { label: 'Alta',    cls: 'badge-high'     },
  MEDIUM:   { label: 'Média',   cls: 'badge-medium'   },
  LOW:      { label: 'Baixa',   cls: 'badge-low'      },
};

export function Badge({ type, value }: Props) {
  const map = type === 'type' ? TYPE_MAP : PRIORITY_MAP;
  const entry = map[value];
  if (!entry) return null;
  return <span className={`badge ${entry.cls}`}>{entry.label}</span>;
}
