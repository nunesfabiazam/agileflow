import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../../api';
import type { Notification } from '../../types';

const TYPE_ICON: Record<string, string> = {
  TASK_ASSIGNED:       '👤',
  TASK_COMMENTED:      '💬',
  TASK_STATUS_CHANGED: '🔄',
  SPRINT_STARTED:      '🚀',
  SPRINT_COMPLETED:    '✅',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'agora';
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

export function NotificationBell() {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const { data } = useQuery({
    queryKey:        ['notifications'],
    queryFn:         () => notificationsApi.list({ limit: 30 }).then((r: any) => r.data),
    refetchInterval: 30000,
  });

  const notifications: Notification[] = data?.data ?? [];
  const unreadCount: number           = data?.unreadCount ?? 0;

  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAllMut = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => notificationsApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleClick = (n: Notification) => {
    if (!n.isRead) markReadMut.mutate(n.id);
    if (n.link)   navigate(n.link);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Notificações"
        style={{
          position: 'relative', background: 'none', border: 'none',
          cursor: 'pointer', fontSize: 18, padding: '4px 6px', borderRadius: 8,
          color: open ? 'var(--accent)' : 'var(--text3)', transition: 'color .15s',
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700,
            borderRadius: '50%', width: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg2)',
          }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0,
          width: 340, maxHeight: 480, overflow: 'auto',
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 -8px 32px rgba(0,0,0,.4)',
          zIndex: 500, marginBottom: 8,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 1,
          }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>
              🔔 Notificações
              {unreadCount > 0 && (
                <span style={{ marginLeft: 8, fontSize: 11, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 7px', fontWeight: 700 }}>
                  {unreadCount} novas
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button onClick={() => markAllMut.mutate()} disabled={markAllMut.isPending}
                style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                ✓ Marcar todas lidas
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔕</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>Sem notificações</div>
            </div>
          ) : notifications.map(n => (
            <div key={n.id} onClick={() => handleClick(n)} style={{
              display: 'flex', gap: 10, padding: '10px 14px', cursor: n.link ? 'pointer' : 'default',
              background: n.isRead ? 'transparent' : 'rgba(99,102,241,.07)',
              borderBottom: '1px solid var(--border)', transition: 'background .1s',
              position: 'relative',
            }}
              onMouseEnter={e => { if (!n.isRead) (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,102,241,.12)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = n.isRead ? 'transparent' : 'rgba(99,102,241,.07)'; }}
            >
              {!n.isRead && (
                <div style={{ position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
              )}
              <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: n.actor?.color ?? 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, overflow: 'hidden' }}>
                {n.actor?.avatarUrl
                  ? <img src={n.actor.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  : n.actor
                    ? <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{n.actor.name.charAt(0).toUpperCase()}</span>
                    : <span>{TYPE_ICON[n.type] ?? '🔔'}</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: n.isRead ? 400 : 600, lineHeight: 1.3, marginBottom: 2 }}>
                  {TYPE_ICON[n.type]} {n.title}
                </div>
                {n.body && <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>}
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                  {timeAgo(n.createdAt)}
                  {n.task && <span style={{ marginLeft: 6, color: 'var(--accent2)', fontFamily: 'monospace' }}>{n.task.taskKey}</span>}
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); removeMut.mutate(n.id); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 13, padding: '2px 4px', borderRadius: 4, flexShrink: 0 }}
                title="Remover">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
