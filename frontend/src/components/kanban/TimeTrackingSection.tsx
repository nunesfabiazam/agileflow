import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../store/useAppStore';
import { timeLogsApi } from '../../api';

interface TimeLog {
  id: string;
  minutes: number;
  note?: string;
  date: string;
  user: { id: string; name: string; color: string };
}

interface Props {
  taskId: string;
}

function formatMinutes(m: number) {
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function TimeTrackingSection({ taskId }: Props) {
  const { user: me } = useAppStore();
  const qc = useQueryClient();

  // Manual log form
  const [showForm, setShowForm] = useState(false);
  const [hours, setHours]       = useState('0');
  const [mins, setMins]         = useState('30');
  const [note, setNote]         = useState('');

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const formatTimer = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

  const { data } = useQuery({
    queryKey: ['time-logs', taskId],
    queryFn: () => timeLogsApi.list(taskId).then((r: any) => r.data.data as { logs: TimeLog[]; totalMinutes: number }),
  });

  const logs = data?.logs ?? [];
  const totalMinutes = data?.totalMinutes ?? 0;

  const createMut = useMutation({
    mutationFn: (payload: { minutes: number; note?: string }) =>
      timeLogsApi.create(taskId, payload.minutes, payload.note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-logs', taskId] });
      setShowForm(false);
      setHours('0'); setMins('30'); setNote('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => timeLogsApi.remove(taskId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-logs', taskId] }),
  });

  const handleStopTimer = () => {
    setTimerRunning(false);
    const minutes = Math.max(1, Math.round(timerSeconds / 60));
    createMut.mutate({ minutes, note: 'Registrado via timer' });
    setTimerSeconds(0);
  };

  const handleManualLog = () => {
    const totalMins = (parseInt(hours) || 0) * 60 + (parseInt(mins) || 0);
    if (totalMins < 1) return;
    createMut.mutate({ minutes: totalMins, note: note.trim() || undefined });
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>
          ⏱️ Time Tracking
          {totalMinutes > 0 && (
            <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 8, fontWeight: 600 }}>
              {formatMinutes(totalMinutes)} total
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {/* Timer button */}
          {!timerRunning ? (
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, color: '#10b981' }}
              onClick={() => setTimerRunning(true)}
            >▶ Iniciar timer</button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 13, fontWeight: 700, color: '#10b981',
                fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace',
              }}>
                {formatTimer(timerSeconds)}
              </span>
              <button
                className="btn btn-sm"
                style={{ fontSize: 11, background: '#10b981', color: '#fff', border: 'none' }}
                onClick={handleStopTimer}
              >⏹ Parar e salvar</button>
            </div>
          )}
          {!timerRunning && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11 }}
              onClick={() => setShowForm(f => !f)}
            >+ Log manual</button>
          )}
        </div>
      </div>

      {/* Manual log form */}
      {showForm && (
        <div style={{
          background: 'var(--bg3)', borderRadius: 8, padding: '12px 14px',
          marginBottom: 12, border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Horas</label>
              <input type="number" min="0" max="23" className="input"
                value={hours} onChange={e => setHours(e.target.value)}
                style={{ width: 64, textAlign: 'center' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Minutos</label>
              <input type="number" min="0" max="59" step="15" className="input"
                value={mins} onChange={e => setMins(e.target.value)}
                style={{ width: 64, textAlign: 'center' }} />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Nota (opcional)</label>
              <input type="text" className="input" placeholder="Ex: Revisão de código"
                value={note} onChange={e => setNote(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-primary btn-sm"
                disabled={createMut.isPending || (parseInt(hours)||0)*60+(parseInt(mins)||0) < 1}
                onClick={handleManualLog}>
                {createMut.isPending ? '⏳' : '✅ Salvar'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>×</button>
            </div>
          </div>
        </div>
      )}

      {/* Log list */}
      {logs.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {logs.map((log: TimeLog) => (
            <div key={log.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', background: 'var(--bg3)',
              borderRadius: 6, fontSize: 12,
            }}>
              {/* User avatar */}
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: log.user.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {log.user.name.slice(0, 2).toUpperCase()}
              </div>
              <span style={{ color: 'var(--text3)', fontSize: 11 }}>{log.user.name}</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)', marginLeft: 2 }}>
                {formatMinutes(log.minutes)}
              </span>
              {log.note && (
                <span style={{ color: 'var(--text3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  — {log.note}
                </span>
              )}
              <span style={{ color: 'var(--text3)', fontSize: 10, marginLeft: 'auto', flexShrink: 0 }}>
                {formatDate(log.date)}
              </span>
              {(log.user.id === me?.id || me?.role === 'ADMIN') && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, color: '#ef4444', padding: '0 4px', lineHeight: 1 }}
                  onClick={() => deleteMut.mutate(log.id)}
                  title="Remover log"
                >×</button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', padding: '4px 0' }}>
          Nenhum tempo registrado.
        </div>
      )}
    </div>
  );
}
