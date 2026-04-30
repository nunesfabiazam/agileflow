import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { TaskList } from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import { useEffect, useState, useRef, useCallback } from 'react';

// ── styles ───────────────────────────────────────────────────────────────────
const EDITOR_CSS = `
.ProseMirror { outline: none; min-height: 500px; color: var(--text1); font-size: 16px; line-height: 1.8; caret-color: var(--accent); }
.ProseMirror > * + * { margin-top: 0.75em; }
.ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder); float: left; color: var(--text3);
  pointer-events: none; height: 0; font-style: italic;
}
.ProseMirror h1 { font-size: 1.9em; font-weight: 800; line-height: 1.15; margin-top: 1.5em; color: var(--text1); }
.ProseMirror h2 { font-size: 1.45em; font-weight: 700; line-height: 1.25; margin-top: 1.3em; color: var(--text1); }
.ProseMirror h3 { font-size: 1.2em; font-weight: 700; line-height: 1.35; margin-top: 1.1em; color: var(--text1); }
.ProseMirror ul { padding-left: 1.6em; list-style-type: disc; }
.ProseMirror ol { padding-left: 1.6em; list-style-type: decimal; }
.ProseMirror li { margin: 0.3em 0; }
.ProseMirror li > p { margin: 0; }
.ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0; }
.ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 8px; }
.ProseMirror ul[data-type="taskList"] li > label { flex-shrink: 0; margin-top: 4px; }
.ProseMirror ul[data-type="taskList"] li input[type="checkbox"] {
  width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer;
}
.ProseMirror ul[data-type="taskList"] li > div { flex: 1; }
.ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div { opacity: 0.5; text-decoration: line-through; }
.ProseMirror blockquote {
  border-left: 4px solid var(--accent); padding: 4px 0 4px 16px;
  margin: 1.2em 0; color: var(--text2); background: rgba(99,102,241,0.05); border-radius: 0 6px 6px 0;
}
.ProseMirror code {
  background: var(--bg4); padding: 0.15em 0.45em; border-radius: 4px;
  font-family: monospace; font-size: 0.87em; color: #a78bfa;
}
.ProseMirror pre {
  background: #0d1117; border: 1px solid var(--border);
  padding: 1em 1.2em; border-radius: 10px; margin: 1.2em 0; overflow-x: auto;
}
.ProseMirror pre code { background: none; padding: 0; color: #e6edf3; font-size: 13.5px; }
.ProseMirror hr { border: none; border-top: 2px solid var(--border); margin: 2em 0; }
.ProseMirror strong { font-weight: 700; }
.ProseMirror em { font-style: italic; }
.ProseMirror s { text-decoration: line-through; opacity: .65; }
.ProseMirror u { text-decoration: underline; }
.ProseMirror mark { background: rgba(251,191,36,.35); border-radius: 3px; padding: 1px 2px; }
.ProseMirror a { color: var(--accent); text-decoration: underline; cursor: pointer; }
.ProseMirror a:hover { opacity: 0.8; }
.ProseMirror img { max-width: 100%; border-radius: 8px; margin: 0.5em 0; }
.ProseMirror table { border-collapse: collapse; width: 100%; margin: 1.2em 0; table-layout: fixed; }
.ProseMirror table td, .ProseMirror table th {
  border: 1px solid var(--border); padding: 8px 12px; vertical-align: top;
  min-width: 80px; position: relative; font-size: 14px;
}
.ProseMirror table th { background: var(--bg3); font-weight: 700; font-size: 13px; color: var(--text2); }
.ProseMirror .selectedCell:after { background: rgba(99,102,241,0.12); content: ""; left: 0; right: 0; top: 0; bottom: 0; pointer-events: none; position: absolute; z-index: 2; }
`;

// ── slash commands ────────────────────────────────────────────────────────────
type SlashItem = { icon: string; label: string; hint: string; action: (ed: ReturnType<typeof useEditor>) => void };

const SLASH_ITEMS: SlashItem[] = [
  { icon: '📝', label: 'Parágrafo',       hint: 'Texto simples',           action: ed => ed?.chain().focus().setParagraph().run() },
  { icon: '🔠', label: 'Título 1',         hint: 'Seção grande',            action: ed => ed?.chain().focus().toggleHeading({ level: 1 }).run() },
  { icon: '🔡', label: 'Título 2',         hint: 'Seção média',             action: ed => ed?.chain().focus().toggleHeading({ level: 2 }).run() },
  { icon: '🔤', label: 'Título 3',         hint: 'Seção pequena',           action: ed => ed?.chain().focus().toggleHeading({ level: 3 }).run() },
  { icon: '•',  label: 'Lista',            hint: 'Lista com marcadores',    action: ed => ed?.chain().focus().toggleBulletList().run() },
  { icon: '1.', label: 'Lista Numerada',   hint: 'Lista ordenada',          action: ed => ed?.chain().focus().toggleOrderedList().run() },
  { icon: '☑️', label: 'Lista de Tarefas', hint: 'Checkboxes',              action: ed => ed?.chain().focus().toggleTaskList().run() },
  { icon: '"',  label: 'Citação',          hint: 'Bloco de citação',        action: ed => ed?.chain().focus().toggleBlockquote().run() },
  { icon: '</>', label: 'Código',          hint: 'Bloco de código',         action: ed => ed?.chain().focus().toggleCodeBlock().run() },
  { icon: '⊞',  label: 'Tabela',          hint: 'Inserir 3×3',             action: ed => ed?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { icon: '—',  label: 'Divisor',         hint: 'Linha horizontal',        action: ed => ed?.chain().focus().setHorizontalRule().run() },
  { icon: '🖼️', label: 'Imagem via URL',  hint: 'Cole a URL da imagem',    action: ed => { const url = prompt('URL da imagem:'); if (url && ed) ed.chain().focus().setImage({ src: url }).run(); } },
];

// ── Toolbar button ────────────────────────────────────────────────────────────
function Btn({ label, onClick, active, title }: { label: React.ReactNode; onClick: () => void; active: boolean; title?: string }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title ?? (typeof label === 'string' ? label : '')}
      style={{
        padding: '4px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
        fontWeight: 600, border: 'none', transition: 'all .1s', minWidth: 28, height: 28,
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--text2)',
      }}
    >{label}</button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 3px', alignSelf: 'center' }} />;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  onHeadingsChange?: (headings: { level: number; text: string }[]) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function TiptapEditor({ content, onChange, placeholder = 'Comece a escrever… ou pressione "/" para comandos', editable = true, onHeadingsChange }: Props) {
  const [slashQuery, setSlashQuery] = useState('');
  const [slashOpen, setSlashOpen]   = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [linkUrl, setLinkUrl]       = useState('');
  const [linkOpen, setLinkOpen]     = useState(false);
  const slashQueryRef = useRef(slashQuery);
  const slashOpenRef  = useRef(slashOpen);
  slashQueryRef.current = slashQuery;
  slashOpenRef.current  = slashOpen;

  useEffect(() => {
    if (!document.getElementById('tiptap-global-css')) {
      const el = document.createElement('style');
      el.id = 'tiptap-global-css';
      el.textContent = EDITOR_CSS;
      document.head.appendChild(el);
    }
  }, []);

  const extractHeadings = useCallback((ed: ReturnType<typeof useEditor>) => {
    if (!ed || !onHeadingsChange) return;
    const headings: { level: number; text: string }[] = [];
    ed.state.doc.descendants(node => {
      if (node.type.name === 'heading') headings.push({ level: node.attrs.level as number, text: node.textContent });
    });
    onHeadingsChange(headings);
  }, [onHeadingsChange]);

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({ codeBlock: { languageClassPrefix: 'language-' } }),
      Placeholder.configure({ placeholder }),
      Underline,
      Highlight,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false, allowBase64: true }),
      TableKit.configure({}),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: content || '',
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
      extractHeadings(ed);

      // Detect slash command
      const { state } = ed.view;
      const { from } = state.selection;
      const lineStart = state.doc.resolve(from).start();
      const line = state.doc.textBetween(lineStart, from);
      const slashIdx = line.lastIndexOf('/');
      if (slashIdx !== -1) {
        const query = line.slice(slashIdx + 1);
        if (!/\s/.test(query)) {
          setSlashQuery(query);
          setSlashOpen(true);
          setSlashIndex(0);
          return;
        }
      }
      setSlashOpen(false);
      setSlashQuery('');
    },
  });

  // Keyboard nav for slash menu
  useEffect(() => {
    if (!editable) return;
    const filtered = SLASH_ITEMS.filter(i => !slashQueryRef.current || i.label.toLowerCase().includes(slashQueryRef.current.toLowerCase()));
    const handler = (e: KeyboardEvent) => {
      if (!slashOpenRef.current) return;
      if (e.key === 'ArrowDown')  { e.preventDefault(); setSlashIndex(i => (i + 1) % Math.max(filtered.length, 1)); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); setSlashIndex(i => (i - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1)); }
      else if (e.key === 'Escape')    { setSlashOpen(false); }
      else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        handleSlashSelectRef.current(filtered[slashIndex] ?? filtered[0]);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [editable, slashIndex]);

  const handleSlashSelect = useCallback((item: SlashItem) => {
    if (!editor) return;
    const { state, dispatch } = editor.view;
    const { from } = state.selection;
    const lineStart = state.doc.resolve(from).start();
    const line = state.doc.textBetween(lineStart, from);
    const slashIdx = line.lastIndexOf('/');
    if (slashIdx !== -1) {
      const start = lineStart + slashIdx;
      dispatch(state.tr.delete(start, from));
    }
    item.action(editor);
    setSlashOpen(false);
    setSlashQuery('');
  }, [editor]);
  const handleSlashSelectRef = useRef(handleSlashSelect);
  handleSlashSelectRef.current = handleSlashSelect;

  const handleSetLink = () => {
    if (!editor) return;
    if (!linkUrl) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    setLinkOpen(false);
    setLinkUrl('');
  };

  if (!editor) return <div style={{ minHeight: 500 }} />;

  const filtered = SLASH_ITEMS.filter(i => !slashQuery || i.label.toLowerCase().includes(slashQuery.toLowerCase()));

  return (
    <div style={{ position: 'relative' }}>

      {/* ── Static toolbar ─────────────────────────────────────────────── */}
      {editable && (
        <div style={{
          display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap',
          padding: '8px 12px', marginBottom: 12,
          border: '1px solid var(--border)', borderRadius: 10,
          background: 'var(--bg2)', position: 'sticky', top: 0, zIndex: 20,
        }}>
          <Btn label="B"  onClick={() => editor.chain().focus().toggleBold().run()}      active={editor.isActive('bold')}      title="Negrito (⌘B)" />
          <Btn label="I"  onClick={() => editor.chain().focus().toggleItalic().run()}    active={editor.isActive('italic')}    title="Itálico (⌘I)" />
          <Btn label="U"  onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Sublinhado (⌘U)" />
          <Btn label="S̶"  onClick={() => editor.chain().focus().toggleStrike().run()}    active={editor.isActive('strike')}    title="Tachado" />
          <Btn label="`"  onClick={() => editor.chain().focus().toggleCode().run()}      active={editor.isActive('code')}      title="Código inline" />
          <Btn label="🖊" onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Destacar" />
          <Sep />
          <Btn label="H1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Título 1" />
          <Btn label="H2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Título 2" />
          <Btn label="H3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Título 3" />
          <Sep />
          <Btn label="•≡"  onClick={() => editor.chain().focus().toggleBulletList().run()}  active={editor.isActive('bulletList')}  title="Lista" />
          <Btn label="1≡"  onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada" />
          <Btn label="☑"   onClick={() => editor.chain().focus().toggleTaskList().run()}    active={editor.isActive('taskList')}    title="Lista de tarefas" />
          <Sep />
          <Btn label={'" '} onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citação" />
          <Btn label="</>"  onClick={() => editor.chain().focus().toggleCodeBlock().run()}  active={editor.isActive('codeBlock')}  title="Bloco de código" />
          <Sep />
          {/* Table */}
          <Btn label="⊞" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} active={false} title="Inserir tabela" />
          {editor.isActive('table') && <>
            <Btn label="+col" onClick={() => editor.chain().focus().addColumnAfter().run()}  active={false} title="Adicionar coluna" />
            <Btn label="-col" onClick={() => editor.chain().focus().deleteColumn().run()}    active={false} title="Remover coluna" />
            <Btn label="+lin" onClick={() => editor.chain().focus().addRowAfter().run()}     active={false} title="Adicionar linha" />
            <Btn label="-lin" onClick={() => editor.chain().focus().deleteRow().run()}       active={false} title="Remover linha" />
            <Btn label="✕tb" onClick={() => editor.chain().focus().deleteTable().run()}     active={false} title="Deletar tabela" />
          </>}
          <Sep />
          {/* Link */}
          <div style={{ position: 'relative' }}>
            <Btn
              label="🔗"
              onClick={() => { setLinkUrl(editor.getAttributes('link').href as string ?? ''); setLinkOpen(v => !v); }}
              active={editor.isActive('link')} title="Link"
            />
            {linkOpen && (
              <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 50, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'flex', gap: 6, boxShadow: '0 4px 20px rgba(0,0,0,.25)', minWidth: 280 }}>
                <input
                  autoFocus value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://..." onKeyDown={e => e.key === 'Enter' && handleSetLink()}
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button className="btn btn-primary btn-sm" onMouseDown={e => { e.preventDefault(); handleSetLink(); }}>OK</button>
                {editor.isActive('link') && <button className="btn btn-ghost btn-sm" onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetLink().run(); setLinkOpen(false); }}>✕</button>}
              </div>
            )}
          </div>
          {/* Image */}
          <Btn label="🖼" onClick={() => { const u = prompt('URL da imagem:'); if (u) editor.chain().focus().setImage({ src: u }).run(); }} active={false} title="Imagem via URL" />
          <Sep />
          <Btn label="—" onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Divisor" />
          <Btn label="↩" onClick={() => editor.chain().undo().run()} active={false} title="Desfazer (⌘Z)" />
          <Btn label="↪" onClick={() => editor.chain().redo().run()} active={false} title="Refazer" />
        </div>
      )}

      {/* ── Bubble menu (appears on text selection) ─────────────────────── */}
      {editable && (
        <BubbleMenu
          editor={editor}
          style={{
            display: 'flex', gap: 2, padding: '4px 6px',
            background: 'var(--bg1)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.35)', zIndex: 100,
          }}
        >
          <Btn label="B"  onClick={() => editor.chain().focus().toggleBold().run()}      active={editor.isActive('bold')}      title="Negrito" />
          <Btn label="I"  onClick={() => editor.chain().focus().toggleItalic().run()}    active={editor.isActive('italic')}    title="Itálico" />
          <Btn label="U"  onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Sublinhado" />
          <Btn label="S̶"  onClick={() => editor.chain().focus().toggleStrike().run()}    active={editor.isActive('strike')}    title="Tachado" />
          <Btn label="🖊" onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Destacar" />
          <Sep />
          <Btn label="H1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} />
          <Btn label="H2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} />
          <Sep />
          <Btn
            label="🔗"
            onClick={() => { setLinkUrl(editor.getAttributes('link').href as string ?? ''); setLinkOpen(v => !v); }}
            active={editor.isActive('link')} title="Link"
          />
          <Btn label="`" onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Código" />
        </BubbleMenu>
      )}

      {/* ── Slash command menu ───────────────────────────────────────────── */}
      {editable && slashOpen && filtered.length > 0 && (
        <div style={{
          position: 'absolute', zIndex: 200,
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.35)',
          width: 260, overflow: 'hidden',
          top: 60, left: 12,
        }}>
          <div style={{ padding: '6px 10px 4px', fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--border)' }}>
            Inserir bloco {slashQuery && <span style={{ textTransform: 'none', fontWeight: 400 }}>— "{slashQuery}"</span>}
          </div>
          {filtered.map((item, idx) => (
            <div
              key={item.label}
              onMouseDown={e => { e.preventDefault(); handleSlashSelect(item); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px',
                cursor: 'pointer', transition: 'background .1s',
                background: idx === slashIndex ? 'rgba(99,102,241,.12)' : 'transparent',
              }}
              onMouseEnter={() => setSlashIndex(idx)}
            >
              <span style={{ width: 26, textAlign: 'center', fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{item.hint}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Editor content ───────────────────────────────────────────────── */}
      <EditorContent editor={editor} />
    </div>
  );
}
