import { useEffect } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { C } from './ui.js';

/**
 * 富文本编辑器（TipTap）。原来的 contenteditable + execCommand 只能加粗/小标题，
 * 无法承载图片、视频、表格、链接与引用——知识正文的真实需要。
 */

interface ToolDef {
  label: string;
  tip: string;
  heading?: boolean;
  isActive?: (e: Editor) => boolean;
  run: (e: Editor) => void;
}

const TOOLS: ToolDef[] = [
  { label: 'B', tip: '加粗', isActive: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
  { label: 'I', tip: '斜体', isActive: (e) => e.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
  {
    label: 'S',
    tip: '删除线',
    isActive: (e) => e.isActive('strike'),
    run: (e) => e.chain().focus().toggleStrike().run(),
  },
  {
    label: 'H2',
    tip: '大标题',
    heading: true,
    isActive: (e) => e.isActive('heading', { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: 'H3',
    tip: '小标题',
    heading: true,
    isActive: (e) => e.isActive('heading', { level: 3 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  { label: '¶', tip: '正文段落', run: (e) => e.chain().focus().setParagraph().run() },
  {
    label: '•',
    tip: '项目符号',
    isActive: (e) => e.isActive('bulletList'),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: '1.',
    tip: '编号列表',
    isActive: (e) => e.isActive('orderedList'),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    label: '❝',
    tip: '引用',
    isActive: (e) => e.isActive('blockquote'),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    label: '</>',
    tip: '代码块',
    isActive: (e) => e.isActive('codeBlock'),
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  { label: '—', tip: '分隔线', run: (e) => e.chain().focus().setHorizontalRule().run() },
  {
    label: '🔗',
    tip: '链接',
    isActive: (e) => e.isActive('link'),
    run: (e) => {
      const prev = (e.getAttributes('link').href as string) ?? '';
      const url = window.prompt('链接地址（留空则取消链接）', prev);
      if (url === null) return;
      if (!url) {
        e.chain().focus().extendMarkRange('link').unsetLink().run();
        return;
      }
      e.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    },
  },
  {
    label: '🖼',
    tip: '图片（填公网可访问的地址）',
    run: (e) => {
      const url = window.prompt('图片地址（https://…）');
      if (url) e.chain().focus().setImage({ src: url }).run();
    },
  },
  {
    label: '▶',
    tip: '视频（YouTube 链接）',
    run: (e) => {
      const url = window.prompt('视频地址（YouTube 链接）');
      if (url) e.commands.setYoutubeVideo({ src: url, width: 560, height: 315 });
    },
  },
  {
    label: '⊞',
    tip: '表格',
    run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
];

export function RichText({
  value,
  onChange,
  minHeight = 240,
  placeholder,
  editorKey,
}: {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
  placeholder?: string;
  /** 换条目时用它强制重灌内容 */
  editorKey: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Youtube.configure({ controls: true, nocookie: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: value || '',
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  });

  /**
   * 外部内容变化时回灌（装载条目、翻译回填、AI 建议插入）。
   * 必须依赖 value：编辑器创建时数据往往还没到，只盯 editorKey 会永远停在空白。
   * 正在输入时不打断——用 isFocused 作闸，否则光标会被重置。
   */
  useEffect(() => {
    if (!editor) return;
    const next = value || '';
    if (next === editor.getHTML()) return;
    if (editor.isFocused) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [value, editorKey, editor]);

  if (!editor) return null;

  return (
    <div style={{ border: `1px solid ${C.divider}`, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          gap: 4,
          flexWrap: 'wrap',
          padding: '6px 8px',
          borderBottom: `1px solid ${C.divider}`,
          background: C.surface,
        }}
      >
        {TOOLS.map((t) => {
          const active = t.isActive?.(editor) ?? false;
          return (
            <button
              key={t.label}
              title={t.tip}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => t.run(editor)}
              style={{
                minWidth: 30,
                height: 28,
                padding: '0 6px',
                border: `1px solid ${active ? C.accent : C.divider}`,
                background: active ? 'var(--color-accent-100)' : C.bg,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontFamily: t.heading ? 'var(--font-heading)' : 'var(--font-body)',
                fontSize: 12.5,
                color: active ? 'var(--color-accent-800)' : 'inherit',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div
        className="rt-body"
        style={{ minHeight, padding: '14px 16px', fontSize: 14.5, lineHeight: 1.85 }}
        data-ph={placeholder}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
