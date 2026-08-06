export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public payload: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/**
 * 请求超时。缺了它，Zendesk / 大模型这类慢依赖一挂起，进度模态就永远停在
 * 「运行中」——既不失败也关不掉，整页只能刷新（用户报过的"页面像卡死"）。
 * 上传与 AI 整理确实慢，故给到 120s 而不是常见的 30s。
 */
const TIMEOUT_MS = 120_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  // 调用方自带的 signal（一键导入的「取消上传」）与超时 signal 必须**同时**生效——
  // 直接展开 init 会让后者覆盖前者，超时就形同虚设
  const caller = init?.signal;
  const onCallerAbort = (): void => ac.abort();
  caller?.addEventListener('abort', onCallerAbort);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'include',
      headers: init?.body ? { 'content-type': 'application/json' } : undefined,
      ...init,
      signal: ac.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError' && !caller?.aborted) {
      throw new ApiError(`请求超时（超过 ${TIMEOUT_MS / 1000} 秒未响应），请稍后重试`, 0);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener('abort', onCallerAbort);
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    throw new ApiError(String(data.message ?? `请求失败（${res.status}）`), res.status, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
};

/* ══════════ 服务端返回类型 ══════════ */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'super' | 'ops';
  roleLabel: string;
  department: string;
  reviewGranted: boolean;
  /** 首次登录用的一次性初始密码尚未换掉；为 true 时服务端会 428 拦下除改密外的所有接口 */
  mustChangePassword: boolean;
  permissions: string[];
}

export interface EntryDto {
  code: string;
  titleZh: string;
  titleEn: string;
  categoryZh: string;
  categoryEn: string;
  sceneZh: string;
  sceneEn: string;
  status: 'draft' | 'pending' | 'rejected' | 'published' | 'fixing' | 'offline';
  statusLabel: string;
  statusReadable: string;
  statusTagClass: string;
  version: string;
  syncStatus: 'none' | 'pending' | 'synced' | 'failed';
  syncLabel: string;
  syncTagClass: string;
  ownerName: string;
  updatedAt: string;
  updatedAtFull: string;
  quality: number;
  confidence: number;
  confidencePct: string;
  adopt: number;
  hits: number;
  views: number;
  translated: boolean;
  enEdited: boolean;
  tags: string[];
  source: string;
  note: string;
  rejectReason: string | null;
  pendingKind: string | null;
  pendingVersion: string | null;
  syncFailReason: string | null;
}

export interface CatalogCategory {
  id: string;
  zh: string;
  en: string;
  scenes: Array<{ id: string; zh: string; en: string }>;
}

export interface DashboardDto {
  today: string;
  greeting: string;
  kpis: Array<{ label: string; value: number; delta: string }>;
  todos: Array<{
    step: string;
    title: string;
    meta: string;
    tagClass: string;
    tagText: string;
    cta: string;
    kind: 'review' | 'feedback' | 'draft';
    code: string;
  }>;
  lifecycle: Array<{ label: string; n: number; route: string }>;
  zendesk: Array<{ k: string; v: string; accent: boolean }>;
  recent: Array<{ at: string; who: string; act: string; obj: string; result: string; version: string | null }>;
  stat: { total: number; publishedToday: number; todo: number };
}

export interface VersionDto {
  version: string;
  note: string;
  by: string;
  at: string;
  act: string;
  isCurrent: boolean;
  adopt: number;
  hits: number;
  adoptN: string;
}

export interface FeedbackDto {
  code: string;
  entryCode: string;
  type: string;
  text: string;
  conversation: string;
  state: string;
  stateLabel: string;
  at: string;
}

export interface MissDto {
  code: string;
  question: string;
  sceneZh: string;
  count7d: number;
  hitRate: string;
  state: string;
  stateLabel: string;
  aiSummary: string;
}

export interface ParsedDraft {
  key: string;
  titleZh: string;
  bodyZh: string;
  categoryId: string | null;
  categoryZh: string;
  sceneId: string | null;
  sceneZh: string;
  tags: string[];
  aiApplied: boolean;
  reason: string;
  warning: string | null;
}

export interface ParseResult {
  fileName: string;
  format: string;
  rawCount: number;
  drafts: ParsedDraft[];
  aiMode: string;
  note: string;
  storage: string;
  aiOrganized: number;
  elapsedMs: number;
}

export interface ImportCommitResult {
  created: EntryDto[];
  failed: Array<{ index: number; title: string; reason: string }>;
}

export interface CandidateDto {
  code: string;
  title: string;
  answer: string;
  summary: string;
  categoryZh: string;
  sceneZh: string;
  categoryHint: string;
  sceneHint: string;
  tags: string[];
  confidence: number;
  confidencePct: string;
  state: string;
  tagClass: string;
  mentionCount: number;
  sentiment: 'negative' | 'neutral' | 'positive';
  sentimentLabel: string;
  createdAt: string;
  dup: boolean;
  dupCode: string | null;
  dupTitle: string | null;
  dupScore: string | null;
  dropReason: string | null;
  autoDropped: boolean;
  disposedAt: string | null;
}

export interface CandidateSourceDto {
  id: string;
  ticketRef: string;
  channel: string;
  excerpt: string;
  at: string;
}

export interface CollectTaskDto {
  code: string;
  title: string;
  source: string;
  state: string;
  ownerName: string;
  ranAt: string;
  candidateCount: number;
  sourceText: string;
  sourceMeta: string;
  failReason: string | null;
}

export interface EntryDetail {
  entry: EntryDto;
  bodyZh: string;
  bodyEn: string;
  paragraphsZh: string[];
  paragraphsEn: string[];
  versions: VersionDto[];
  advice: { warn: boolean; target: string; text: string };
  feedbacks: FeedbackDto[];
  syncLogs: Array<{ at: string; label: string; result: string; payloadNo: string }>;
  meta: Array<{ k: string; v: string }>;
  healthBars: Array<{ label: string; value: string; pct: string }>;
}

export interface ReviewDto {
  entry: EntryDto;
  index: number;
  total: number;
  diff: { label: string; lines: Array<{ n: number; text: string; type: 'same' | 'del' | 'add' }> };
  checks: Array<{ mark: '✓' | '!'; label: string; detail: string }>;
  meta: string;
  info: Array<{ k: string; v: string }>;
}

export interface HealthDto {
  kpis: Array<{ label: string; value: string | number; delta: string }>;
  dist: Array<{ label: string; n: number }>;
  scenes: Array<{ label: string; value: string; pct: string }>;
  risky: Array<{ code: string; score: number; title: string; reason: string; high: boolean }>;
}

export interface CategoryDto {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  active: boolean;
  status: string;
  statusLabel: string;
  pendingReview: string | null;
  sceneCount: number;
  entryCount: number;
  zendeskRef: string | null;
}

export interface SceneMetaDto {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  active: boolean;
  status: string;
  statusLabel: string;
  pendingReview: string | null;
  categoryId: string;
  categoryZh: string;
  entryCount: number;
  zendeskRef: string | null;
}

export interface TagDto {
  id: string;
  code: string;
  name: string;
  type: string;
  active: boolean;
  refCount: number;
  createdBy: string;
}

export interface AdminUserDto {
  id: string;
  uid: string;
  name: string;
  email: string;
  department: string;
  role: 'super' | 'ops';
  roleLabel: string;
  reviewGranted: boolean;
  enabled: boolean;
  lastActive: string;
  status: string;
}

export interface PermissionRowDto {
  module: string;
  permission: string;
  super: string;
  ops: string;
  note: string;
  index: string;
  superAllowed: boolean;
  opsAllowed: boolean;
}

export interface AuditRowDto {
  id: string;
  no: string;
  at: string;
  who: string;
  role: string;
  act: string;
  obj: string;
  objCode: string | null;
  result: string;
  version: string | null;
  detail: string | null;
}

export interface ReviewLogDto {
  id: string;
  at: string;
  who: string;
  act: string;
  verdict: string;
  obj: string;
  objCode: string | null;
  version: string;
}

/** 统一审核请求：分类 / 场景 / 知识正文共用 */
export interface ReviewRequestDto {
  id: string;
  code: string;
  objectType: 'category' | 'scene' | 'entry';
  objectTypeLabel: string;
  objectId: string;
  objectCode: string;
  objectLabel: string;
  action: string;
  actionLabel: string;
  status: 'pending' | 'approved' | 'rejected';
  statusLabel: string;
  autoApproved: boolean;
  submitter: string;
  submittedAt: string;
  submittedAtFull: string;
  reviewer: string;
  reviewedAt: string;
  comment: string;
  payload: Record<string, unknown>;
  before: Record<string, unknown>;
  dimCategory: string;
  dimScene: string;
  dimBody: string;
}

export interface AdoptPlanDto {
  code: string;
  nodes: Array<{ key: 'category' | 'scene' | 'body' | 'overview'; title: string; hint: string }>;
  category: { id: string | null; nameZh: string; nameEn: string; fromLibrary: boolean };
  scene: { id: string | null; nameZh: string; nameEn: string; categoryId: string | null; fromLibrary: boolean };
  body: { titleZh: string; titleEn: string; bodyZh: string; bodyEn: string };
  mentionCount: number;
  summary: string;
}

export interface AdoptResultDto {
  entryCode: string;
  reviews: Array<{ code: string; dimension: string; status: string; note: string }>;
  message: string;
}

export interface MetaImpactDto {
  name: string;
  scenes: number;
  entries: number;
  zendeskRef: string | null;
  lines: string[];
}

export interface BatchResultDto {
  ok: string[];
  failed: Array<{ code: string; reason: string }>;
}

export interface SyncLogDto {
  id: string;
  at: string;
  entryCode: string;
  objectLabel: string;
  target: string;
  result: string;
  message: string;
  durationMs: number;
  payloadNo: string;
  actorName: string;
  payload: string;
}
