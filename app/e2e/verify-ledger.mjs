/**
 * 完成条件 #3 机械核对：契约与结果台账一致性。
 * 校验 sha256 一致、ID 集合完全相等且无重复、pending=0、fail=0、pass=总数。
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const base = '/Users/judyzhu/Documents/AICoding/COOLFLY-AISupportAgent/COOLFLY智能客服/output/tests';
const contractPath = `${base}/TDD验收契约.md`;
const resultPath = `${base}/TDD验收结果.md`;

const contract = readFileSync(contractPath, 'utf8');
const result = readFileSync(resultPath, 'utf8');

const problems = [];

// 1. sha256 一致
const actualSha = createHash('sha256').update(readFileSync(contractPath)).digest('hex');
const declaredSha = /contract_sha256:\s*sha256:([0-9a-f]{64})/.exec(result)?.[1];
const shaOk = actualSha === declaredSha;
if (!shaOk) problems.push(`sha256 不一致：契约实际 ${actualSha} ≠ 台账声明 ${declaredSha ?? '(缺失)'}`);

// 2. ID 集合完全相等且无重复
const contractIds = [...contract.matchAll(/`((?:SMOKE|FLOW|DESIGN|RULE|BUG)-\d+)`/g)].map((m) => m[1]);
const contractSet = [...new Set(contractIds)].sort();

const rows = [...result.matchAll(/^\|\s*((?:SMOKE|FLOW|DESIGN|RULE|BUG)-\d+)\s*\|\s*(\w+)\s*\|/gm)];
const resultIds = rows.map((r) => r[1]);
const resultSet = [...new Set(resultIds)].sort();

if (resultIds.length !== resultSet.length) {
  problems.push(`台账存在重复 ID：${resultIds.filter((v, i) => resultIds.indexOf(v) !== i).join(', ')}`);
}
const missing = contractSet.filter((id) => !resultSet.includes(id));
const extra = resultSet.filter((id) => !contractSet.includes(id));
if (missing.length) problems.push(`台账缺少契约 ID：${missing.join(', ')}`);
if (extra.length) problems.push(`台账多出契约外 ID：${extra.join(', ')}`);

// 3. 状态统计
const statuses = rows.map((r) => r[2]);
const count = (s) => statuses.filter((x) => x === s).length;
const pass = count('pass');
const pending = count('pending');
const fail = count('fail');
if (pending !== 0) problems.push(`pending=${pending}（要求 0）`);
if (fail !== 0) problems.push(`fail=${fail}（要求 0）`);
if (pass !== contractSet.length) problems.push(`pass=${pass} ≠ 契约总数 ${contractSet.length}`);

// 4. 每个 pass 必须有证据（证据列非空且非占位）
for (const m of result.matchAll(/^\|\s*((?:SMOKE|FLOW|DESIGN|RULE|BUG)-\d+)\s*\|\s*pass\s*\|([^|]*)\|([^|]*(?:\|[^|]*)*)$/gm)) {
  const [, id, , evidence] = m;
  const clean = evidence.replace(/\|/g, ' ').trim();
  if (clean.length < 20 || clean === '—') problems.push(`${id} 标 pass 但证据不足：「${clean.slice(0, 30)}」`);
}

console.log('契约 ID 数：', contractSet.length, '→', contractSet.join(', '));
console.log('台账 ID 数：', resultSet.length);
console.log(`统计：pass=${pass} pending=${pending} fail=${fail}`);
console.log('sha256 一致：', shaOk ? '是' : '否');

if (problems.length) {
  console.log('\n❌ 机械核对未通过：');
  for (const p of problems) console.log('  - ' + p);
  process.exit(1);
}
console.log('\n✅ 机械核对通过：sha256 一致、ID 集合相等无重复、pending=0、fail=0、pass=总数、每项均有证据');
