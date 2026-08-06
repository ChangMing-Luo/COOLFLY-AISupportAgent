-- COOLFLY 知识运营中台 · v4 数据模型（doc/v4/SPEC-v4.md §2）
-- 域：治理 / 元数据 / 知识 / 采集 / 反馈 / 同步

-- ============ 治理域 ============
CREATE TABLE IF NOT EXISTS users (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  email                TEXT NOT NULL UNIQUE,
  password_hash        TEXT NOT NULL,
  role                 TEXT NOT NULL CHECK (role IN ('super','ops')),
  department           TEXT NOT NULL DEFAULT '',
  -- 审核权限单独授予（原型 admin.perms「审核（需授权）」）；super 恒有
  review_granted       BOOLEAN NOT NULL DEFAULT FALSE,
  enabled              BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  last_active_at       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS permission_matrix (
  permission TEXT NOT NULL,
  role       TEXT NOT NULL,
  allowed    BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (permission, role)
);

-- append-only：由数据库规则拒绝 UPDATE / DELETE（migrate.ts 建规则）
CREATE TABLE IF NOT EXISTS audit_logs (
  id           TEXT PRIMARY KEY,
  at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id     TEXT,
  actor_name   TEXT NOT NULL,
  actor_role   TEXT NOT NULL DEFAULT '',
  action       TEXT NOT NULL,
  object_type  TEXT NOT NULL DEFAULT 'entry',
  object_code  TEXT,
  object_label TEXT NOT NULL,
  result       TEXT NOT NULL DEFAULT '成功',
  version      TEXT,
  detail       TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_logs(at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_object ON audit_logs(object_code);

-- ============ 元数据域 ============
CREATE TABLE IF NOT EXISTS categories (
  id                    TEXT PRIMARY KEY,
  code                  TEXT NOT NULL UNIQUE,
  name_zh               TEXT NOT NULL,
  name_en               TEXT NOT NULL DEFAULT '',
  zendesk_category_ref  TEXT,
  -- 生命周期：与条目一致地走审核（draft→pending→published；下架为 offline）
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','pending','published','offline')),
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order            INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scenes (
  id                   TEXT PRIMARY KEY,
  code                 TEXT NOT NULL UNIQUE,
  category_id          TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name_zh              TEXT NOT NULL,
  name_en              TEXT NOT NULL DEFAULT '',
  zendesk_section_ref  TEXT,
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','pending','published','offline')),
  active               BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order           INT NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scenes_cat ON scenes(category_id);

-- 标签：仅本地检索与推荐适配，不翻译、不进 Zendesk
CREATE TABLE IF NOT EXISTS tags (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL UNIQUE,
  type          TEXT NOT NULL DEFAULT '业务' CHECK (type IN ('业务','属性','动作','人群')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    TEXT NOT NULL DEFAULT '',
  merged_into   TEXT REFERENCES tags(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 通用审核对象：分类 / 场景 / 条目共用一条审核流水线
CREATE TABLE IF NOT EXISTS review_requests (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  object_type   TEXT NOT NULL CHECK (object_type IN ('category','scene','entry')),
  object_id     TEXT NOT NULL,
  object_code   TEXT NOT NULL DEFAULT '',
  object_label  TEXT NOT NULL DEFAULT '',
  action        TEXT NOT NULL CHECK (action IN ('create','update','publish','unpublish','rollback')),
  -- 待生效内容与变更前快照，审核页据此出 diff
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  before_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  -- 自动过审：仍是一条完整审核记录，只是由权限直接批准
  auto_approved BOOLEAN NOT NULL DEFAULT FALSE,
  submitter_id  TEXT REFERENCES users(id),
  submitter_name TEXT NOT NULL DEFAULT '',
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewer_id   TEXT REFERENCES users(id),
  reviewer_name TEXT NOT NULL DEFAULT '',
  reviewed_at   TIMESTAMPTZ,
  comment       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_rr_status ON review_requests(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_object ON review_requests(object_type, object_id);

-- ============ 知识域 ============
CREATE TABLE IF NOT EXISTS entries (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  title_zh        TEXT NOT NULL,
  title_en        TEXT NOT NULL DEFAULT '',
  body_zh         TEXT NOT NULL DEFAULT '',
  body_en         TEXT NOT NULL DEFAULT '',
  category_id     TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  scene_id        TEXT REFERENCES scenes(id) ON DELETE RESTRICT,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','pending','rejected','published','fixing','offline')),
  version         TEXT NOT NULL DEFAULT 'v0.1',
  sync_status     TEXT NOT NULL DEFAULT 'none'
                    CHECK (sync_status IN ('none','pending','synced','failed')),
  sync_fail_reason TEXT,
  translated      BOOLEAN NOT NULL DEFAULT FALSE,
  en_edited       BOOLEAN NOT NULL DEFAULT FALSE,
  owner_id        TEXT REFERENCES users(id),
  owner_name      TEXT NOT NULL DEFAULT '',
  submitter_id    TEXT REFERENCES users(id),
  submitted_at    TIMESTAMPTZ,
  reviewer_id     TEXT REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  note            TEXT NOT NULL DEFAULT '',
  reject_reason   TEXT,
  -- 回滚过审：pending_kind='rollback' 时 pending_version 为目标版本
  pending_kind    TEXT CHECK (pending_kind IN ('rollback')),
  pending_version TEXT,
  source          TEXT NOT NULL DEFAULT '人工撰写',
  confidence      NUMERIC(4,3) NOT NULL DEFAULT 0,
  quality         INT NOT NULL DEFAULT 0,
  lock_version    INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_scene ON entries(scene_id);
CREATE INDEX IF NOT EXISTS idx_entries_sync ON entries(sync_status);

CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  tag_id   TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_entry_tags_tag ON entry_tags(tag_id);

-- 版本历史。回滚会让同一 version 再次出现，故不设 (entry_id, version) 唯一键
CREATE TABLE IF NOT EXISTS entry_versions (
  id          TEXT PRIMARY KEY,
  entry_id    TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  version     TEXT NOT NULL,
  act         TEXT NOT NULL CHECK (act IN ('发布','回滚','创建')),
  note        TEXT NOT NULL DEFAULT '',
  author_id   TEXT REFERENCES users(id),
  author_name TEXT NOT NULL DEFAULT '',
  title_zh    TEXT NOT NULL DEFAULT '',
  title_en    TEXT NOT NULL DEFAULT '',
  body_zh     TEXT NOT NULL DEFAULT '',
  body_en     TEXT NOT NULL DEFAULT '',
  adopt_rate  INT NOT NULL DEFAULT 0,
  hits        INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_versions_entry ON entry_versions(entry_id, created_at DESC);

-- 效果指标：由 Zendesk 文章投票 / 工单信号回填，无数据即为 0 且 refreshed_at 为空
CREATE TABLE IF NOT EXISTS entry_metrics (
  entry_id     TEXT PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
  hits         INT NOT NULL DEFAULT 0,
  views        INT NOT NULL DEFAULT 0,
  adopt_rate   INT NOT NULL DEFAULT 0,
  votes_up     INT NOT NULL DEFAULT 0,
  votes_down   INT NOT NULL DEFAULT 0,
  refreshed_at TIMESTAMPTZ
);

-- ============ 采集域 ============
CREATE TABLE IF NOT EXISTS collect_tasks (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  source          TEXT NOT NULL DEFAULT 'Zendesk 客服会话',
  state           TEXT NOT NULL DEFAULT 'ready' CHECK (state IN ('ready','running','done','failed')),
  owner_id        TEXT REFERENCES users(id),
  owner_name      TEXT NOT NULL DEFAULT '',
  candidate_count INT NOT NULL DEFAULT 0,
  source_text     TEXT NOT NULL DEFAULT '',
  source_meta     TEXT NOT NULL DEFAULT '',
  fail_reason     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ran_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS extract_candidates (
  id           TEXT PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  task_id      TEXT NOT NULL REFERENCES collect_tasks(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  answer       TEXT NOT NULL DEFAULT '',
  category_id  TEXT REFERENCES categories(id) ON DELETE SET NULL,
  scene_id     TEXT REFERENCES scenes(id) ON DELETE SET NULL,
  -- 模型给的分类/场景建议原文（映射不到本地对象时保留，供人工判断）
  category_hint TEXT NOT NULL DEFAULT '',
  scene_hint    TEXT NOT NULL DEFAULT '',
  tags         JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence   NUMERIC(4,3) NOT NULL DEFAULT 0,
  -- 抽象摘要：候选去重与垃圾箱自动丢弃的唯一匹配依据
  summary      TEXT NOT NULL DEFAULT '',
  -- 聚合后关联的会话条数与情绪，用于优先级排序
  mention_count INT NOT NULL DEFAULT 1,
  sentiment    TEXT NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('negative','neutral','positive')),
  dup_entry_id TEXT REFERENCES entries(id) ON DELETE SET NULL,
  dup_score    INT,
  disposition  TEXT NOT NULL DEFAULT 'pending' CHECK (disposition IN ('pending','accepted','dropped')),
  -- 丢弃原因；auto_dropped=true 表示命中垃圾箱摘要被自动丢弃
  drop_reason  TEXT,
  auto_dropped BOOLEAN NOT NULL DEFAULT FALSE,
  disposed_by  TEXT REFERENCES users(id),
  disposed_at  TIMESTAMPTZ,
  entry_id     TEXT REFERENCES entries(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cands_task ON extract_candidates(task_id, disposition);

-- 候选 ← 会话：一条聚合候选下挂它命中的每一条 Zendesk 会话，界面可逐条查看
CREATE TABLE IF NOT EXISTS candidate_sources (
  id           TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES extract_candidates(id) ON DELETE CASCADE,
  ticket_ref   TEXT NOT NULL DEFAULT '',
  channel      TEXT NOT NULL DEFAULT '',
  excerpt      TEXT NOT NULL,
  occurred_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cand_sources ON candidate_sources(candidate_id);

-- ============ 反馈域 ============
CREATE TABLE IF NOT EXISTS feedbacks (
  id           TEXT PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  entry_id     TEXT REFERENCES entries(id) ON DELETE SET NULL,
  entry_code   TEXT NOT NULL DEFAULT '',
  type         TEXT NOT NULL CHECK (type IN ('差评','信息有误','无法解决')),
  text         TEXT NOT NULL,
  conversation TEXT NOT NULL DEFAULT '',
  state        TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open','fixing','closed')),
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  handled_by   TEXT REFERENCES users(id),
  handled_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feedback_entry ON feedbacks(entry_id);

CREATE TABLE IF NOT EXISTS misses (
  id         TEXT PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,
  question   TEXT NOT NULL,
  scene_id   TEXT REFERENCES scenes(id) ON DELETE SET NULL,
  count_7d   INT NOT NULL DEFAULT 0,
  hit_rate   INT NOT NULL DEFAULT 0,
  state      TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open','planned')),
  ai_summary TEXT NOT NULL DEFAULT '',
  entry_id   TEXT REFERENCES entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ 同步域 ============
CREATE TABLE IF NOT EXISTS sync_mappings (
  entry_id             TEXT PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
  zendesk_article_ref  TEXT,
  published_hash       TEXT,
  locale               TEXT NOT NULL DEFAULT 'en-us',
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 每次对 Zendesk 的写入都留痕（原型「同步日志」页：报文号 / 目录 / 结果 / 时间 / 耗时）
CREATE TABLE IF NOT EXISTS sync_logs (
  id           TEXT PRIMARY KEY,
  at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  entry_id     TEXT REFERENCES entries(id) ON DELETE SET NULL,
  entry_code   TEXT NOT NULL DEFAULT '',
  object_label TEXT NOT NULL,
  target       TEXT NOT NULL DEFAULT 'Help Center',
  action       TEXT NOT NULL DEFAULT 'upsert',
  result       TEXT NOT NULL DEFAULT '成功' CHECK (result IN ('成功','失败')),
  message      TEXT NOT NULL DEFAULT '',
  payload      TEXT NOT NULL DEFAULT '',
  duration_ms  INT NOT NULL DEFAULT 0,
  payload_no   TEXT NOT NULL DEFAULT '',
  actor_name   TEXT NOT NULL DEFAULT '系统'
);
CREATE INDEX IF NOT EXISTS idx_sync_logs_at ON sync_logs(at DESC);
