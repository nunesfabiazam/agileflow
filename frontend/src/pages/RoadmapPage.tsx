import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { epicsApi, sprintsApi } from '../api';
import { useAppStore } from '../store/useAppStore';
import type { Epic, Sprint } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const PX: Record<string, number> = { week: 36, month: 12, quarter: 4 };
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const ROW_H    = 44;
const HEADER_H = 52;
const LABEL_W  = 220;

// ── Date helpers ──────────────────────────────────────────────────────────────
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function startOfWeek(d: Date): Date {
  const r = new Date(d); r.setDate(r.getDate() - r.getDay()); return r;
}
function toISO(d: Date): string {
  return d.toISOString();
}
function fmt(d: Date, mode: 'day' | 'month'): string {
  if (mode === 'day')   return `${d.getDate()}`;
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Drag state ref type ───────────────────────────────────────────────────────
interface DragState {
  kind:   'epic' | 'sprint';
  id:     string;
  handle: 'move' | 'left' | 'right';
  startX: number;
  origS:  Date;
  origE:  Date;
  pxPerDay: number;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function RoadmapPage() {
  const qc               = useQueryClient();
  const activeProjectId  = useAppStore(s => s.activeProjectId);

  const [zoom,    setZoom]    = useState<'week'|'month'|'quarter'>('month');
  const [view,    setView]    = useState<'both'|'epics'|'sprints'>('both');
  const [epicsOpen,   setEpicsOpen]   = useState(true);
  const [sprintsOpen, setSprintsOpen] = useState(true);

  // Range: number of months before/after today
  const [rangeOffset, setRangeOffset] = useState(0); // shifts by 3 months

  // Local override during drag: { id → { s, e } }
  const [localDates, setLocalDates] = useState<Record<string, { s: Date; e: Date }>>({});

  const dragRef = useRef<DragState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Compute range
  const today    = new Date();
  const monthsBefore = zoom === 'week' ? 2 : zoom === 'month' ? 3 : 6;
  const monthsAfter  = zoom === 'week' ? 3 : zoom === 'month' ? 6 : 12;

  const rangeStart = startOfMonth(new Date(
    today.getFullYear(),
    today.getMonth() - monthsBefore + rangeOffset * 3,
    1
  ));
  const rangeEnd = endOfMonth(new Date(
    today.getFullYear(),
    today.getMonth() + monthsAfter + rangeOffset * 3,
    1
  ));

  const pxPerDay   = PX[zoom];
  const totalDays  = diffDays(rangeEnd, rangeStart);
  const totalWidth = totalDays * pxPerDay;

  // Queries
  const { data: epics = [] } = useQuery<Epic[]>({
    queryKey: ['epics', activeProjectId],
    queryFn:  () => epicsApi.list(activeProjectId!).then(r => r.data.data ?? []),
    enabled:  !!activeProjectId,
  });
  const { data: sprints = [] } = useQuery<Sprint[]>({
    queryKey: ['sprints', activeProjectId],
    queryFn:  () => sprintsApi.list(activeProjectId!).then(r => r.data.data ?? []),
    enabled:  !!activeProjectId,
  });

  // Mutations
  const updateEpic = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Epic> }) =>
      epicsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['epics', activeProjectId] });
      setLocalDates({});
    },
  });
  const updateSprint = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Sprint> }) =>
      sprintsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', activeProjectId] });
      setLocalDates({});
    },
  });

  // ── Bar geometry ─────────────────────────────────────────────────────────────
  const getLeft  = (d: Date) => Math.max(0, diffDays(d, rangeStart) * pxPerDay);
  const getWidth = (s: Date, e: Date) => Math.max(pxPerDay, diffDays(e, s) * pxPerDay);

  // ── Drag handlers ─────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((
    e: React.MouseEvent,
    kind: 'epic' | 'sprint',
    id: string,
    handle: 'move' | 'left' | 'right',
    s: Date,
    en: Date,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { kind, id, handle, startX: e.clientX, origS: s, origE: en, pxPerDay };
  }, [pxPerDay]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { handle, startX, origS, origE, pxPerDay: ppd, id } = dragRef.current;
      const deltaX = e.clientX - startX;
      const deltaDays = Math.round(deltaX / ppd);
      let ns = new Date(origS), ne = new Date(origE);

      if (handle === 'move') {
        ns = addDays(origS, deltaDays);
        ne = addDays(origE, deltaDays);
      } else if (handle === 'left') {
        ns = addDays(origS, deltaDays);
        if (ns >= ne) ns = addDays(ne, -1);
      } else {
        ne = addDays(origE, deltaDays);
        if (ne <= ns) ne = addDays(ns, 1);
      }
      setLocalDates(prev => ({ ...prev, [id]: { s: ns, e: ne } }));
    };

    const onUp = () => {
      if (!dragRef.current) return;
      const { kind, id, pxPerDay: _p } = dragRef.current;
      const local = localDates[id];
      if (local) {
        if (kind === 'epic') {
          updateEpic.mutate({ id, data: { startDate: toISO(local.s), dueDate: toISO(local.e) } });
        } else {
          updateSprint.mutate({ id, data: { startDate: toISO(local.s), endDate: toISO(local.e) } });
        }
      }
      dragRef.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [localDates, updateEpic, updateSprint]);

  // Scroll to today on mount / zoom change
  useEffect(() => {
    if (!scrollRef.current) return;
    const todayLeft = getLeft(today);
    const containerW = scrollRef.current.clientWidth;
    scrollRef.current.scrollLeft = Math.max(0, todayLeft - containerW / 2);
  }, [zoom, rangeOffset]);  // eslint-disable-line

  // ── Header columns (months + week ticks) ─────────────────────────────────────
  const monthColumns: Array<{ label: string; left: number; width: number }> = [];
  const weekTicks:    Array<{ left: number; label: string }> = [];

  {
    let cur = new Date(rangeStart);
    while (cur <= rangeEnd) {
      const mStart = startOfMonth(cur);
      const mEnd   = endOfMonth(cur);
      const left   = Math.max(0, getLeft(mStart));
      const right  = Math.min(totalWidth, getLeft(addDays(mEnd, 1)));
      monthColumns.push({ label: `${MONTHS[cur.getMonth()]} ${cur.getFullYear()}`, left, width: right - left });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }
  {
    let cur = startOfWeek(rangeStart);
    while (cur <= rangeEnd) {
      weekTicks.push({ left: getLeft(cur), label: `${cur.getDate()}` });
      cur = addDays(cur, 7);
    }
  }

  const todayLeft = getLeft(today);
  const todayInRange = todayLeft >= 0 && todayLeft <= totalWidth;

  // ── Bar renderer ─────────────────────────────────────────────────────────────
  const renderBar = (
    kind: 'epic' | 'sprint',
    id: string,
    label: string,
    color: string,
    rawS?: string | null,
    rawE?: string | null,
  ) => {
    const local = localDates[id];
    const s = local?.s ?? (rawS ? new Date(rawS) : null);
    const e = local?.e ?? (rawE ? new Date(rawE) : null);

    if (!s || !e) {
      return (
        <div style={{ height: ROW_H, display: 'flex', alignItems: 'center', paddingLeft: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
            Sem datas definidas
          </span>
        </div>
      );
    }

    const left  = getLeft(s);
    const width = getWidth(s, e);
    const inView = left < totalWidth && left + width > 0;

    return (
      <div style={{ height: ROW_H, position: 'relative' }}>
        {inView && (
          <div
            onMouseDown={ev => onMouseDown(ev, kind, id, 'move', s, e)}
            title={`${label}: ${s.toLocaleDateString('pt-BR')} → ${e.toLocaleDateString('pt-BR')}`}
            style={{
              position: 'absolute',
              left: Math.max(0, left),
              top: '50%', transform: 'translateY(-50%)',
              width, height: 28,
              background: color,
              borderRadius: 6,
              cursor: 'grab',
              display: 'flex', alignItems: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,.25)',
              userSelect: 'none',
              transition: dragRef.current?.id === id ? 'none' : 'left .1s, width .1s',
              overflow: 'hidden',
              minWidth: 8,
            }}
          >
            {/* Left resize handle */}
            <div
              onMouseDown={ev => onMouseDown(ev, kind, id, 'left', s, e)}
              style={{
                width: 8, height: '100%', cursor: 'ew-resize', flexShrink: 0,
                background: 'rgba(0,0,0,.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            ><span style={{ fontSize: 8, color: 'rgba(255,255,255,.7)' }}>⋮</span></div>

            {/* Label */}
            <span style={{
              flex: 1, fontSize: 11, fontWeight: 600, color: '#fff',
              padding: '0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{label}</span>

            {/* Right resize handle */}
            <div
              onMouseDown={ev => onMouseDown(ev, kind, id, 'right', s, e)}
              style={{
                width: 8, height: '100%', cursor: 'ew-resize', flexShrink: 0,
                background: 'rgba(0,0,0,.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            ><span style={{ fontSize: 8, color: 'rgba(255,255,255,.7)' }}>⋮</span></div>
          </div>
        )}
      </div>
    );
  };

  // ── Section header ────────────────────────────────────────────────────────────
  const SectionHeader = ({ label, count, open, onToggle, color }: {
    label: string; count: number; open: boolean;
    onToggle: () => void; color: string;
  }) => (
    <div style={{ display: 'flex', height: 32, borderBottom: '1px solid var(--border)' }}>
      {/* Label col */}
      <div
        onClick={onToggle}
        style={{
          width: LABEL_W, flexShrink: 0, display: 'flex', alignItems: 'center',
          gap: 6, padding: '0 12px', cursor: 'pointer',
          background: 'var(--bg2)', borderRight: '1px solid var(--border)',
          fontSize: 12, fontWeight: 700, color: 'var(--text2)',
          position: 'sticky', left: 0, zIndex: 3,
        }}
      >
        <span style={{ fontSize: 10 }}>{open ? '▾' : '▸'}</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        {label}
        <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>({count})</span>
      </div>
      {/* Timeline stripe */}
      <div style={{ flex: 1, background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }} />
    </div>
  );

  if (!activeProjectId) return (
    <div className="empty-state">
      <div className="empty-icon">📅</div>
      <div className="empty-text">Selecione um projeto</div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 96px)', margin: -24, overflow: 'hidden' }}>

      {/* ── Top controls ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>📅 Roadmap</h2>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg4)', borderRadius: 8, padding: 2 }}>
          {(['both','epics','sprints'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{
                padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                background: view === v ? 'var(--accent)' : 'transparent',
                color: view === v ? '#fff' : 'var(--text3)',
              }}>
              {v === 'both' ? 'Tudo' : v === 'epics' ? '🏔️ Épicos' : '🏃 Sprints'}
            </button>
          ))}
        </div>

        {/* Zoom toggle */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg4)', borderRadius: 8, padding: 2 }}>
          {([['week','Semana'],['month','Mês'],['quarter','Trimestre']] as const).map(([z, label]) => (
            <button key={z} onClick={() => setZoom(z)}
              style={{
                padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                background: zoom === z ? 'var(--bg2)' : 'transparent',
                color: zoom === z ? 'var(--text1)' : 'var(--text3)',
                boxShadow: zoom === z ? '0 1px 4px rgba(0,0,0,.2)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Navigate */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setRangeOffset(o => o - 1)}
            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg4)', cursor: 'pointer', fontSize: 13 }}>
            ←
          </button>
          <button onClick={() => setRangeOffset(0)}
            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg4)', cursor: 'pointer', fontSize: 12 }}>
            Hoje
          </button>
          <button onClick={() => setRangeOffset(o => o + 1)}
            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg4)', cursor: 'pointer', fontSize: 13 }}>
            →
          </button>
        </div>

        {/* Range label */}
        <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 4 }}>
          {MONTHS[rangeStart.getMonth()]} {rangeStart.getFullYear()} –{' '}
          {MONTHS[rangeEnd.getMonth()]} {rangeEnd.getFullYear()}
        </span>
      </div>

      {/* ── Gantt body ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

        {/* Sticky left label panel */}
        <div style={{
          width: LABEL_W, flexShrink: 0, overflow: 'hidden',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg2)',
        }}>
          {/* Header spacer */}
          <div style={{ height: HEADER_H, borderBottom: '1px solid var(--border)', flexShrink: 0,
            display: 'flex', alignItems: 'flex-end', padding: '0 12px 6px',
            fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
            ITEM
          </div>

          {/* Epics labels */}
          {(view === 'both' || view === 'epics') && (
            <>
              {/* Section header */}
              <div onClick={() => setEpicsOpen(v => !v)} style={{
                height: 32, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px',
                cursor: 'pointer', background: 'var(--bg3)', borderBottom: '1px solid var(--border)',
                fontSize: 12, fontWeight: 700, color: 'var(--text2)', flexShrink: 0,
              }}>
                <span style={{ fontSize: 10 }}>{epicsOpen ? '▾' : '▸'}</span>
                🏔️ Épicos
                <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>({epics.length})</span>
              </div>
              {epicsOpen && (epics as Epic[]).map(epic => (
                <div key={epic.id} style={{
                  height: ROW_H, display: 'flex', alignItems: 'center', gap: 8,
                  padding: '0 12px', borderBottom: '1px solid var(--border)',
                  flexShrink: 0, overflow: 'hidden',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: epic.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {epic.title}
                  </span>
                </div>
              ))}
            </>
          )}

          {/* Sprints labels */}
          {(view === 'both' || view === 'sprints') && (
            <>
              <div onClick={() => setSprintsOpen(v => !v)} style={{
                height: 32, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px',
                cursor: 'pointer', background: 'var(--bg3)', borderBottom: '1px solid var(--border)',
                fontSize: 12, fontWeight: 700, color: 'var(--text2)', flexShrink: 0,
              }}>
                <span style={{ fontSize: 10 }}>{sprintsOpen ? '▾' : '▸'}</span>
                🏃 Sprints
                <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>({sprints.length})</span>
              </div>
              {sprintsOpen && (sprints as Sprint[]).map(sprint => (
                <div key={sprint.id} style={{
                  height: ROW_H, display: 'flex', alignItems: 'center', gap: 8,
                  padding: '0 12px', borderBottom: '1px solid var(--border)',
                  flexShrink: 0, overflow: 'hidden',
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: 1, flexShrink: 0,
                    background: sprint.status === 'ACTIVE' ? '#22c55e' : sprint.status === 'COMPLETED' ? '#94a3b8' : 'var(--accent)',
                  }} />
                  <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {sprint.name}
                  </span>
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, flexShrink: 0,
                    background: sprint.status === 'ACTIVE' ? 'rgba(34,197,94,.15)' : 'var(--bg4)',
                    color: sprint.status === 'ACTIVE' ? '#22c55e' : 'var(--text3)',
                  }}>{sprint.status === 'ACTIVE' ? 'Ativo' : sprint.status === 'COMPLETED' ? 'Concluído' : 'Planejado'}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Scrollable timeline */}
        <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative' }}>
          <div style={{ width: totalWidth, minWidth: '100%', position: 'relative' }}>

            {/* ── Date header ── */}
            <div style={{
              height: HEADER_H, position: 'sticky', top: 0, zIndex: 5,
              background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
            }}>
              {/* Month labels */}
              <div style={{ position: 'relative', height: 28, borderBottom: '1px solid var(--border)' }}>
                {monthColumns.map((mc, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: mc.left, width: mc.width,
                    height: '100%', display: 'flex', alignItems: 'center',
                    paddingLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--text2)',
                    borderRight: '1px solid var(--border)', overflow: 'hidden', whiteSpace: 'nowrap',
                  }}>{mc.label}</div>
                ))}
              </div>
              {/* Week ticks */}
              <div style={{ position: 'relative', height: 24 }}>
                {weekTicks.filter(t => t.left >= 0 && t.left <= totalWidth).map((t, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: t.left,
                    height: '100%', borderLeft: '1px solid var(--border)',
                    paddingLeft: 3, fontSize: 10, color: 'var(--text3)',
                    display: 'flex', alignItems: 'center',
                  }}>{t.label}</div>
                ))}
              </div>
            </div>

            {/* ── Rows ── */}

            {/* Epics */}
            {(view === 'both' || view === 'epics') && (
              <>
                {/* Section header stripe */}
                <div style={{ height: 32, background: 'var(--bg3)', borderBottom: '1px solid var(--border)', position: 'relative' }}>
                  {/* grid lines */}
                  {weekTicks.map((t, i) => (
                    <div key={i} style={{ position: 'absolute', left: t.left, top: 0, bottom: 0, borderLeft: '1px solid var(--border)', opacity: .4 }} />
                  ))}
                </div>
                {epicsOpen && (epics as Epic[]).map(epic => (
                  <div key={epic.id} style={{
                    position: 'relative', borderBottom: '1px solid var(--border)',
                    background: 'var(--bg1)',
                  }}>
                    {/* Grid lines */}
                    {weekTicks.map((t, i) => (
                      <div key={i} style={{ position: 'absolute', left: t.left, top: 0, bottom: 0, borderLeft: '1px solid var(--border)', opacity: .2 }} />
                    ))}
                    {renderBar('epic', epic.id, epic.title, epic.color, epic.startDate, epic.dueDate)}
                  </div>
                ))}
              </>
            )}

            {/* Sprints */}
            {(view === 'both' || view === 'sprints') && (
              <>
                <div style={{ height: 32, background: 'var(--bg3)', borderBottom: '1px solid var(--border)', position: 'relative' }}>
                  {weekTicks.map((t, i) => (
                    <div key={i} style={{ position: 'absolute', left: t.left, top: 0, bottom: 0, borderLeft: '1px solid var(--border)', opacity: .4 }} />
                  ))}
                </div>
                {sprintsOpen && (sprints as Sprint[]).map(sprint => {
                  const sprintColor =
                    sprint.status === 'ACTIVE'    ? '#22c55e' :
                    sprint.status === 'COMPLETED' ? '#64748b' : '#6366f1';
                  return (
                    <div key={sprint.id} style={{
                      position: 'relative', borderBottom: '1px solid var(--border)',
                      background: 'var(--bg1)',
                    }}>
                      {weekTicks.map((t, i) => (
                        <div key={i} style={{ position: 'absolute', left: t.left, top: 0, bottom: 0, borderLeft: '1px solid var(--border)', opacity: .2 }} />
                      ))}
                      {renderBar('sprint', sprint.id, sprint.name, sprintColor, sprint.startDate, sprint.endDate)}
                    </div>
                  );
                })}
              </>
            )}

            {/* ── Today line ── */}
            {todayInRange && (
              <div style={{
                position: 'absolute', top: 0, bottom: 0,
                left: todayLeft, width: 2,
                background: '#ef4444', opacity: .8,
                pointerEvents: 'none', zIndex: 4,
              }}>
                <div style={{
                  position: 'sticky', top: HEADER_H + 4,
                  background: '#ef4444', color: '#fff',
                  fontSize: 9, fontWeight: 700, borderRadius: 3,
                  padding: '1px 4px', whiteSpace: 'nowrap',
                  transform: 'translateX(-50%)',
                }}>Hoje</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tip ── */}
      <div style={{
        padding: '6px 16px', background: 'var(--bg2)', borderTop: '1px solid var(--border)',
        fontSize: 11, color: 'var(--text3)', flexShrink: 0,
      }}>
        💡 Arraste as barras para mover • Arraste as bordas ⋮ para redimensionar • As datas são salvas automaticamente
      </div>
    </div>
  );
}
