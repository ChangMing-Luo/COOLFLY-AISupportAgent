/**
 * 时间格式化：界面用本地时区（默认 Asia/Shanghai），
 * 列表 `MM-DD HH:mm`、版本历史 `YYYY-MM-DD HH:mm`、审计 `MM-DD HH:mm`。
 */
const TZ = process.env.DISPLAY_TZ ?? 'Asia/Shanghai';

function parts(d: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) out[p.type] = p.value;
  return out;
}

export function fmtShort(v: Date | string | null | undefined): string {
  if (!v) return '—';
  const p = parts(new Date(v));
  return `${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

export function fmtFull(v: Date | string | null | undefined): string {
  if (!v) return '—';
  const p = parts(new Date(v));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

export function fmtDay(v: Date | string | null | undefined): string {
  if (!v) return '—';
  const p = parts(new Date(v));
  return `${p.year}-${p.month}-${p.day}`;
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/** 工作台 kicker：`2026 年 8 月 5 日 星期三` */
export function fmtToday(now = new Date()): string {
  const p = parts(now);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(now);
  const idx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  return `${p.year} 年 ${Number(p.month)} 月 ${Number(p.day)} 日 ${WEEKDAYS[idx >= 0 ? idx : 0]}`;
}

/** 早上好 / 下午好 / 晚上好 */
export function greetingOf(name: string, now = new Date()): string {
  const hour = Number(parts(now).hour);
  const word = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
  return `${word}，${name}`;
}

export function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${Math.round(n)}%`;
}

export function thousands(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('en-US');
}
