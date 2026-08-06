export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public payload: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });
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
}

export interface ImportCommitResult {
  created: EntryDto[];
  failed: Array<{ index: number; title: string; reason: string }>;
}

export interface CandidateDto {
  code: string;
  title: string;
  answer: string;
  sceneZh: string;
  tags: string[];
  confidence: number;
  confidencePct: string;
  state: string;
  tagClass: string;
  dup: boolean;
  dupCode: string | null;
  dupTitle: string | null;
  dupScore: string | null;
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
