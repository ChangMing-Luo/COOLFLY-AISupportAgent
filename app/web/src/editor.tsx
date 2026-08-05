/**
 * 双语富文本编辑器（页面 MD §5.3）——左中文（权威源）/ 右英文（同步 Zendesk），逐行对齐。
 *
 * 两个设计约束决定了「逐行」而不是「整块双栏」：
 * ① 内部段落是**段落级**标记（发布门禁第②查与翻译剥离的判定依据），必须能逐段标；
 * ② 翻译对（translation_pairs）也是段落级，右栏要和左栏同一段严格对齐。
 * 因此每行 = 一个段落：左格是该段的 TipTap 富文本编辑器，右格是该段英文。
 *
 * 「小标题」勾选框由工具条的 H2/H3 取代；「内部段落」勾选框由工具条的块级标记按钮取代。
 */
import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { zhCN, type Paragraph } from '@kb/contracts';

export interface PairRow {
  id: string;
  paragraphId: string;
  zh: string;
  en: string | null;
  internal: boolean;
  humanEdited: boolean;
  editNote: string | null;
}

/** TipTap 块 → 段落记录：html 存富文本、text 存纯文本、heading 由节点类型派生 */
function serialize(editor: Editor, base: Paragraph): Paragraph {
  const first = editor.state.doc.firstChild;
  return {
    ...base,
    html: editor.isEmpty ? '' : editor.getHTML(),
    text: editor.getText(),
    heading: first?.type.name === 'heading',
  };
}

function BlockEditor({
  paragraph,
  readOnly,
  onChange,
  onFocus,
}: {
  paragraph: Paragraph;
  readOnly: boolean;
  onChange: (next: Paragraph) => void;
  onFocus: (editor: Editor) => void;
}) {
  const latest = useRef(paragraph);
  latest.current = paragraph;

  const editor = useEditor(
    {
      extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), Image.configure({ inline: false })],
      content: paragraph.html || (paragraph.text ? `<p>${paragraph.text}</p>` : ''),
      editable: !readOnly,
      onUpdate: ({ editor: ed }) => onChange(serialize(ed, latest.current)),
      onFocus: ({ editor: ed }) => onFocus(ed),
      editorProps: { attributes: { class: 'bi__prose', 'aria-label': '段落正文' } },
    },
    [],
  );

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  return <EditorContent editor={editor} />;
}

function ToolButton({
  label, title, active, disabled, onClick,
}: {
  label: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`bi__tool${active ? ' bi__tool--on' : ''}`}
      title={title}
      disabled={disabled}
      // mousedown 阻断默认行为，避免点工具条时编辑器失焦导致命令落空
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function BilingualEditor({
  paragraphs,
  pairs,
  readOnly,
  enBusy,
  onChange,
  onEnChange,
}: {
  paragraphs: Paragraph[];
  pairs: PairRow[];
  readOnly: boolean;
  enBusy: boolean;
  onChange: (next: Paragraph[]) => void;
  onEnChange: (pairId: string, en: string, note: string) => void;
}) {
  const [active, setActive] = useState<{ index: number; editor: Editor } | null>(null);
  const [enDraft, setEnDraft] = useState<Record<string, { en: string; note: string }>>({});
  const [, force] = useState(0);

  // 工具条按钮的高亮状态跟随光标位置，需在选区变化时重绘
  useEffect(() => {
    const ed = active?.editor;
    if (!ed) return undefined;
    const redraw = (): void => force((n) => n + 1);
    ed.on('selectionUpdate', redraw);
    ed.on('transaction', redraw);
    return () => {
      ed.off('selectionUpdate', redraw);
      ed.off('transaction', redraw);
    };
  }, [active]);

  const cmd = (fn: (chain: ReturnType<Editor['chain']>) => unknown): void => {
    if (!active) return;
    fn(active.editor.chain().focus());
  };
  const is = (name: string, attrs?: Record<string, unknown>): boolean =>
    active ? active.editor.isActive(name, attrs) : false;

  const patch = (i: number, next: Paragraph): void => {
    onChange(paragraphs.map((p, idx) => (idx === i ? next : p)));
  };
  const toggleInternal = (): void => {
    if (!active) return;
    const i = active.index;
    onChange(paragraphs.map((p, idx) => (idx === i ? { ...p, internal: !p.internal } : p)));
  };
  const move = (delta: number): void => {
    if (!active) return;
    const i = active.index;
    const t = i + delta;
    if (t < 0 || t >= paragraphs.length) return;
    const next = [...paragraphs];
    [next[i], next[t]] = [next[t]!, next[i]!];
    onChange(next);
    // 焦点跟着段落走：置空会让工具条在移动后整条失活，用户得再点一次才能继续操作
    setActive({ index: t, editor: active.editor });
  };
  const remove = (): void => {
    if (!active || paragraphs.length <= 1) return;
    const i = active.index;
    onChange(paragraphs.filter((_, idx) => idx !== i));
    setActive(null);
  };
  const add = (): void => {
    const maxId = paragraphs.reduce((m, p) => {
      const n = Number(p.id.replace(/^p_/, ''));
      return Number.isFinite(n) && n > m ? n : m;
    }, -1);
    onChange([...paragraphs, { id: `p_${maxId + 1}`, text: '', html: '', internal: false, heading: false }]);
  };
  const insertImage = (): void => {
    const src = window.prompt('图片地址（同步 Zendesk 时按图片说明一并推送）');
    if (src) cmd((c) => c.setImage({ src }).run());
  };

  const pairOf = (i: number): PairRow | null => pairs[i] ?? null;
  const draftOf = (p: PairRow): { en: string; note: string } =>
    enDraft[p.id] ?? { en: p.en ?? '', note: p.editNote ?? '' };

  const noBlock = active === null;

  return (
    <div className="bi">
      <div className="bi__toolbar" role="toolbar" aria-label="正文编辑工具条">
        <ToolButton label="B" title="加粗" active={is('bold')} disabled={readOnly || noBlock} onClick={() => cmd((c) => c.toggleBold().run())} />
        <ToolButton label="I" title="斜体" active={is('italic')} disabled={readOnly || noBlock} onClick={() => cmd((c) => c.toggleItalic().run())} />
        <ToolButton label="S" title="删除线" active={is('strike')} disabled={readOnly || noBlock} onClick={() => cmd((c) => c.toggleStrike().run())} />
        <span className="bi__sep" />
        <ToolButton label="H2" title="小标题（取代原「小标题」勾选框）" active={is('heading', { level: 2 })} disabled={readOnly || noBlock} onClick={() => cmd((c) => c.toggleHeading({ level: 2 }).run())} />
        <ToolButton label="H3" title="三级标题" active={is('heading', { level: 3 })} disabled={readOnly || noBlock} onClick={() => cmd((c) => c.toggleHeading({ level: 3 }).run())} />
        <span className="bi__sep" />
        <ToolButton label="• 列表" title="无序列表" active={is('bulletList')} disabled={readOnly || noBlock} onClick={() => cmd((c) => c.toggleBulletList().run())} />
        <ToolButton label="1. 列表" title="有序列表" active={is('orderedList')} disabled={readOnly || noBlock} onClick={() => cmd((c) => c.toggleOrderedList().run())} />
        <ToolButton label="引用" title="引用块" active={is('blockquote')} disabled={readOnly || noBlock} onClick={() => cmd((c) => c.toggleBlockquote().run())} />
        <ToolButton label="图片" title="插入图片" disabled={readOnly || noBlock} onClick={insertImage} />
        <span className="bi__sep" />
        <ToolButton
          label="标为内部段落"
          title="内部段落不进对外文章、不翻译、不同步对外（发布门禁第②查依据）"
          active={active ? paragraphs[active.index]?.internal === true : false}
          disabled={readOnly || noBlock}
          onClick={toggleInternal}
        />
        <span className="bi__sep" />
        <ToolButton label="上移" title="上移当前段落" disabled={readOnly || noBlock || active?.index === 0} onClick={() => move(-1)} />
        <ToolButton label="下移" title="下移当前段落" disabled={readOnly || noBlock || active?.index === paragraphs.length - 1} onClick={() => move(1)} />
        <ToolButton label="删除段落" title="删除当前段落" disabled={readOnly || noBlock || paragraphs.length <= 1} onClick={remove} />
        <ToolButton label="+ 新增段落" title="在末尾新增段落" disabled={readOnly} onClick={add} />
        {noBlock && !readOnly && <span className="bi__hint">把光标放到左侧任一段落上，工具条即生效</span>}
      </div>

      <div className="bi__head">
        <div>中文（权威源）</div>
        <div>English（同步 Zendesk）{enBusy && <span className="bi__hint">　翻译中…</span>}</div>
      </div>

      {paragraphs.map((p, i) => {
        const pair = pairOf(i);
        const focused = active?.index === i;
        return (
          <div
            key={p.id}
            className={`bi__row${p.internal ? ' bi__row--internal' : ''}${focused ? ' bi__row--focus' : ''}`}
          >
            <div className="bi__zh">
              {p.internal && <span className="bi__flag">内部</span>}
              <BlockEditor
                paragraph={p}
                readOnly={readOnly}
                onChange={(next) => patch(i, next)}
                onFocus={(ed) => setActive({ index: i, editor: ed })}
              />
            </div>
            <div className="bi__en">
              {p.internal ? (
                <div className="note note--warn" style={{ margin: 0 }}>{zhCN.translation.internalSkip}</div>
              ) : !pair ? (
                <div className="bi__placeholder">尚未生成英文——写完中文后点上方「生成英文翻译」</div>
              ) : (
                <>
                  <textarea
                    className="textarea bi__enbox"
                    value={draftOf(pair).en}
                    readOnly={readOnly}
                    placeholder="English paragraph"
                    onChange={(e) => {
                      const d = draftOf(pair);
                      setEnDraft((s) => ({ ...s, [pair.id]: { ...d, en: e.target.value } }));
                      onEnChange(pair.id, e.target.value, d.note);
                    }}
                    data-testid={`en-${i}`}
                  />
                  {pair.humanEdited && <span className="bi__flag bi__flag--accent">人工修订</span>}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
