import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { pool, query } from './db/pool.js';
import { getSandbox } from './integrations/zendesk.js';
import { toPublicHtml } from './core/content.js';

let app: FastifyInstance;
const cookies: Record<string, string> = {};

async function login(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: 'Coolfly@2026' },
  });
  expect(res.statusCode, `${email} 登录失败：${res.body}`).toBe(200);
  const raw = res.headers['set-cookie'];
  const cookie = Array.isArray(raw) ? raw[0]! : (raw as string);
  return cookie.split(';')[0]!;
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  cookies.manager = await login('wangwen@coolfly.com');
  cookies.reviewer = await login('lixiao@coolfly.com');
  cookies.reviewer2 = await login('lizhen@coolfly.com');
  cookies.aiOps = await login('chendi@coolfly.com');
  cookies.admin = await login('ken@coolfly.com');
}, 60000);

afterAll(async () => {
  await app.close();
  await pool.end();
});

function as(role: keyof typeof cookies) {
  return { cookie: cookies[role]! };
}

describe('RULE-01 RBAC 越权在接口层被拒（不只前端禁用）', () => {
  const cases: Array<{ role: string; method: 'POST' | 'PUT'; url: string; payload?: unknown; why: string }> = [
    { role: 'aiOps', method: 'POST', url: '/api/kb/entries', payload: {}, why: 'AI 运营不可新建条目' },
    { role: 'aiOps', method: 'POST', url: '/api/review/ent_0233/approve', why: 'AI 运营不可审核' },
    { role: 'aiOps', method: 'POST', url: '/api/review/ent_0233/publish', why: 'AI 运营不可发布' },
    { role: 'aiOps', method: 'POST', url: '/api/review/ent_0201/rollback', payload: { targetVersionNo: 1 }, why: 'AI 运营不可回滚' },
    { role: 'manager', method: 'POST', url: '/api/review/ent_0233/approve', why: '知识管理员不可审核' },
    { role: 'manager', method: 'POST', url: '/api/review/ent_0233/publish', why: '知识管理员不可发布（统一过审铁律）' },
    { role: 'manager', method: 'POST', url: '/api/review/ent_0201/rollback', payload: { targetVersionNo: 1 }, why: '知识管理员不可回滚' },
    { role: 'manager', method: 'PUT', url: '/api/rbac/matrix', payload: { permission: 'publish', role: 'kb_manager', allowed: true }, why: '非系统管理员不可改权限矩阵' },
    { role: 'reviewer', method: 'PUT', url: '/api/rbac/matrix', payload: { permission: 'publish', role: 'kb_manager', allowed: true }, why: '审核员不可改权限矩阵' },
    { role: 'reviewer', method: 'POST', url: '/api/rbac/users', payload: { name: 'x', email: 'x@y.com', role: 'ai_ops', libraryScope: ['lib_policy'], initialPassword: 'Aa123456' }, why: '审核员不可建用户' },
    { role: 'admin', method: 'POST', url: '/api/review/ent_0233/approve', why: '系统管理员不参与内容审核（职责分离）' },
    { role: 'admin', method: 'POST', url: '/api/review/ent_0233/publish', why: '系统管理员不参与发布' },
  ];

  for (const c of cases) {
    it(`${c.why} → 403`, async () => {
      const res = await app.inject({
        method: c.method,
        url: c.url,
        headers: as(c.role as keyof typeof cookies),
        payload: c.payload as never,
      });
      expect(res.statusCode, `${c.why} 实际 ${res.statusCode}：${res.body}`).toBe(403);
      expect(JSON.parse(res.body).message).toBeTruthy();
    });
  }

  it('未登录访问受保护接口 → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/workbench' });
    expect(res.statusCode).toBe(401);
  });
});

describe('RULE-02 统一过审：同步队列唯一写入源 = 发布 API 成功路径', () => {
  let entryId = '';

  it('知识管理员新建并提交审核', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/kb/entries',
      headers: as('manager'),
      payload: {
        title: '无人机首次配对失败排查',
        libraryId: 'lib_product',
        chapterId: 'ch_wifi',
        entryType: '操作流程型',
        visibility: 'public',
        sceneL1: '安装与配网',
        sceneL2: 'Wi-Fi 配对',
        labels: ['配对', '排查'],
        deviceModels: [],
        reviewCycleDays: 180,
        ownerId: null,
        body: {
          paragraphs: [
            { id: 'p0', text: '首次配对失败排查', html: '', internal: false, heading: true },
            { id: 'p1', text: '1. 确认手机连接的是 2.4GHz 网络。', html: '', internal: false, heading: false },
          ],
        },
      },
    });
    expect(create.statusCode).toBe(200);
    entryId = JSON.parse(create.body).id;

    const submit = await app.inject({
      method: 'POST',
      url: `/api/kb/entries/${entryId}/submit`,
      headers: as('manager'),
      payload: { source: 'manual' },
    });
    expect(submit.statusCode).toBe(200);
    expect(JSON.parse(submit.body).status).toBe('pending_review');
  });

  it('未过审条目不产生任何同步任务', async () => {
    const { rows } = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM sync_tasks WHERE entry_id=$1', [entryId]);
    expect(Number(rows[0]!.n)).toBe(0);
  });

  it('未过审条目不出现在已发布集合', async () => {
    const { rows } = await query<{ status: string }>('SELECT status FROM entries WHERE id=$1', [entryId]);
    expect(rows[0]!.status).toBe('pending_review');
  });

  it('直接调用发布接口（跳过审核通过）被状态机拒绝', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/review/${entryId}/publish`, headers: as('reviewer') });
    expect(res.statusCode, '跳过审核通过的发布应被状态机拒绝').toBe(409);
    expect(JSON.parse(res.body).message).toContain('审核通过');
  });

  it('审核员通过 → 发布门禁阻断（英文未确认）', async () => {
    const approve = await app.inject({ method: 'POST', url: `/api/review/${entryId}/approve`, headers: as('reviewer') });
    expect(approve.statusCode).toBe(200);

    const publish = await app.inject({ method: 'POST', url: `/api/review/${entryId}/publish`, headers: as('reviewer') });
    expect(publish.statusCode).toBe(200);
    const body = JSON.parse(publish.body) as { status: string; gate: { checks: Array<{ key: string; passed: boolean }> } };
    expect(body.status).toBe('blocked');
    expect(body.gate.checks.find((c) => c.key === 'english')?.passed).toBe(false);
    const { rows } = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM sync_tasks WHERE entry_id=$1', [entryId]);
    expect(Number(rows[0]!.n), '门禁不过不得入队').toBe(0);
  });

  it('补齐翻译确认后发布成功并入队同步，同时生成 AI 摘要（AC-F09-39）', async () => {
    await app.inject({ method: 'POST', url: `/api/kb/entries/${entryId}/translate`, headers: as('manager') });
    const confirm = await app.inject({ method: 'POST', url: `/api/kb/entries/${entryId}/translation/confirm`, headers: as('manager') });
    expect(confirm.statusCode).toBe(200);

    const publish = await app.inject({ method: 'POST', url: `/api/review/${entryId}/publish`, headers: as('reviewer') });
    const body = JSON.parse(publish.body) as { status: string };
    expect(body.status).toBe('published');

    const { rows } = await query<{ status: string }>('SELECT status FROM sync_tasks WHERE entry_id=$1', [entryId]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.status).toBe('synced');

    // 发布时生成 AI 摘要（人工未校正过，故 source=ai）
    const sum = await app.inject({ method: 'GET', url: `/api/kb/entries/${entryId}/summary`, headers: as('manager') });
    const summary = JSON.parse(sum.body) as { text: string; source: string; generatedAt: string | null };
    expect(summary.source, '发布应生成 AI 摘要').toBe('ai');
    expect(summary.text.length).toBeGreaterThan(0);
    expect(summary.generatedAt).not.toBeNull();
  });

  it('人工校正摘要后 source=human，再次发布不被 AI 覆盖（AC-F09-39）', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: `/api/kb/entries/${entryId}/summary`,
      headers: as('manager'),
      payload: { text: '人工校正版摘要：首次配对失败的三步排查与升级路径。' },
    });
    expect(put.statusCode).toBe(200);
    expect(JSON.parse(put.body).source).toBe('human');

    // 走一次「改后重新过审发布」，摘要不得被 AI 结果覆盖
    const detail = await app.inject({ method: 'GET', url: `/api/kb/entries/${entryId}`, headers: as('manager') });
    const { entry } = JSON.parse(detail.body) as {
      entry: {
        title: string; libraryId: string; chapterId: string; entryType: string; visibility: string;
        sceneL1: string; sceneL2: string; labels: string[]; deviceModels: string[];
        reviewCycleDays: number; ownerId: string | null; body: unknown; lockVersion: number;
      };
    };
    await app.inject({
      method: 'PUT',
      url: `/api/kb/entries/${entryId}`,
      headers: as('manager'),
      payload: {
        title: entry.title, libraryId: entry.libraryId, chapterId: entry.chapterId,
        entryType: entry.entryType, visibility: entry.visibility,
        sceneL1: entry.sceneL1, sceneL2: entry.sceneL2, labels: entry.labels,
        deviceModels: entry.deviceModels, reviewCycleDays: entry.reviewCycleDays, ownerId: entry.ownerId,
        body: entry.body, expectedVersion: entry.lockVersion,
      },
    });
    await app.inject({ method: 'POST', url: `/api/kb/entries/${entryId}/submit`, headers: as('manager'), payload: { source: 'manual' } });
    await app.inject({ method: 'POST', url: `/api/review/${entryId}/approve`, headers: as('reviewer') });
    await app.inject({ method: 'POST', url: `/api/kb/entries/${entryId}/translate`, headers: as('manager') });
    await app.inject({ method: 'POST', url: `/api/kb/entries/${entryId}/translation/confirm`, headers: as('manager') });
    await app.inject({ method: 'POST', url: `/api/review/${entryId}/publish`, headers: as('reviewer') });

    const sum = await app.inject({ method: 'GET', url: `/api/kb/entries/${entryId}/summary`, headers: as('manager') });
    const summary = JSON.parse(sum.body) as { text: string; source: string };
    expect(summary.source, '人工校正过的摘要不得被 AI 覆盖').toBe('human');
    expect(summary.text).toContain('人工校正版摘要');
  });

  it('RULE-02 审核员自审放行且留痕（AC-F09-36 rev6：四眼原则已取消）', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/kb/entries',
      headers: as('reviewer'),
      payload: {
        title: '自审放行验证条目', libraryId: 'lib_policy', chapterId: 'ch_refund', entryType: 'FAQ 型',
        visibility: 'public', sceneL1: '售后与退款', sceneL2: '退款时限', labels: ['测试'],
        deviceModels: [], reviewCycleDays: 180, ownerId: null,
        body: { paragraphs: [{ id: 'p0', text: '内容', html: '', internal: false, heading: false }] },
      },
    });
    const selfId = JSON.parse(create.body).id as string;
    await app.inject({ method: 'POST', url: `/api/kb/entries/${selfId}/submit`, headers: as('reviewer'), payload: { source: 'manual' } });

    // 提交人 = 当前审核员：接口不再拒绝
    const selfApprove = await app.inject({ method: 'POST', url: `/api/review/${selfId}/approve`, headers: as('reviewer') });
    expect(selfApprove.statusCode, '四眼原则已取消，自审应放行').toBe(200);
    expect(JSON.parse(selfApprove.body).status).toBe('approved');

    // 制衡改为事后审计：自审事实必须可查
    const { rows: audit } = await query<{ note: string; actor_name: string }>(
      `SELECT note, actor_name FROM audit_logs WHERE object_id=$1 AND action='审核通过' ORDER BY at DESC LIMIT 1`,
      [selfId],
    );
    expect(audit.length, '自审必须写审计日志').toBe(1);
    expect(audit[0]!.note, '审计里要能看出提交人 = 审核人').toContain('自审');

    // 「无人审不生效」不受影响：未过审条目仍不产生同步任务
    const { rows: pendingTasks } = await query<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM sync_tasks WHERE entry_id=$1',
      [selfId],
    );
    expect(Number(pendingTasks[0]!.n), '仅通过审核不入同步队列（发布 API 才是唯一写入源）').toBe(0);
  });
});

describe('RULE-04 可见性同步：内部段落零外泄', () => {
  it('混合条目对外文章不含内部段落原文', async () => {
    const sandbox = getSandbox();
    const article = await sandbox.getArticle('art_KB-0201');
    expect(article).not.toBeNull();
    expect(article!.bodyHtml).toContain('质量问题');
    expect(article!.bodyHtml, '内部口径不得出现在对外文章').not.toContain('主管审批');
    expect(article!.bodyHtml).not.toContain('$80');
  });

  it('仅内部条目挂客服 segment', async () => {
    const { rows } = await query<{ id: string; visibility: string }>(
      `SELECT id, visibility FROM entries WHERE visibility='internal' LIMIT 1`,
    );
    expect(rows[0]).toBeTruthy();
    const publicHtml = toPublicHtml({
      paragraphs: [{ id: 'a', text: '内部话术', html: '', internal: true, heading: false }],
    });
    expect(publicHtml.trim()).toBe('');
  });
});

describe('RULE-03 批量导入无绕审路径', () => {
  it('脏文件逐条报告失败，成功条目进待审队列', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/kb/import',
      headers: as('manager'),
      payload: {
        libraryId: 'lib_policy',
        rows: [
          '换货条件说明|退款与退货|public|换货需在签收后 15 天内提交申请。',
          '缺字段行|退款与退货',
          '章节不存在|不存在的章节|public|正文',
          '可见性非法|退款与退货|secret|正文',
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { total: number; succeeded: string[]; failed: Array<{ line: number; reason: string }> };
    expect(body.total).toBe(4);
    expect(body.succeeded).toHaveLength(1);
    expect(body.failed).toHaveLength(3);
    expect(body.failed.map((f) => f.line)).toEqual([2, 3, 4]);

    const { rows } = await query<{ status: string; review_source: string }>(
      `SELECT status, review_source FROM entries WHERE code=$1`,
      [body.succeeded[0]!],
    );
    expect(rows[0]!.status).toBe('pending_review');
    expect(rows[0]!.review_source).toBe('import');
  });
});

describe('RULE-06 同步失败 / 阻断 / drift / 并发冲突', () => {
  it('Zendesk 429 → 任务标失败并记录原因，Zendesk 端上一版继续服务', async () => {
    const sandbox = getSandbox();
    const { rows: entry } = await query<{ id: string; code: string }>(`SELECT id, code FROM entries WHERE code='KB-0188'`);
    const target = entry[0]!;
    sandbox.injectFailure(target.code, 429, 1, 2);

    const { rows: task } = await query<{ id: string }>(
      `INSERT INTO sync_tasks (id, entry_id, version_no, action, target, status, languages)
       VALUES ('sync_test_429', $1, 1, '更新正文 + labels', '帮助中心 · 对外文章', 'queued', '中') RETURNING id`,
      [target.id],
    );
    const { runSyncTask } = await import('./services/sync.js');
    const result = await runSyncTask(task[0]!.id);
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('429');

    const article = await sandbox.getArticle('art_KB-0188');
    expect(article, 'Zendesk 端上一版仍在服务').not.toBeNull();
  });

  it('英文未确认 → 同步阻断，不存在「阻断但已同步」中间态', async () => {
    const { rows: entry } = await query<{ id: string }>(`SELECT id FROM entries WHERE code='KB-0240'`);
    await query(
      `INSERT INTO sync_tasks (id, entry_id, version_no, action, target, status, languages)
       VALUES ('sync_test_blocked', $1, 1, '更新正文', '帮助中心 · 对外文章', 'queued', '中 / 英')`,
      [entry[0]!.id],
    );
    const { runSyncTask } = await import('./services/sync.js');
    const result = await runSyncTask('sync_test_blocked');
    expect(result.status).toBe('blocked');
    const { rows } = await query<{ status: string; blocked_reason: string | null }>(
      `SELECT status, blocked_reason FROM sync_tasks WHERE id='sync_test_blocked'`,
    );
    expect(rows[0]!.status).toBe('blocked');
    expect(rows[0]!.blocked_reason).toContain('英文未确认');
  });

  it('drift 检出：Zendesk 端被直接改写可被扫描发现', async () => {
    const sandbox = getSandbox();
    sandbox.simulateRemoteEdit('art_KB-0201', '<p>退款时限</p><p>非质量问题：签收后 3 天内可退（客服主管手改）</p>', 'Zendesk 端 客服主管 Ken');
    const { scanDrift, listDrift } = await import('./services/sync.js');
    const r = await scanDrift();
    expect(r.detected).toBeGreaterThan(0);
    const records = await listDrift();
    const rec = records.find((d) => d.articleRef.includes('KB-0201'));
    expect(rec?.changedBy).toContain('客服主管');
  });

  it('drift 拉回处置 → 内容进审核队列并留痕', async () => {
    const { listDrift, resolveDrift } = await import('./services/sync.js');
    const records = await listDrift();
    const pending = records.find((d) => !d.resolvedAction);
    expect(pending).toBeTruthy();
    const { rows: reviewer } = await query<{ id: string; name: string; role: string }>(
      `SELECT id, name, role FROM users WHERE email='lixiao@coolfly.com'`,
    );
    await resolveDrift(
      { id: reviewer[0]!.id, name: reviewer[0]!.name, role: 'kb_reviewer', email: '', libraryScope: [], mustChangePassword: false, permissions: [] },
      pending!.id,
      'pull_back',
    );
    const { rows } = await query<{ status: string; review_source: string }>(
      `SELECT status, review_source FROM entries WHERE code='KB-0201'`,
    );
    expect(rows[0]!.status).toBe('pending_review');
    expect(rows[0]!.review_source).toBe('feedback');

    const { rows: logs } = await query<{ action: string }>(
      `SELECT action FROM audit_logs WHERE object_type='drift' ORDER BY at DESC LIMIT 1`,
    );
    expect(logs[0]!.action).toContain('drift 处置');
  });

  it('并发编辑：后提交者收 409 冲突提示，不静默覆盖', async () => {
    const { rows } = await query<{ id: string; lock_version: number }>(
      `SELECT id, lock_version FROM entries WHERE code='KB-0233'`,
    );
    const e = rows[0]!;
    const payload = {
      title: '订单发出后能否改地址', libraryId: 'lib_policy', chapterId: 'ch_ship', entryType: 'FAQ 型',
      visibility: 'public', sceneL1: '订单与物流', sceneL2: '地址修改', labels: ['改地址'],
      deviceModels: [], reviewCycleDays: 180, ownerId: null,
      body: { paragraphs: [{ id: 'p0', text: 'A 用户的改动', html: '', internal: false, heading: false }] },
      expectedVersion: e.lock_version,
    };
    const first = await app.inject({ method: 'PUT', url: `/api/kb/entries/${e.id}`, headers: as('manager'), payload });
    expect(first.statusCode).toBe(200);

    const stale = await app.inject({
      method: 'PUT',
      url: `/api/kb/entries/${e.id}`,
      headers: as('reviewer'),
      payload: { ...payload, body: { paragraphs: [{ id: 'p0', text: 'B 用户的改动', html: '', internal: false, heading: false }] } },
    });
    expect(stale.statusCode).toBe(409);
    expect(JSON.parse(stale.body).message).toContain('并发编辑冲突');

    const { rows: after } = await query<{ body: { paragraphs: Array<{ text: string }> } }>(
      'SELECT body FROM entries WHERE id=$1',
      [e.id],
    );
    expect(after[0]!.body.paragraphs[0]!.text, '后提交者的改动未覆盖').toBe('A 用户的改动');
  });

  it('结构映射缺失 → 同步失败并提示先修复映射，不自动创建 Zendesk 结构', async () => {
    const { rows: chap } = await query<{ id: string }>(
      `INSERT INTO chapters (id, library_id, parent_id, name, zendesk_section_ref, sort_order)
       VALUES ('ch_unmapped', 'lib_policy', 'ch_after', '未映射章节', NULL, 99) RETURNING id`,
    );
    const { rows: e } = await query<{ id: string }>(
      `INSERT INTO entries (id, code, title, library_id, chapter_id, visibility, scene_l1, scene_l2, labels, body, status, current_version, en_status)
       VALUES ('ent_unmapped','KB-9999','未映射条目','lib_policy',$1,'public','售后与退款','测试','["t"]'::jsonb,
               '{"paragraphs":[{"id":"p0","text":"内容","internal":false,"heading":false}]}'::jsonb,'published',1,'confirmed') RETURNING id`,
      [chap[0]!.id],
    );
    await query(
      `INSERT INTO sync_tasks (id, entry_id, version_no, action, target, status, languages)
       VALUES ('sync_unmapped', $1, 1, '创建文章', '帮助中心 · 对外文章', 'queued', '中')`,
      [e[0]!.id],
    );
    const { runSyncTask } = await import('./services/sync.js');
    const r = await runSyncTask('sync_unmapped');
    expect(r.status).toBe('failed');
    expect(r.reason).toContain('结构映射缺失');
  });
});

describe('RULE-07 审计日志 append-only 且字段级前后值完整', () => {
  it('全链路动作均有留痕', async () => {
    const { rows } = await query<{ action: string; field: string | null; before_value: string | null; after_value: string | null }>(
      `SELECT action, field, before_value, after_value FROM audit_logs ORDER BY at DESC LIMIT 200`,
    );
    const actions = rows.map((r) => r.action);
    for (const expected of ['创建条目', '提交审核', '审核通过', '发布并同步', 'AI 翻译', '英文人工校验确认']) {
      expect(actions, `缺少动作留痕：${expected}`).toContain(expected);
    }
    const withDiff = rows.filter((r) => r.field && r.before_value && r.after_value);
    expect(withDiff.length, '应有字段级前后值记录').toBeGreaterThan(0);
  });

  it('UPDATE / DELETE 审计日志在数据库层被拒（append-only）', async () => {
    const { rows: before } = await query<{ id: string; action: string }>('SELECT id, action FROM audit_logs LIMIT 1');
    const target = before[0]!;
    await query(`UPDATE audit_logs SET action='被篡改' WHERE id=$1`, [target.id]);
    const { rows: afterUpdate } = await query<{ action: string }>('SELECT action FROM audit_logs WHERE id=$1', [target.id]);
    expect(afterUpdate[0]!.action, 'UPDATE 应被规则拒绝').toBe(target.action);

    await query('DELETE FROM audit_logs WHERE id=$1', [target.id]);
    const { rows: afterDelete } = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM audit_logs WHERE id=$1', [target.id]);
    expect(Number(afterDelete[0]!.n), 'DELETE 应被规则拒绝').toBe(1);
  });
});

describe('RULE-05 账号与会话安全', () => {
  it('系统管理员创建用户（必选角色与范围）+ 首次登录强制改密 + 禁用后会话即时失效', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/rbac/users',
      headers: as('admin'),
      payload: { name: '测试运营', email: 'test.ops@coolfly.com', role: 'kb_manager', libraryScope: ['lib_policy'], initialPassword: 'Init@2026x' },
    });
    expect(create.statusCode).toBe(200);
    const newId = JSON.parse(create.body).id as string;

    const missingScope = await app.inject({
      method: 'POST',
      url: '/api/rbac/users',
      headers: as('admin'),
      payload: { name: 'x', email: 'x2@coolfly.com', role: 'ai_ops', libraryScope: [], initialPassword: 'Init@2026x' },
    });
    expect(missingScope.statusCode, '必须选择知识库范围').toBe(400);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test.ops@coolfly.com', password: 'Init@2026x' },
    });
    expect(login.statusCode).toBe(200);
    expect(JSON.parse(login.body).user.mustChangePassword, '首次登录须强制改密').toBe(true);
    const newCookie = (Array.isArray(login.headers['set-cookie']) ? login.headers['set-cookie'][0]! : (login.headers['set-cookie'] as string)).split(';')[0]!;

    const before = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: newCookie } });
    expect(before.statusCode).toBe(200);

    const disable = await app.inject({
      method: 'POST',
      url: `/api/rbac/users/${newId}/toggle`,
      headers: as('admin'),
      payload: { enabled: false },
    });
    expect(disable.statusCode).toBe(200);

    const after = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: newCookie } });
    expect(after.statusCode, '禁用后在途会话应即时失效').toBe(401);

    const { rows } = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM audit_logs WHERE object_id=$1 AND action IN ('创建用户','禁用用户')`,
      [newId],
    );
    expect(Number(rows[0]!.n)).toBe(2);
  });

  it('权限矩阵修改仅系统管理员且即时生效 + 写审计', async () => {
    const before = await app.inject({ method: 'POST', url: '/api/kb/entries', headers: as('aiOps'), payload: {} });
    expect(before.statusCode).toBe(403);

    const update = await app.inject({
      method: 'PUT',
      url: '/api/rbac/matrix',
      headers: as('admin'),
      payload: { permission: 'entry.write', role: 'ai_ops', allowed: true },
    });
    expect(update.statusCode).toBe(200);

    const after = await app.inject({ method: 'POST', url: '/api/kb/entries', headers: as('aiOps'), payload: {} });
    expect(after.statusCode, '矩阵放开后不应再是 403').not.toBe(403);

    await app.inject({
      method: 'PUT',
      url: '/api/rbac/matrix',
      headers: as('admin'),
      payload: { permission: 'entry.write', role: 'ai_ops', allowed: false },
    });
    const restored = await app.inject({ method: 'POST', url: '/api/kb/entries', headers: as('aiOps'), payload: {} });
    expect(restored.statusCode).toBe(403);

    const { rows } = await query<{ before_value: string; after_value: string }>(
      `SELECT before_value, after_value FROM audit_logs WHERE object_type='permission_matrix' ORDER BY at DESC LIMIT 1`,
    );
    expect(rows[0]!.before_value).toBeTruthy();
    expect(rows[0]!.after_value).toBeTruthy();
  });
});

describe('FLOW-02 驳回理由必填与往返留痕', () => {
  it('空理由被拒；填写后回草稿箱并可重提', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/kb/entries',
      headers: as('manager'),
      payload: {
        title: '驳回往返验证', libraryId: 'lib_policy', chapterId: 'ch_billing', entryType: 'FAQ 型',
        visibility: 'public', sceneL1: '会员与账户', sceneL2: '会员计费', labels: ['会员'],
        deviceModels: [], reviewCycleDays: 180, ownerId: null,
        body: { paragraphs: [{ id: 'p0', text: '初版内容', html: '', internal: false, heading: false }] },
      },
    });
    const id = JSON.parse(create.body).id as string;
    await app.inject({ method: 'POST', url: `/api/kb/entries/${id}/submit`, headers: as('manager'), payload: { source: 'manual' } });

    const empty = await app.inject({ method: 'POST', url: `/api/review/${id}/reject`, headers: as('reviewer'), payload: { reason: '   ' } });
    expect(empty.statusCode).toBe(400);
    expect(JSON.parse(empty.body).message).toContain('驳回理由必填');

    const rejected = await app.inject({
      method: 'POST',
      url: `/api/review/${id}/reject`,
      headers: as('reviewer'),
      payload: { reason: '计费周期与财务口径不符，请附财务确认截图' },
    });
    expect(rejected.statusCode).toBe(200);

    const { rows } = await query<{ status: string; reject_reason: string }>('SELECT status, reject_reason FROM entries WHERE id=$1', [id]);
    expect(rows[0]!.status).toBe('rejected');
    expect(rows[0]!.reject_reason).toContain('财务确认截图');

    const resubmit = await app.inject({ method: 'POST', url: `/api/kb/entries/${id}/submit`, headers: as('manager'), payload: { source: 'manual' } });
    expect(resubmit.statusCode).toBe(200);

    const { rows: logs } = await query<{ action: string; note: string | null }>(
      `SELECT action, note FROM audit_logs WHERE object_id=$1 ORDER BY at ASC`,
      [id],
    );
    const actions = logs.map((l) => l.action);
    expect(actions).toContain('提交审核');
    expect(actions).toContain('审核驳回');
    expect(logs.find((l) => l.action === '审核驳回')?.note).toContain('驳回理由');
  });
});

describe('FLOW-03 挖掘三重准入', () => {
  it('查重 ≥0.85 的候选不提供立新条，只能挂修订', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/mine/candidates', headers: as('manager') });
    const rows = JSON.parse(list.body) as Array<{ id: string; title: string; dedupeScore: number; canCreateNew: boolean }>;
    const dup = rows.find((r) => r.dedupeScore >= 0.85);
    expect(dup, '种子应含高查重候选').toBeTruthy();
    expect(dup!.canCreateNew).toBe(false);

    const res = await app.inject({
      method: 'POST',
      url: `/api/mine/candidates/${dup!.id}/dispose`,
      headers: as('manager'),
      payload: { action: 'draft' },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).message).toContain('挂为修订建议');
  });

  it('候选起草产物进审核中心（无直接入库路径）', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/mine/candidates', headers: as('manager') });
    const rows = JSON.parse(list.body) as Array<{ id: string; canCreateNew: boolean; disposition: string }>;
    const fresh = rows.find((r) => r.canCreateNew && r.disposition === 'pending');
    expect(fresh).toBeTruthy();
    const res = await app.inject({
      method: 'POST',
      url: `/api/mine/candidates/${fresh!.id}/dispose`,
      headers: as('manager'),
      payload: { action: 'draft' },
    });
    expect(res.statusCode).toBe(200);
    const { entryId } = JSON.parse(res.body) as { entryId: string };
    const { rows: e } = await query<{ status: string; review_source: string }>('SELECT status, review_source FROM entries WHERE id=$1', [entryId]);
    expect(e[0]!.status).toBe('pending_review');
    expect(e[0]!.review_source).toBe('mining');
  });

  it('批次三态如实呈现（完成 / 无新草稿 / 失败）', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/mine/batches', headers: as('manager') });
    const { batches } = JSON.parse(res.body) as { batches: Array<{ status: string; failReason: string | null }> };
    const statuses = new Set(batches.map((b) => b.status));
    expect(statuses.has('completed')).toBe(true);
    expect(statuses.has('empty')).toBe(true);
    expect(statuses.has('failed')).toBe(true);
    expect(batches.find((b) => b.status === 'failed')?.failReason).toContain('429');
  });
});

describe('FLOW-06 翻译工作流状态机', () => {
  it('中文变更 → 英文置待重新校验 + 同步阻断', async () => {
    const { rows } = await query<{ id: string; lock_version: number }>(`SELECT id, lock_version FROM entries WHERE code='KB-0188'`);
    const e = rows[0]!;
    const res = await app.inject({
      method: 'PUT',
      url: `/api/kb/entries/${e.id}`,
      headers: as('manager'),
      payload: {
        title: '保修期与凭证要求', libraryId: 'lib_policy', chapterId: 'ch_warranty', entryType: 'FAQ 政策型',
        visibility: 'public', sceneL1: '售后与退款', sceneL2: '保修换新', labels: ['保修', '凭证'],
        deviceModels: [], reviewCycleDays: 180, ownerId: null,
        body: { paragraphs: [{ id: 'p0', text: '保修范围（已更新口径）', html: '', internal: false, heading: true }] },
        expectedVersion: e.lock_version,
      },
    });
    expect(res.statusCode).toBe(200);
    const { rows: after } = await query<{ en_status: string; sync_status: string; blocked_reason: string | null }>(
      'SELECT en_status, sync_status, blocked_reason FROM entries WHERE id=$1',
      [e.id],
    );
    expect(after[0]!.en_status).toBe('stale');
    expect(after[0]!.sync_status).toBe('blocked');
    expect(after[0]!.blocked_reason).toContain('待重新校验');
  });

  it('内部段落不翻译；确认前不可同步', async () => {
    // 独立构造混合可见性条目，避免与 drift 拉回用例共享数据
    const create = await app.inject({
      method: 'POST',
      url: '/api/kb/entries',
      headers: as('manager'),
      payload: {
        title: '混合可见性翻译验证', libraryId: 'lib_policy', chapterId: 'ch_refund', entryType: 'FAQ 政策型',
        visibility: 'mixed', sceneL1: '售后与退款', sceneL2: '退款时限', labels: ['退款'],
        deviceModels: [], reviewCycleDays: 180, ownerId: null,
        body: {
          paragraphs: [
            { id: 'p0', text: '退款时限', html: '', internal: false, heading: true },
            { id: 'p1', text: '非质量问题：签收后 5 天内可退。', html: '', internal: false, heading: false },
            { id: 'p2', text: '内部：超时个案走主管审批，额度上限 $80。', html: '', internal: true, heading: false },
          ],
        },
      },
    });
    const id = JSON.parse(create.body).id as string;
    await app.inject({ method: 'POST', url: `/api/kb/entries/${id}/translate`, headers: as('manager') });
    const { rows: pairs } = await query<{ internal: boolean; en_text: string | null }>(
      'SELECT internal, en_text FROM translation_pairs WHERE entry_id=$1',
      [id],
    );
    const internalPairs = pairs.filter((p) => p.internal);
    expect(internalPairs.length).toBeGreaterThan(0);
    expect(internalPairs.every((p) => p.en_text === null), '内部段落不得被翻译').toBe(true);
    const { rows: st } = await query<{ en_status: string }>('SELECT en_status FROM entries WHERE id=$1', [id]);
    expect(st[0]!.en_status).toBe('pending_human');
  });
});

describe('FLOW-04 版本与回滚', () => {
  it('回滚生成新版本、旧版标已回滚、指标保留并自动入队', async () => {
    const { rows } = await query<{ id: string; current_version: number }>(`SELECT id, current_version FROM entries WHERE code='KB-0155'`);
    const e = rows[0]!;
    const { rows: metricsBefore } = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM version_metrics WHERE entry_id=$1', [e.id]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/review/${e.id}/rollback`,
      headers: as('reviewer'),
      payload: { targetVersionNo: 1 },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { newVersion: number };
    expect(body.newVersion).toBe(e.current_version + 1);

    const { rows: versions } = await query<{ version_no: number; status: string }>(
      'SELECT version_no, status FROM entry_versions WHERE entry_id=$1 ORDER BY version_no',
      [e.id],
    );
    expect(versions.find((v) => v.version_no === e.current_version)?.status).toBe('rolled_back');
    expect(versions.find((v) => v.version_no === body.newVersion)?.status).toBe('current');

    const { rows: metricsAfter } = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM version_metrics WHERE entry_id=$1', [e.id]);
    expect(metricsAfter[0]!.n, '历史指标不得删除').toBe(metricsBefore[0]!.n);

    const { rows: task } = await query<{ action: string }>(
      `SELECT action FROM sync_tasks WHERE entry_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [e.id],
    );
    expect(task[0]!.action).toContain('回滚');
  });
});

describe('FLOW-07 筛选、复核到期与章节保护', () => {
  it('复核超期条目可被「已到期」筛选命中并标红', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/kb/entries?due=overdue', headers: as('manager') });
    const rows = JSON.parse(res.body) as Array<{ code: string; reviewDueLevel: string }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.reviewDueLevel === 'bad')).toBe(true);
  });

  it('含条目章节删除被拦截', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/kb/chapters/ch_refund', headers: as('manager') });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).message).toContain('请先移空');
  });

  it('搜索与组合筛选生效', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/kb/entries?q=退款&visibility=mixed', headers: as('manager') });
    const rows = JSON.parse(res.body) as Array<{ title: string; visibility: string }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.visibility === 'mixed')).toBe(true);
  });
});

describe('FLOW-05 数据看板与信号档位', () => {
  it('样本不足条目不显示误导性解决率', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/metrics/entries', headers: as('aiOps') });
    const rows = JSON.parse(res.body) as Array<{ code: string; solveRate: number | null; sampleShort: boolean; sampleLabel: string | null }>;
    const short = rows.find((r) => r.sampleShort);
    expect(short).toBeTruthy();
    expect(short!.solveRate).toBeNull();
    expect(short!.sampleLabel).toBe('样本积累中');
  });

  it('低解决率条目排在最前且标红', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/metrics/entries', headers: as('aiOps') });
    const rows = JSON.parse(res.body) as Array<{ solveRate: number | null; low: boolean }>;
    const withRate = rows.filter((r) => r.solveRate !== null);
    expect(withRate[0]!.low).toBe(true);
    for (let i = 1; i < withRate.length; i += 1) {
      expect(withRate[i]!.solveRate!).toBeGreaterThanOrEqual(withRate[i - 1]!.solveRate!);
    }
  });

  it('信号矩阵四渠道含确定性档位且待核实如实标注', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/feedback/signals', headers: as('aiOps') });
    const rows = JSON.parse(res.body) as Array<{ certainty: string }>;
    expect(rows).toHaveLength(4);
    expect(rows.some((r) => r.certainty === 'unverified')).toBe(true);
    expect(rows.some((r) => r.certainty === 'certain')).toBe(true);
  });

  it('客服工作数据仅口径说明，不重建报表', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/metrics/explore-note', headers: as('aiOps') });
    const { note } = JSON.parse(res.body) as { note: string };
    expect(note).toContain('Explore');
    expect(note).toContain('本台不重建');
  });
});
