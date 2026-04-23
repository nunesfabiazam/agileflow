import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '../../api';
import { useAppStore } from '../../store/useAppStore';

interface Props {
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  STORY: '#6366f1', BUG: '#ef4444', TASK: '#3b82f6',
  SPIKE: '#f97316', EPIC: '#a855f7', SUBTASK: '#64748b',
};
const PRIORITY_ICONS: Record<string, string> = {
  CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢',
};

export function GlobalSearch({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { setActiveProject, addRecentProject } = useAppStore();

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ['global-search', debouncedQ],
    queryFn: () => searchApi.search(debouncedQ).then(r => r.data.data),
    enabled: debouncedQ.length >= 2,
    staleTime: 30_000,
  });

  const tasks = data?.tasks ?? [];
  const documents = data?.documents ?? [];
  const epics = data?.epics ?? [];

  const allResults = useMemo(() => [
    ...tasks.map((t: any) => ({ ...t, _kind: 'task' as const })),
    ...documents.map((d: any) => ({ ...d, _kind: 'doc' as const })),
    ...epics.map((e: any) => ({ ...e, _kind: 'epic' as const })),
  ], [tasks, documents, epics]);

  const handleSelect = useCallback((item: any) => {
    if (item._kind === 'task') {
      if (item.project?.id) { setActiveProject(item.project.id); if (item.project) addRecentProject(item.project); }
      navigate('/kanban');
    } else if (item._kind === 'doc') {
      navigate(`/documents/${item.id}`);
    } else if (item._kind === 'epic') {
      if (item.project?.id) { setActiveProject(item.project.id); if (item.project) addRecentProject(item.project); }
      navigate('/epics');
    }
    onClose();
  }, [navigate, onClose, setActiveProject, addRecentProject]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, allResults.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === 'Enter' && allResults[selected]) { handleSelect(allResults[selected]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [allResults, selected, handleSelect, onClose]);

  useEffect(() => { setSelected(0); }, [debouncedQ]);

  const hasResults = allResults.length > 0;
  const showEmpty = debouncedQ.length >= 2 && !isFetching && !hasResults;
  let flatIdx = 0;

  const renderItem = (item: any, label: string) => {
    const idx = flatIdx++;
    const isSelected = idx === selected;
    return (
      <div
        key={item.id}
        onClick={() => handleSelect(item)}
        onMouseEnter={() => setSelected(idx)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 16px', cursor: 'pointer',
          background: isSelected ? 'rgba(99,102,241,0.12)' : 'transparent',
          borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
          transition: 'background .1s',
        }}
      >
        {label === 'task' && (
          <>
            <span style={{ fontSize: 10, background: TYPE_COLORS[item.type] ?? '#64748b', color: '#fff', borderRadius: 4, padding: '2px 6px', fontWeight: 700, flexShrink: 0 }}>{item.type}</span>
            <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, fontFamily: 'monospace' }}>{item.taskKey}</span>
            <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
            <span style={{ fontSize: 13 }}>{PRIORITY_ICONS[item.priority]}</span>
            {item.project && (
              <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.project.color, display: 'inline-block' }} />
                {item.project.key}
              </span>
            )}
          </>
        )}
        {label === 'doc' && (
          <>
            <span style={{ fontSize: 16, flexShrink: 0 }}>📄</span>
            <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
            <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{item.type}</span>
            {item.project && (
              <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{item.project.iconEmoji}</span><span>{item.project.name}</span>
              </span>
            )}
          </>
        )}
        {label === 'epic' && (
          <>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: item.color, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{item._count?.tasks ?? 0} tarefas</span>
            {item.project && (
              <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{item.project.iconEmoji}</span><span>{item.project.name}</span>
              </span>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 640, background: 'var(--bg2)',
          border: '1px solid var(--border)', borderRadius: 14,
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 18, opacity: 0.5, flexShrink: 0 }}>{isFetching ? '⏳' : '🔍'}</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar tarefas, documentos, épicos..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 16, color: 'var(--text1)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ fontSize: 11, padding: '2px 8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text3)', cursor: 'pointer' }}>✕</button>
          )}
          <kbd style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>ESC</kbd>
        </div>

        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          {!query && (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>⌘K</div>
              <div style={{ fontSize: 14 }}>Digite para buscar tarefas, documentos e épicos</div>
              <div style={{ fontSize: 12, marginTop: 8, opacity: 0.6 }}>Mínimo 2 caracteres</div>
            </div>
          )}
          {query && debouncedQ.length < 2 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Continue digitando...</div>
          )}
          {showEmpty && (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 14 }}>Nenhum resultado para <strong style={{ color: 'var(--text2)' }}>"{debouncedQ}"</strong></div>
            </div>
          )}
          {tasks.length > 0 && (
            <div>
              <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tarefas</div>
              {tasks.map((t: any) => renderItem({ ...t, _kind: 'task' }, 'task'))}
            </div>
          )}
          {documents.length > 0 && (
            <div style={{ borderTop: tasks.length > 0 ? '1px solid var(--border)' : undefined }}>
              <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Documentos</div>
              {documents.map((d: any) => renderItem({ ...d, _kind: 'doc' }, 'doc'))}
            </div>
          )}
          {epics.length > 0 && (
            <div style={{ borderTop: (tasks.length + documents.length) > 0 ? '1px solid var(--border)' : undefined }}>
              <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Épicos</div>
              {epics.map((e: any) => renderItem({ ...e, _kind: 'epic' }, 'epic'))}
            </div>
          )}
        </div>

        {hasResults && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--text3)' }}>
            <span>↑↓ navegar</span><span>↵ selecionar</span><span>ESC fechar</span>
            <span style={{ marginLeft: 'auto' }}>{allResults.length} resultado{allResults.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}
