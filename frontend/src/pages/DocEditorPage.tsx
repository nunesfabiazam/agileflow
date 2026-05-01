import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../api';
import { useAppStore } from '../store/useAppStore';
import { TiptapEditor } from '../components/docs/TiptapEditor';
import { Avatar } from '../components/Shared/Avatar';
import type { Document, DocType, DocStatus, DocSpace } from '../types';

const DOC_TYPE_OPTS: { value: DocType; label: string; icon: string }[] = [
  { value: 'SPEC',      label: 'Spec',            icon: '📋' },
  { value: 'DIAGRAM',   label: 'Diagrama',         icon: '🗺️' },
  { value: 'DESIGN',    label: 'Design',           icon: '🎨' },
  { value: 'REFERENCE', label: 'Referência',       icon: '📚' },
  { value: 'TEMPLATE',  label: 'Template',         icon: '📄' },
  { value: 'TEST_PLAN', label: 'Plano de Testes',  icon: '🧪' },
  { value: 'WIREFRAME', label: 'Wireframe',        icon: '✏️' },
  { value: 'RUNBOOK',   label: 'Runbook',          icon: '🔧' },
  { value: 'OTHER',     label: 'Outro',            icon: '📝' },
];

const COVER_GRADIENTS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  'linear-gradient(135deg,#fccb90,#d57eeb)',
  'linear-gradient(135deg,#a1c4fd,#c2e9fb)',
];

const EMOJIS = ['📋','🚀','💡','🛠️','🧪','📊','🎨','🔒','📄','🌐','⚡','🎯','🔥','💎','🌟','📌','🗂️','🏔️'];

interface Heading { level: number; text: string }

export function DocEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const activeProjectId = useAppStore(s => s.activeProjectId);

  const [title, setTitle]         = useState('');
  const [content, setContent]     = useState('');
  const [docType, setDocType]     = useState<DocType>('OTHER');
  const [spaceId, setSpaceId]     = useState<string | undefined>();
  const [emoji, setEmoji]         = useState('📝');
  const [coverIdx, setCoverIdx]   = useState<number | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [ready, setReady]         = useState(false);
  const [headings, setHeadings]   = useState<Heading[]>([]);
  const [showToc, setShowToc]     = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [showMeta, setShowMeta]   = useState(false);

  // Status workflow
  const [docStatus, setDocStatus] = useState<DocStatus>('DRAFT');
  // When a PUBLISHED doc has "Editar" clicked, isEditing = true (local only)
  const [isEditing, setIsEditing] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: doc } = useQuery<Document | undefined>({
    queryKey: ['doc', id],
    queryFn:  () => documentsApi.get(id!).then(r => r.data.data),
    enabled:  !!id,
  });

  const { data: spaces = [] } = useQuery<DocSpace[]>({
    queryKey: ['spaces', activeProjectId],
    queryFn:  () => documentsApi.listSpaces(activeProjectId!).then(r => r.data.data ?? []),
    enabled:  !!activeProjectId,
  });

  useEffect(() => {
    if (doc && !ready) {
      setTitle(doc.title);
      setContent(doc.content ?? '');
      setDocType(doc.type);
      setSpaceId(doc.space?.id);
      setDocStatus((doc as any).status ?? 'DRAFT');
      setReady(true);
    }
  }, [doc, ready]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (
        emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node) &&
        emojiBtnRef.current && !emojiBtnRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  const saveMut = useMutation({
    mutationFn: (vars: { t: string; c: string; dt: DocType; si?: string; st?: DocStatus }) =>
      documentsApi.update(id!, {
        title: vars.t, content: vars.c, type: vars.dt,
        spaceId: vars.si,
        ...(vars.st && { status: vars.st }),
      }),
    onSuccess: (res) => {
      const updated = res.data.data;
      if (updated?.status) setDocStatus(updated.status);
      qc.invalidateQueries({ queryKey: ['doc', id] });
      qc.invalidateQueries({ queryKey: ['docs', activeProjectId] });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    },
  });

  const scheduleSave = useCallback(
    (t: string, c: string, dt: DocType, si?: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveState('saving');
      saveTimer.current = setTimeout(() => saveMut.mutate({ t, c, dt, si }), 1500);
    },
    [saveMut],
  );

  const handleTitleChange   = (v: string) => { setTitle(v);   scheduleSave(v,     content, docType, spaceId); };
  const handleContentChange = (v: string) => { setContent(v); scheduleSave(title, v,       docType, spaceId); };
  const handleTypeChange    = (v: DocType) => { setDocType(v); scheduleSave(title, content, v,       spaceId); };
  const handleSpaceChange   = (v: string) => { const s = v || undefined; setSpaceId(s); scheduleSave(title, content, docType, s); };

  // Publish: save current state + set status PUBLISHED + exit editing mode
  const handlePublish = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveMut.mutate(
      { t: title, c: content, dt: docType, si: spaceId, st: 'PUBLISHED' },
      { onSuccess: () => { setIsEditing(false); } },
    );
  };

  // Save while editing a published doc (keeps PUBLISHED status)
  const handleSaveEdits = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveMut.mutate(
      { t: title, c: content, dt: docType, si: spaceId },
      { onSuccess: () => { setIsEditing(false); } },
    );
  };

  // Revert to draft
  const handleRevertToDraft = () => {
    saveMut.mutate({ t: title, c: content, dt: docType, si: spaceId, st: 'DRAFT' });
    setDocStatus('DRAFT');
    setIsEditing(false);
  };

  const scrollToHeading = (h: Heading) => {
    const els = document.querySelectorAll('.ProseMirror h1, .ProseMirror h2, .ProseMirror h3');
    for (const el of Array.from(els)) {
      if (el.textContent?.trim() === h.text) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
    }
  };

  if (!doc || !ready) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <div className="spinner" />
    </div>
  );

  const curSpace = spaces.find(s => s.id === spaceId);
  // Editor is editable when: DRAFT, or PUBLISHED + isEditing
  const editable = docStatus === 'DRAFT' || isEditing;

  const statusBadge = {
    DRAFT:     { label: 'Rascunho', bg: 'rgba(234,179,8,.15)',  color: '#ca8a04',  dot: '#eab308' },
    PUBLISHED: { label: 'Publicado', bg: 'rgba(34,197,94,.12)', color: '#16a34a',  dot: '#22c55e' },
  }[docStatus];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg1)' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <button
          onClick={() => navigate('/documents')}
          style={{ color: 'var(--text3)', padding: '4px 10px', borderRadius: 6, background: 'var(--bg4)', fontSize: 13, flexShrink: 0, border: 'none', cursor: 'pointer' }}
        >← Docs</button>

        {/* Breadcrumb */}
        <span style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>
          {curSpace ? `${curSpace.icon ?? '📁'} ${curSpace.name}` : '📁 Sem espaço'} /
        </span>
        <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
          {title || 'Sem título'}
        </span>

        {/* Status badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 10px', borderRadius: 20,
          background: statusBadge.bg, flexShrink: 0,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusBadge.dot }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: statusBadge.color, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {statusBadge.label}
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* ── Status actions ── */}
        {docStatus === 'DRAFT' && (
          <button
            onClick={handlePublish}
            style={{ fontSize: 12, padding: '5px 14px', borderRadius: 6, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >🚀 Publicar</button>
        )}

        {docStatus === 'PUBLISHED' && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            style={{ fontSize: 12, padding: '5px 14px', borderRadius: 6, background: 'var(--bg4)', color: 'var(--text1)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600 }}
          >✏️ Editar</button>
        )}

        {docStatus === 'PUBLISHED' && isEditing && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>⚠ Modo edição</span>
            <button
              onClick={handleSaveEdits}
              style={{ fontSize: 12, padding: '5px 14px', borderRadius: 6, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >💾 Salvar</button>
            <button
              onClick={() => setIsEditing(false)}
              style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, background: 'var(--bg4)', color: 'var(--text3)', border: '1px solid var(--border)', cursor: 'pointer' }}
            >✕ Cancelar</button>
          </div>
        )}

        {/* Revert to draft (only for published docs) */}
        {docStatus === 'PUBLISHED' && (
          <button
            onClick={handleRevertToDraft}
            title="Mover de volta para Rascunho"
            style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'transparent', color: 'var(--text3)', border: '1px solid var(--border)', cursor: 'pointer' }}
          >↩ Rascunho</button>
        )}

        {/* Meta button */}
        <button
          onClick={() => setShowMeta(v => !v)}
          style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: showMeta ? 'var(--accent)' : 'var(--bg4)', color: showMeta ? '#fff' : 'var(--text2)', border: 'none', cursor: 'pointer' }}
        >⚙ Detalhes</button>

        {/* TOC button */}
        <button
          onClick={() => setShowToc(v => !v)}
          style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: showToc ? 'var(--accent)' : 'var(--bg4)', color: showToc ? '#fff' : 'var(--text2)', border: 'none', cursor: 'pointer' }}
          title="Sumário"
        >≡ Sumário</button>

        {/* Save state */}
        <span style={{ fontSize: 12, color: saveState === 'saved' ? '#22c55e' : 'var(--text3)', flexShrink: 0, minWidth: 90, textAlign: 'right' }}>
          {saveState === 'saving' && '⏳ Salvando...'}
          {saveState === 'saved'  && '✅ Salvo'}
          {saveState === 'idle'   && `v${doc.version}`}
        </span>
      </div>

      {/* Read-only banner for published docs */}
      {docStatus === 'PUBLISHED' && !isEditing && (
        <div style={{
          background: 'rgba(34,197,94,.07)', borderBottom: '1px solid rgba(34,197,94,.2)',
          padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, color: '#16a34a' }}>
            🔒 Este documento está publicado e em modo somente leitura. Clique em <strong>Editar</strong> para fazer alterações.
          </span>
        </div>
      )}

      {/* Editing banner for published docs in edit mode */}
      {docStatus === 'PUBLISHED' && isEditing && (
        <div style={{
          background: 'rgba(245,158,11,.07)', borderBottom: '1px solid rgba(245,158,11,.25)',
          padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, color: '#b45309' }}>
            ✏️ Você está editando um documento publicado. Clique em <strong>Salvar</strong> para confirmar as alterações, ou <strong>Cancelar</strong> para descartar.
          </span>
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Cover image strip */}
          {coverIdx !== null && (
            <div style={{ height: 180, background: COVER_GRADIENTS[coverIdx], position: 'relative' }}>
              {editable && (
                <button
                  onClick={() => setCoverIdx(null)}
                  style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.35)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
                >✕ Remover capa</button>
              )}
            </div>
          )}

          {/* Page area (centered, max-width 860px) */}
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 64px 80px' }}>

            {/* Hover actions above title — only when editable */}
            {editable && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, opacity: 0.6 }}>
                {/* Emoji picker */}
                <div style={{ position: 'relative' }}>
                  <button
                    ref={emojiBtnRef}
                    onClick={() => setShowEmojiPicker(v => !v)}
                    style={{ fontSize: 36, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0 }}
                    title="Mudar emoji"
                  >{emoji}</button>
                  {showEmojiPicker && (() => {
                    const rect = emojiBtnRef.current?.getBoundingClientRect();
                    return (
                      <div
                        ref={emojiPickerRef}
                        style={{
                          position: 'fixed',
                          top: rect ? rect.bottom + 8 : 200,
                          left: rect ? rect.left : 100,
                          zIndex: 9999,
                          background: 'var(--bg2)', border: '1px solid var(--border)',
                          borderRadius: 10, padding: 10,
                          display: 'flex', flexWrap: 'wrap', gap: 4, width: 240,
                          boxShadow: '0 8px 32px rgba(0,0,0,.35)',
                        }}
                      >
                        {EMOJIS.map(e => (
                          <div key={e} onClick={() => { setEmoji(e); setShowEmojiPicker(false); }}
                            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, cursor: 'pointer', borderRadius: 6, background: e === emoji ? 'var(--bg4)' : 'transparent' }}>
                            {e}
                          </div>
                        ))}
                      </div>
                    );
                  })()}</div>

                {/* Add cover */}
                {coverIdx === null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginLeft: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>Capa:</span>
                    {COVER_GRADIENTS.map((g, idx) => (
                      <div key={idx} onClick={() => setCoverIdx(idx)} style={{ width: 24, height: 18, borderRadius: 4, background: g, cursor: 'pointer', border: '1px solid rgba(255,255,255,.1)' }} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Emoji (read-only) */}
            {!editable && (
              <div style={{ fontSize: 36, marginBottom: 16, lineHeight: 1 }}>{emoji}</div>
            )}

            {/* Title */}
            {editable ? (
              <input
                value={title}
                onChange={e => handleTitleChange(e.target.value)}
                placeholder="Título sem título"
                style={{
                  width: '100%', fontSize: 36, fontWeight: 800, lineHeight: 1.2,
                  color: 'var(--text1)', background: 'transparent', border: 'none',
                  outline: 'none', marginBottom: 32, display: 'block', padding: 0,
                  fontFamily: 'inherit',
                }}
              />
            ) : (
              <h1 style={{
                fontSize: 36, fontWeight: 800, lineHeight: 1.2,
                color: 'var(--text1)', marginBottom: 32,
              }}>{title || 'Sem título'}</h1>
            )}

            {/* Editor */}
            <TiptapEditor
              content={content}
              onChange={handleContentChange}
              onHeadingsChange={setHeadings}
              editable={editable}
              placeholder='Comece a escrever… ou pressione "/" para inserir um bloco'
            />
          </div>
        </div>

        {/* ── Right panels ─────────────────────────────────────────────── */}
        {(showToc || showMeta) && (
          <div style={{ width: 240, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--bg2)', overflow: 'auto', padding: '16px 0' }}>

            {/* TOC */}
            {showToc && headings.length > 0 && (
              <div style={{ padding: '0 14px 16px', borderBottom: showMeta ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10, letterSpacing: '.07em' }}>Sumário</div>
                {headings.map((h, idx) => (
                  <div
                    key={idx}
                    onClick={() => scrollToHeading(h)}
                    style={{
                      paddingLeft: (h.level - 1) * 12,
                      padding: `4px ${0}px 4px ${(h.level - 1) * 12}px`,
                      fontSize: 12, color: 'var(--text2)', cursor: 'pointer',
                      borderRadius: 4, transition: 'all .1s', lineHeight: 1.4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
                    title={h.text}
                  >
                    {h.level === 1 ? '●' : h.level === 2 ? '○' : '·'} {h.text}
                  </div>
                ))}
              </div>
            )}
            {showToc && headings.length === 0 && (
              <div style={{ padding: '0 14px 16px', borderBottom: showMeta ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8, letterSpacing: '.07em' }}>Sumário</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Adicione títulos (H1, H2, H3) para gerar o sumário automaticamente.</div>
              </div>
            )}

            {/* Meta */}
            {showMeta && (
              <div style={{ padding: '16px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 12, letterSpacing: '.07em' }}>Detalhes</div>

                {/* Status info */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Status</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusBadge.dot }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: statusBadge.color }}>{statusBadge.label}</span>
                  </div>
                </div>

                {/* Type */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tipo</div>
                  {editable ? (
                    <select
                      value={docType} onChange={e => handleTypeChange(e.target.value as DocType)}
                      style={{ width: '100%', fontSize: 12, padding: '5px 8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)' }}
                    >
                      {DOC_TYPE_OPTS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                    </select>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {DOC_TYPE_OPTS.find(t => t.value === docType)?.icon} {DOC_TYPE_OPTS.find(t => t.value === docType)?.label}
                    </span>
                  )}
                </div>

                {/* Space */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Espaço</div>
                  {editable ? (
                    <select
                      value={spaceId ?? ''} onChange={e => handleSpaceChange(e.target.value)}
                      style={{ width: '100%', fontSize: 12, padding: '5px 8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)' }}
                    >
                      <option value="">📁 Sem espaço</option>
                      {spaces.map(s => <option key={s.id} value={s.id}>{s.icon ?? '📁'} {s.name}</option>)}
                    </select>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {curSpace ? `${curSpace.icon ?? '📁'} ${curSpace.name}` : '📁 Sem espaço'}
                    </span>
                  )}
                </div>

                {/* Author */}
                {doc.author && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Autor</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Avatar name={doc.author.name} color={doc.author.color} size="sm" />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)' }}>{doc.author.name}</span>
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 2 }}>
                  <div>📅 Criado: {new Date(doc.createdAt).toLocaleDateString('pt-BR')}</div>
                  <div>✏️ Atualizado: {new Date(doc.updatedAt).toLocaleDateString('pt-BR')}</div>
                  <div>🔢 Versão: {doc.version}</div>
                </div>

                {/* Linked tasks */}
                {(doc.linkedTasks?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8, letterSpacing: '.07em' }}>🔗 Tasks</div>
                    {doc.linkedTasks!.map(lt => (
                      <div key={lt.task.id} style={{ padding: '6px 10px', background: 'var(--bg3)', borderRadius: 6, marginBottom: 4 }}>
                        <code style={{ color: 'var(--text3)', fontSize: 10 }}>{lt.task.taskKey}</code>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{lt.task.title}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
