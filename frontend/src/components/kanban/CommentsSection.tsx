import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../store/useAppStore';
import { commentsApi, usersApi } from '../../api';

interface Comment {
  id: string;
  content: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; color: string; avatarUrl?: string };
}

interface ProjectUser {
  id: string;
  name: string;
  color: string;
}

interface Props {
  taskId: string;
  projectId: string;
}

function Avatar({ user, size = 28 }: { user: { name: string; color: string; avatarUrl?: string | null }; size?: number }) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} alt={user.name} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: user.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {user.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function formatRelative(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function CommentsSection({ taskId, projectId }: Props) {
  const { user: me } = useAppStore();
  const qc = useQueryClient();

  const [text, setText]                 = useState('');
  const [editId, setEditId]             = useState<string | null>(null);
  const [editText, setEditText]         = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPos, setCursorPos]       = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => commentsApi.list(taskId).then((r: any) => r.data.data as Comment[]),
  });

  const { data: projectUsers = [] } = useQuery({
    queryKey: ['users', projectId],
    queryFn: () => usersApi.list().then((r: any) => r.data.data as ProjectUser[]),
  });

  // Extract @mentions from text
  const getMentions = (inputText: string) =>
    (inputText.match(/@\[([^\]]+)\]\(([^)]+)\)/g) ?? []).map(m => {
      const match = m.match(/@\[([^\]]+)\]\(([^)]+)\)/);
      return match ? match[2] : '';
    }).filter(Boolean);

  // Handle textarea input — detect @ for mentions
  const handleInput = (val: string, pos: number) => {
    setText(val);
    const beforeCursor = val.slice(0, pos);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionQuery('');
    }
    setCursorPos(pos);
  };

  const insertMention = (user: ProjectUser) => {
    const before = text.slice(0, cursorPos);
    const after  = text.slice(cursorPos);
    const replaced = before.replace(/@\w*$/, `@[${user.name}](${user.id}) `);
    setText(replaced + after);
    setShowMentions(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const filteredUsers = projectUsers.filter((u: ProjectUser) =>
    u.name.toLowerCase().includes(mentionQuery.toLowerCase()) && u.id !== me?.id
  );

  // Render text with @mentions highlighted
  const renderText = (raw: string) => {
    const parts = raw.split(/(@\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, i) => {
      const m = part.match(/@\[([^\]]+)\]\(([^)]+)\)/);
      if (m) return <span key={i} style={{ color: 'var(--accent)', fontWeight: 600 }}>@{m[1]}</span>;
      return <span key={i}>{part}</span>;
    });
  };

  const createMut = useMutation({
    mutationFn: () => commentsApi.create(taskId, text.trim(), getMentions(text)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', taskId] });
      setText('');
    },
  });

  const updateMut = useMutation({
    mutationFn: () => commentsApi.update(taskId, editId!, editText.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', taskId] });
      setEditId(null);
      setEditText('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => commentsApi.remove(taskId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', taskId] }),
  });

  return (
    <div style={{ marginTop: 24 }}>
      <div className="section-title">
        💬 Comentários {comments.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>({comments.length})</span>
        )}
      </div>

      {/* Comment list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
        {comments.map((c: Comment) => (
          <div key={c.id} style={{ display: 'flex', gap: 10 }}>
            <Avatar user={c.user} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)' }}>{c.user.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{formatRelative(c.createdAt)}</span>
                {c.updatedAt !== c.createdAt && (
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>(editado)</span>
                )}
              </div>

              {editId === c.id ? (
                <div>
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', resize: 'vertical',
                      minHeight: 60, padding: '8px 10px', borderRadius: 6,
                      background: 'var(--bg3)', border: '1px solid var(--border)',
                      color: 'var(--text1)', fontSize: 13, lineHeight: 1.5,
                    }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button className="btn btn-primary btn-sm" disabled={updateMut.isPending}
                      onClick={() => updateMut.mutate()}>
                      {updateMut.isPending ? '⏳' : 'Salvar'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{
                    fontSize: 13, color: 'var(--text2)', lineHeight: 1.6,
                    background: 'var(--bg3)', borderRadius: 8, padding: '8px 12px',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {renderText(c.content)}
                  </div>
                  {(c.user.id === me?.id || me?.role === 'ADMIN') && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      {c.user.id === me?.id && (
                        <button className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11, color: 'var(--text3)', padding: '2px 6px' }}
                          onClick={() => { setEditId(c.id); setEditText(c.content); }}>
                          ✏️ Editar
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, color: '#ef4444', padding: '2px 6px' }}
                        onClick={() => { if (window.confirm('Excluir comentário?')) deleteMut.mutate(c.id); }}>
                        🗑️ Excluir
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', padding: '8px 0' }}>
            Nenhum comentário ainda. Seja o primeiro!
          </div>
        )}
      </div>

      {/* New comment input */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {me && <Avatar user={me} size={30} />}
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={textareaRef}
            placeholder="Adicionar comentário… Use @ para mencionar alguém"
            value={text}
            onChange={e => handleInput(e.target.value, e.target.selectionStart ?? 0)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim()) {
                e.preventDefault();
                createMut.mutate();
              }
            }}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'vertical',
              minHeight: 72, padding: '8px 12px', borderRadius: 8,
              background: 'var(--bg3)', border: '1px solid var(--border)',
              color: 'var(--text1)', fontSize: 13, lineHeight: 1.5,
              outline: 'none',
            }}
          />

          {/* @mention autocomplete */}
          {showMentions && filteredUsers.length > 0 && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0,
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              overflow: 'hidden', zIndex: 50,
            }}>
              {filteredUsers.slice(0, 5).map((u: ProjectUser) => (
                <div
                  key={u.id}
                  onClick={() => insertMention(u)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', background: u.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: '#fff',
                  }}>
                    {u.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text1)' }}>{u.name}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Ctrl+Enter para enviar · @ para mencionar</span>
            <button
              className="btn btn-primary btn-sm"
              disabled={!text.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? '⏳' : '💬 Comentar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
