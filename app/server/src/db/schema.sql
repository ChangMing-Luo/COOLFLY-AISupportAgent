-- COOLFLY 知识运营中台 · 七域数据模型（技术方案 §5.1）
-- 域：知识 / 版本 / 翻译 / 同步 / 挖掘 / 信号 / 治理

CREATE EXTENSION IF NOT EXISTS vector;

-- ============ 治理域 ============
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL,
  library_scope   JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  last_active_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS permission_matrix (
  permission  TEXT NOT NULL,
  role        TEXT NOT NULL,
  allowed     BOOLEAN NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (permission, role)
);

-- append-only：无 UPDATE/DELETE 路径，由数据库规则强制
CREATE TABLE IF NOT EXISTS audit_logs (
  id           TEXT PRIMARY KEY,
  at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id     TEXT,
  actor_name   TEXT NOT NULL,
  actor_role   TEXT NOT NULL,
  object_type  TEXT NOT NULL,
  object_id    TEXT,
  object_label TEXT NOT NULL,
  action       TEXT NOT NULL,
  category     TEXT NOT NULL,
  field        TEXT,
  before_value TEXT,
  after_value  TEXT,
  note         TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_logs(at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_object ON audit_logs(object_id);

-- ============ 知识域 ============
CREATE TABLE IF NOT EXISTS libraries (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  internal_only BOOLEAN NOT NULL DEFAULT FALSE,
  zendesk_ref  TEXT,
  sort_order   INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chapters (
  id            TEXT PRIMARY KEY,
  library_id    TEXT NOT NULL REFERENCES libraries(id) ON DELETE RESTRICT,
  parent_id     TEXT REFERENCES chapters(id) ON DELETE RESTRICT,
  name          TEXT NOT NULL,
  zendesk_section_ref TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chapters_lib ON chapters(library_id);

CREATE TABLE IF NOT EXISTS entries (
  id             TEXT PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  library_id     TEXT NOT NULL REFERENCES libraries(id) ON DELETE RESTRICT,
  chapter_id     TEXT NOT NULL REFERENCES chapters(id) ON DELETE RESTRICT,
  entry_type     TEXT NOT NULL DEFAULT 'FAQ 型',
  visibility     TEXT NOT NULL DEFAULT 'public',
  scene_l1       TEXT NOT NULL DEFAULT '',
  scene_l2       TEXT NOT NULL DEFAULT '',
  labels         JSONB NOT NULL DEFAULT '[]'::jsonb,
  device_models  JSONB NOT NULL DEFAULT '[]'::jsonb,
  body           JSONB NOT NULL DEFAULT '{"paragraphs":[]}'::jsonb,
  status         TEXT NOT NULL DEFAULT 'draft',
  en_status      TEXT NOT NULL DEFAULT 'none',
  sync_status    TEXT NOT NULL DEFAULT 'none',
  vector_status  TEXT NOT NULL DEFAULT 'none',
  review_source  TEXT NOT NULL DEFAULT 'manual',
  submitter_id   TEXT REFERENCES users(id),
  submitted_at   TIMESTAMPTZ,
  reviewer_id    TEXT REFERENCES users(id),
  reviewed_at    TIMESTAMPTZ,
  reject_reason  TEXT,
  owner_id       TEXT REFERENCES users(id),
  review_cycle_days INT NOT NULL DEFAULT 180,
  review_due_at  TIMESTAMPTZ,
  current_version INT NOT NULL DEFAULT 0,
  lock_version   INT NOT NULL DEFAULT 0,
  blocked_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_chapter ON entries(chapter_id);

-- ============ 版本域 ============
CREATE TABLE IF NOT EXISTS entry_versions (
  id            TEXT PRIMARY KEY,
  entry_id      TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  version_no    INT NOT NULL,
  label         TEXT NOT NULL DEFAULT '',
  body_snapshot JSONB NOT NULL,
  plain_text    TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'pending',
  author_id     TEXT REFERENCES users(id),
  author_name   TEXT NOT NULL DEFAULT '',
  effective_from TIMESTAMPTZ,
  effective_to  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entry_id, version_no)
);

CREATE TABLE IF NOT EXISTS version_metrics (
  entry_id    TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  version_no  INT NOT NULL,
  calls       INT NOT NULL DEFAULT 0,
  hit_rate    NUMERIC(5,2),
  solve_rate  NUMERIC(5,2),
  adopt_rate  NUMERIC(5,2),
  PRIMARY KEY (entry_id, version_no)
);

-- ============ 翻译域 ============
CREATE TABLE IF NOT EXISTS translation_pairs (
  id            TEXT PRIMARY KEY,
  entry_id      TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  paragraph_id  TEXT NOT NULL,
  seq           INT NOT NULL,
  zh_text       TEXT NOT NULL,
  en_text       TEXT,
  internal      BOOLEAN NOT NULL DEFAULT FALSE,
  human_edited  BOOLEAN NOT NULL DEFAULT FALSE,
  edit_note     TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entry_id, paragraph_id)
);

-- ============ 同步域 ============
CREATE TABLE IF NOT EXISTS sync_mappings (
  id            TEXT PRIMARY KEY,
  entry_id      TEXT REFERENCES entries(id) ON DELETE CASCADE,
  chapter_id    TEXT REFERENCES chapters(id) ON DELETE CASCADE,
  library_id    TEXT REFERENCES libraries(id) ON DELETE CASCADE,
  local_label   TEXT NOT NULL,
  zendesk_kind  TEXT NOT NULL,
  zendesk_ref   TEXT,
  visibility    TEXT NOT NULL DEFAULT 'public',
  published_hash TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mapping_entry ON sync_mappings(entry_id);

CREATE TABLE IF NOT EXISTS sync_tasks (
  id             TEXT PRIMARY KEY,
  entry_id       TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  version_no     INT NOT NULL DEFAULT 1,
  action         TEXT NOT NULL,
  target         TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'queued',
  languages      TEXT NOT NULL DEFAULT '中',
  retry_count    INT NOT NULL DEFAULT 0,
  fail_reason    TEXT,
  blocked_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_tasks(status);

CREATE TABLE IF NOT EXISTS drift_records (
  id           TEXT PRIMARY KEY,
  entry_id     TEXT REFERENCES entries(id) ON DELETE CASCADE,
  article_ref  TEXT NOT NULL,
  title        TEXT NOT NULL,
  changed_by   TEXT NOT NULL,
  diff_summary TEXT NOT NULL,
  remote_body  TEXT,
  detected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_action TEXT,
  resolved_by  TEXT REFERENCES users(id),
  resolved_at  TIMESTAMPTZ
);

-- ============ 挖掘域 ============
CREATE TABLE IF NOT EXISTS mining_batches (
  id             TEXT PRIMARY KEY,
  batch_date     DATE NOT NULL,
  email_count    INT NOT NULL DEFAULT 0,
  chat_count     INT NOT NULL DEFAULT 0,
  candidate_count INT NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'completed',
  fail_reason    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mining_candidates (
  id             TEXT PRIMARY KEY,
  batch_id       TEXT NOT NULL REFERENCES mining_batches(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,
  title          TEXT NOT NULL,
  source_summary TEXT NOT NULL DEFAULT '',
  frequency      INT NOT NULL DEFAULT 0,
  dedupe_score   NUMERIC(4,2) NOT NULL DEFAULT 0,
  gap_verdict    TEXT NOT NULL DEFAULT '',
  ai_summary     TEXT NOT NULL DEFAULT '',
  draft_body     TEXT NOT NULL DEFAULT '',
  admission_note TEXT NOT NULL DEFAULT '',
  target_entry_code TEXT,
  disposition    TEXT NOT NULL DEFAULT 'pending',
  disposed_by    TEXT REFERENCES users(id),
  disposed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ 信号域 ============
CREATE TABLE IF NOT EXISTS signal_matrix (
  id         TEXT PRIMARY KEY,
  scene      TEXT NOT NULL,
  channel    TEXT NOT NULL,
  hit_signal TEXT NOT NULL,
  solve_signal TEXT NOT NULL,
  certainty  TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS signal_events (
  id          TEXT PRIMARY KEY,
  entry_id    TEXT REFERENCES entries(id) ON DELETE CASCADE,
  topic       TEXT,
  channel     TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  certainty   TEXT NOT NULL,
  excerpt     TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_signal_entry ON signal_events(entry_id);

CREATE TABLE IF NOT EXISTS entry_effect_metrics (
  entry_id     TEXT PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
  bot_refs     INT NOT NULL DEFAULT 0,
  agent_refs   INT NOT NULL DEFAULT 0,
  downvotes    INT NOT NULL DEFAULT 0,
  flags        INT NOT NULL DEFAULT 0,
  solve_rate   NUMERIC(5,2),
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revision_candidates (
  id         TEXT PRIMARY KEY,
  source     TEXT NOT NULL,
  entry_id   TEXT REFERENCES entries(id) ON DELETE CASCADE,
  topic      TEXT NOT NULL,
  signal_note TEXT NOT NULL,
  count_label TEXT NOT NULL,
  disposition TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coverage_scenes (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  entry_count INT NOT NULL DEFAULT 0,
  coverage_pct INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS knowledge_gaps (
  id        TEXT PRIMARY KEY,
  topic     TEXT NOT NULL,
  weekly_count TEXT NOT NULL,
  source_split TEXT NOT NULL,
  coverage_verdict TEXT NOT NULL,
  action    TEXT NOT NULL,
  disposition TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS no_result_keywords (
  id       TEXT PRIMARY KEY,
  keyword  TEXT NOT NULL,
  weekly_count INT NOT NULL DEFAULT 0,
  verdict  TEXT NOT NULL,
  level    TEXT NOT NULL DEFAULT 'warn'
);

-- 向量（内部工具：挖掘查重 / 缺口聚类 / 发布门禁代理评测）
CREATE TABLE IF NOT EXISTS entry_vectors (
  entry_id   TEXT PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
  embedding  vector(64),
  source_text TEXT NOT NULL DEFAULT '',
  built_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
