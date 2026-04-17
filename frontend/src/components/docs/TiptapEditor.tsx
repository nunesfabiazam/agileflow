import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

const EDITOR_CSS = `
.ProseMirror {
  outline: none;
  min-height: 400px;
  color: var(--text1);
  font-size: 15px;
  line-height: 1.75;
  caret-color: var(--accent);
}
.ProseMirror > * + * { margin-top: 0.6em; }
.ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--text3);
  pointer-events: none;
  height: 0;
  font-style: italic;
}
.ProseMirror h1 { font-size: 1.9em; font-weight: 700; line-height: 1.2; margin-top: 1.2em; color: var(--text1); }
.ProseMirror h2 { font-size: 1.4em; font-weight: 700; line-height: 1.3; margin-top: 1.1em; color: var(--text1); }
.ProseMirror h3 { font-size: 1.15em; font-weight: 700; line-height: 1.4; margin-top: 1em; color: var(--text1); }
.ProseMirror ul { padding-left: 1.5em; list-style-type: disc; }
.ProseMirror ol { padding-left: 1.5em; list-style-type: decimal; }
.ProseMirror li { margin: 0.25em 0; }
.ProseMirror li > p { margin: 0; }
.ProseMirror blockquote {
  border-left: 3px solid var(--accent);
  padding-left: 1em; margin: 1em 0;
  color: var(--text2); font-style: italic;
}
.ProseMirror code {
  background: var(--bg4);
  padding: 0.15em 0.45em; border-radius: 4px;
  font-family: monospace; font-size: 0.88em; color: #a78bfa;
}
.ProseMirror pre {
  background: var(--bg4); border: 1px solid var(--border);
  padding: 1em 1.2em; border-radius: 8px; margin: 1em 0; overflow-x: auto;
}
.ProseMirror pre code { background: none; padding: 0; color: var(--text1); font-size: 13px; }
.ProseMirror hr { border: none; border-top: 1px solid var(--border); margin: 1.8em 0; }
.ProseMirror strong { font-weight: 700; }
.ProseMirror em { font-style: italic; }
.ProseMirror s { text-decoration: line-through; opacity: .7; }
`;

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
}

export function TiptapEditor({ content, onChange, placeholder = 'Comece a escrever...', editable = true }: Props) {
  useEffect(() => {
    if (!document.getElementById('tiptap-global-css')) {
      const el = document.createElement('style');
      el.id = 'tiptap-global-css';
      el.textContent = EDITOR_CSS;
      document.head.appendChild(el);
    }
  }, []);

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({ codeBlock: { languageClassPrefix: 'language-' } }),
      Placeholder.configure({ placeholder }),
    ],
    content: content || '',
    onUpdate: ({ editor: ed }) => { onChange(ed.getHTML()); },
  });

  if (!editor) return <div style={{ minHeight: 400 }} />;

  const btn = (label: string, onClick: () => void, active: boolean, title?: string) => (
    <button key={label} onMouseDown={e => { e.preventDefault(); onClick(); }} title={title ?? label}
      style={{
        padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
        fontWeight: 600, border: 'none', transition: 'all .1s', minWidth: 32,
        background: active ? 'var(--accent)' : 'var(--bg4)',
        color: active ? '#fff' : 'var(--text2)',
      }}>{label}</button>
  );
  const sep = (key: string) => (
    <div key={key} style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px', alignSelf: 'center' }} />
  );
  const c = editor.chain().focus();

  return (
    <div>
      {editable && (
        <div style={{
          display: 'flex', gap: 3, alignItems: 'center',
          padding: '8px 0', marginBottom: 12, borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap', position: 'sticky', top: 0, background: 'var(--bg1)', zIndex: 10,
        }}>
          {btn('B',         () => c.toggleBold().run(),                   editor.isActive('bold'),              'Negrito')}
          {btn('I',         () => c.toggleItalic().run(),                 editor.isActive('italic'),            'Itálico')}
          {btn('S̶',         () => c.toggleStrike().run(),                 editor.isActive('strike'),            'Tachado')}
          {btn('`',         () => c.toggleCode().run(),                   editor.isActive('code'),              'Código inline')}
          {sep('s1')}
          {btn('H1',        () => c.toggleHeading({ level: 1 }).run(),   editor.isActive('heading',{level:1}), 'Título 1')}
          {btn('H2',        () => c.toggleHeading({ level: 2 }).run(),   editor.isActive('heading',{level:2}), 'Título 2')}
          {btn('H3',        () => c.toggleHeading({ level: 3 }).run(),   editor.isActive('heading',{level:3}), 'Título 3')}
          {sep('s2')}
          {btn('• Lista',   () => c.toggleBulletList().run(),             editor.isActive('bulletList'),        'Lista')}
          {btn('1. Lista',  () => c.toggleOrderedList().run(),            editor.isActive('orderedList'),       'Lista numerada')}
          {btn('" Citação', () => c.toggleBlockquote().run(),             editor.isActive('blockquote'),        'Citação')}
          {btn('</> Código',() => c.toggleCodeBlock().run(),              editor.isActive('codeBlock'),         'Bloco de código')}
          {sep('s3')}
          {btn('— Divisor', () => c.setHorizontalRule().run(),            false,                                'Linha divisória')}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
