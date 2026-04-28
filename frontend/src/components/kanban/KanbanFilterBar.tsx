import { useQuery } from '@tanstack/react-query';
import { epicsApi } from '../../api';

export interface FilterState {
  search: string;
  myTasks: boolean;
  priorities: string[];
  types: string[];
  epicId: string;
}

export const EMPTY_FILTERS: FilterState = {
  search: '', myTasks: false, priorities: [], types: [], epicId: '',
};

interface Props {
  projectId: string;
  filters: FilterState;
  onChange: (f: FilterState) => void;
}

const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: '🔴 Crítica', HIGH: '🟠 Alta', MEDIUM: '🟡 Média', LOW: '🟢 Baixa',
};
const TYPES = ['STORY', 'BUG', 'TASK', 'SPIKE'];
const TYPE_LABELS: Record<string, string> = {
  STORY: '📖 Story', BUG: '🐛 Bug', TASK: '✅ Task', SPIKE: '⚡ Spike',
};

const pillStyle = (active: boolean): React.CSSProperties => ({
  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
  cursor: 'pointer', border: '1px solid var(--border)',
  background: active ? 'rgba(99,102,241,.18)' : 'var(--bg2)',
  color: active ? 'var(--accent2)' : 'var(--text3)',
  transition: 'all .15s', whiteSpace: 'nowrap',
});

export function KanbanFilterBar({ projectId, filters, onChange }: Props) {
  const { data: epicsData } = useQuery({
    queryKey: ['epics', projectId],
    queryFn: () => epicsApi.list(projectId).then(r => r.data.data ?? []),
  });
  const epics = (epicsData ?? []) as any[];

  const hasActive = filters.search || filters.myTasks
    || filters.priorities.length > 0 || filters.types.length > 0 || filters.epicId;

  const toggle = (key: 'priorities' | 'types', val: string) => {
    const arr = filters[key];
    const next = arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
    onChange({ ...filters, [key]: next });
  };

  const activeCount = [
    filters.myTasks ? 1 : 0,
    filters.priorities.length,
    filters.types.length,
    filters.epicId ? 1 : 0,
  ].reduce((a, b) => a + b, 0) + (filters.search ? 1 : 0);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 14px', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <span style={{ position: 'absolute', left: 8, fontSize: 13, opacity: 0.45, pointerEvents: 'none' }}>🔍</span>
        <input
          value={filters.search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
          placeholder="Filtrar tarefas..."
          style={{
            padding: '5px 10px 5px 28px', borderRadius: 6,
            border: `1px solid ${filters.search ? 'var(--accent)' : 'var(--border)'}`,
            background: 'var(--bg2)', color: 'var(--text1)', fontSize: 13,
            width: 190, outline: 'none', transition: 'border .15s',
          }}
        />
        {filters.search && (
          <button onClick={() => onChange({ ...filters, search: '' })} style={{ position: 'absolute', right: 6, fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        )}
      </div>

      <button
        onClick={() => onChange({ ...filters, myTasks: !filters.myTasks })}
        style={{
          padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
          cursor: 'pointer', border: '1px solid var(--border)',
          background: filters.myTasks ? 'var(--accent)' : 'var(--bg2)',
          color: filters.myTasks ? '#fff' : 'var(--text2)',
          transition: 'all .15s',
        }}
      >👤 Minhas tarefas</button>

      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

      {PRIORITIES.map(p => (
        <button key={p} onClick={() => toggle('priorities', p)} style={pillStyle(filters.priorities.includes(p))}>
          {PRIORITY_LABELS[p]}
        </button>
      ))}

      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

      {TYPES.map(t => (
        <button key={t} onClick={() => toggle('types', t)} style={pillStyle(filters.types.includes(t))}>
          {TYPE_LABELS[t]}
        </button>
      ))}

      {epics.length > 0 && (
        <>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <select
            value={filters.epicId}
            onChange={e => onChange({ ...filters, epicId: e.target.value })}
            style={{
              padding: '5px 10px', borderRadius: 6,
              border: `1px solid ${filters.epicId ? 'var(--accent)' : 'var(--border)'}`,
              background: filters.epicId ? 'rgba(99,102,241,.1)' : 'var(--bg2)',
              color: filters.epicId ? 'var(--accent2)' : 'var(--text2)',
              fontSize: 12, outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">🏔️ Todos os épicos</option>
            {epics.map((e: any) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </>
      )}

      {hasActive && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text3)', transition: 'all .15s', marginLeft: 'auto' }}
        >✕ Limpar ({activeCount})</button>
      )}
    </div>
  );
}
