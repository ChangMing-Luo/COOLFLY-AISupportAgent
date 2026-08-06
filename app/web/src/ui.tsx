import type { CSSProperties, ReactNode } from 'react';

/* 原型内联样式的可复用片段（doc/v4/spec/prototype.template.html） */

export const C = {
  accent: 'var(--color-accent)',
  accent700: 'var(--color-accent-700)',
  text: 'var(--color-text)',
  muted: 'var(--color-neutral-600)',
  muted500: 'var(--color-neutral-500)',
  muted700: 'var(--color-neutral-700)',
  divider: 'var(--color-divider)',
  surface: 'var(--color-neutral-100)',
  bg: 'var(--color-bg)',
};

export const kickerStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color: C.accent,
};

export const cardKicker: CSSProperties = {
  fontSize: 10,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  color: C.accent,
};

export const tnum: CSSProperties = { fontFeatureSettings: "'tnum'" };

export function Kicker({ children }: { children: ReactNode }) {
  return <div style={kickerStyle}>{children}</div>;
}

export function Hr() {
  return <hr className="hr" />;
}

export function Tag({ cls, children, style }: { cls: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <span className={`tag ${cls}`} style={style}>
      {children}
    </span>
  );
}

/** 页面头：kicker + 标题 + 描述 + 右侧操作 */
export function PageHead({
  kicker,
  title,
  desc,
  actions,
}: {
  kicker: string;
  title: string;
  desc?: string;
  actions?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
      <div style={{ minWidth: 0 }}>
        <div style={kickerStyle}>{kicker}</div>
        <h2 style={{ margin: '8px 0 6px', fontWeight: 400 }}>{title}</h2>
        {desc ? (
          <p style={{ margin: 0, fontSize: 13, color: C.muted700, maxWidth: 640, textWrap: 'pretty' }}>{desc}</p>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: 8, flex: 'none' }}>{actions}</div>
    </div>
  );
}

export function KpiRow({
  items,
  columns,
  onPick,
}: {
  items: Array<{ label: string; value: string | number; delta: string }>;
  columns: number;
  /** 给了就整块可点，跳到对应列表 */
  onPick?: (label: string) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns},1fr)`,
        gap: 0,
        border: `1px solid ${C.divider}`,
        borderRadius: 'var(--radius-md)',
      }}
    >
      {items.map((k) => (
        <div
          key={k.label}
          onClick={onPick ? () => onPick(k.label) : undefined}
          role={onPick ? 'button' : undefined}
          tabIndex={onPick ? 0 : undefined}
          onKeyDown={onPick ? (e) => e.key === 'Enter' && onPick(k.label) : undefined}
          style={{
            padding: '16px 18px',
            borderRight: `1px solid ${C.divider}`,
            cursor: onPick ? 'pointer' : undefined,
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', color: C.muted }}>
            {k.label}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 32,
              fontWeight: 400,
              ...tnum,
              marginTop: 6,
              lineHeight: 1,
            }}
          >
            {k.value}
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 5 }}>{k.delta}</div>
        </div>
      ))}
    </div>
  );
}

export function Card({
  kicker,
  children,
  style,
}: {
  kicker?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="card" style={style}>
      {kicker ? <div className="card-kicker">{kicker}</div> : null}
      {children}
    </div>
  );
}

/** 键值行（元数据卡、提交信息卡、Zendesk 卡通用） */
export function KvRow({
  k,
  v,
  color,
  last,
}: {
  k: string;
  v: ReactNode;
  color?: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 12.5,
        padding: '6px 0',
        borderBottom: last ? 'none' : `1px solid ${C.divider}`,
      }}
    >
      <span style={{ color: C.muted, flex: 'none' }}>{k}</span>
      <span style={{ textAlign: 'right', color, ...tnum }}>{v}</span>
    </div>
  );
}

export function Bar({ label, value, pct }: { label: string; value: string; pct: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.muted700 }}>
        <span>{label}</span>
        <span style={tnum}>{value}</span>
      </div>
      <div style={{ height: 2, background: 'var(--color-neutral-300)', marginTop: 3 }}>
        <div style={{ height: 2, background: C.accent, width: pct }} />
      </div>
    </div>
  );
}

/** 空态（列表页 / 候选页共用版式） */
export function Empty({
  title,
  desc,
  cta,
  onCta,
  dashed,
}: {
  title: string;
  desc: string;
  cta: string;
  onCta: () => void;
  dashed?: boolean;
}) {
  return (
    <div
      style={
        dashed
          ? {
              padding: '60px 0',
              textAlign: 'center',
              border: `1px dashed ${C.divider}`,
              borderRadius: 'var(--radius-md)',
            }
          : { padding: '70px 0', textAlign: 'center', borderBottom: `1px solid ${C.divider}` }
      }
    >
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: dashed ? 22 : 23, color: C.muted }}>{title}</div>
      <p
        style={{
          fontSize: 13,
          color: C.muted,
          margin: '8px auto 16px',
          maxWidth: dashed ? 400 : 420,
          textWrap: 'pretty',
        }}
      >
        {desc}
      </p>
      <button className="btn btn-primary" onClick={onCta}>
        {cta}
      </button>
    </div>
  );
}

/**
 * 数据加载失败态。
 * 各视图原本一律 `.catch(() => undefined)` 后 `return null`——主区一片空白，
 * 用户既看不出是坏了还是在加载，也没有重试的入口。
 */
export function LoadFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      style={{
        marginTop: 24,
        border: `1px solid ${C.divider}`,
        borderLeft: '2px solid var(--color-accent-600)',
        borderRadius: 'var(--radius-md)',
        padding: '18px 20px',
        background: C.surface,
      }}
    >
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}>数据没能加载出来</div>
      <p style={{ fontSize: 12.5, color: C.muted, margin: '8px 0 0', lineHeight: 1.8, textWrap: 'pretty' }}>
        {message}
      </p>
      <button className="btn btn-primary" onClick={onRetry} style={{ marginTop: 16 }}>
        重试
      </button>
    </div>
  );
}

export function Skeleton() {
  return (
    <div style={{ animation: 'shimmer 1.4s ease-in-out infinite' }}>
      <div style={{ height: 14, width: 180, background: 'var(--color-neutral-200)', borderRadius: 2 }} />
      <div
        style={{ height: 30, width: 340, background: 'var(--color-neutral-200)', borderRadius: 2, marginTop: 14 }}
      />
      <div style={{ height: 1, background: C.divider, margin: '22px 0' }} />
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div
          key={i}
          style={{
            height: 44,
            borderBottom: `1px solid ${C.divider}`,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}
        >
          {['38%', '14%', '9%', '16%'].map((w) => (
            <div key={w} style={{ height: 12, width: w, background: 'var(--color-neutral-200)', borderRadius: 2 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** 面包屑（编辑器 / 详情 / 审核页共用） */
export function Crumb({ onBack, label, backText = '← 返回' }: { onBack: () => void; label: string; backText?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: C.muted }}>
      <button className="btn btn-ghost" onClick={onBack} style={{ fontSize: 12, padding: 0 }}>
        {backText}
      </button>
      <span>/ {label}</span>
    </div>
  );
}

/** 页签条（详情页四页签 / 语言切换外的通用横向 tab） */
export function Tabs({
  items,
  active,
  onPick,
}: {
  items: Array<{ key: string; label: string }>;
  active: string;
  onPick: (key: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${C.divider}`, marginBottom: 18 }}>
      {items.map((t) => (
        <button
          key={t.key}
          onClick={() => onPick(t.key)}
          style={{
            padding: '8px 14px',
            background: 'transparent',
            border: 0,
            borderBottom: `2px solid ${active === t.key ? C.accent : 'transparent'}`,
            cursor: 'pointer',
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            fontSize: 14,
            marginBottom: -1,
            color: active === t.key ? C.accent : C.muted,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const twoCol: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 372px',
  gap: 28,
  alignItems: 'start',
};
