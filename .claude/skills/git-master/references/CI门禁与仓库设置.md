# CI 门禁与仓库设置

> 本文件是 git-master 阶段 II 步骤 3、4 的**生成底本**：CI workflow 按检测到的技术栈生成，分支保护等仓库设置只给指引（不自动改）。

---

## 一、CI workflow 检测生成规则（检测优先，识别不了就跳过）

### 检测决策表

| 检测信号（文件） | 技术栈 | 包管理器判断 | 生成命令 |
| :--- | :--- | :--- | :--- |
| `package.json` | Node | `package-lock.json`→npm / `pnpm-lock.yaml`→pnpm / `yarn.lock`→yarn | `npm ci && npm test` |
| `requirements.txt` / `pyproject.toml` | Python | — | `pytest` |
| `go.mod` | Go | — | `go test ./...` |
| `pom.xml` | Java (Maven) | — | `mvn -B test` |
| `build.gradle` / `build.gradle.kts` | Java (Gradle) | — | `./gradlew test` |
| `Cargo.toml` | Rust | — | `cargo test` |
| `composer.json` | PHP | — | `composer install && composer test` |
| **以上都没有 / 没有测试脚本** | **识别不了** | — | **跳过 ci.yml，只在设置指引里写"怎么配 CI"** |

> 额外校验：Node 项目若 `package.json` 没有 `scripts.test`，或 test 脚本是占位（如 `echo no test`）→ 标记"无真实测试"，跳过 CI 生成并在汇报里提示"先加测试再开 CI"。

### 模板 1 · Node（npm）

文件 `.github/workflows/ci.yml`：

```yaml
name: CI
on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
```

> pnpm 版：把 setup-node 的 `cache: npm` 改 `cache: pnpm`，加 `- run: npm i -g pnpm`，命令改 `pnpm install --frozen-lockfile` + `pnpm test`。
> yarn 版：`cache: yarn`，`yarn install --frozen-lockfile` + `yarn test`。

### 模板 2 · Python

```yaml
name: CI
on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: pip install pytest
      - run: pytest
```

> `pyproject.toml` 项目按实际依赖安装方式调整（如 `pip install -e .`）。

### 模板 3 · Go

```yaml
name: CI
on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      - run: go test ./...
```

### 模板 4 · Java (Maven)

```yaml
name: CI
on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'
          cache: maven
      - run: mvn -B test
```

### 模板 5 · Rust

```yaml
name: CI
on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cargo test
```

### 模板 6 · PHP

```yaml
name: CI
on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'
      - run: composer install --no-interaction
      - run: composer test
```

> `composer test` 要求 `composer.json` 的 `scripts.test` 已定义；没有则改 `vendor/bin/phpunit`。

---

## 二、分支保护设置指引（生成到 `仓库协作设置指引.md`，不自动改仓库）

> 这是 git-master 产出给用户的**文档**，告诉用户怎么手动把仓库设置成受保护。**git-master 本身不执行这些命令**（涉及权限 + 敏感设置，属安全边界），除非用户当次明确要求"用 gh CLI 自动设"。

### 方式 A · gh CLI（推荐，可复制粘贴）

前置：`gh auth login` 已登录，且对仓库有 admin 权限。

```bash
# 把 <OWNER>/<REPO> 换成你的仓库
gh api -X PUT repos/<OWNER>/<REPO>/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks[strict]=true \
  -f required_status_checks[contexts][]="CI" \
  -f enforce_admins=false \
  -f required_pull_request_reviews[dismiss_stale_reviews]=true \
  -f required_pull_request_reviews[required_approving_review_count]=1 \
  -f restrictions= \
  -f allow_force_pushes=false
```

含义：
- PR 必须过 CI（status check 名 `"CI"`，与 ci.yml 的 `name: CI` 对应）
- PR 至少 1 人 approve
- 强制 push 关闭（没人能 force-push 到 main）

### 方式 B · 网页手动设置

1. 仓库页 → **Settings** → **Branches**
2. **Branch protection rules** → **Add rule**
3. Branch name pattern: `main`
4. 勾选：
   - ☑ Require a pull request before merging → Required approvals: `1`
   - ☑ Require status checks to pass → 搜索勾选 `CI`
   - ☑ Do not allow bypassing the above settings（可选，连 admin 也卡）
5. **Create** / **Save changes**

---

## 三、标签体系建议（可选，写进设置指引）

建议在仓库 Issues → Labels 配这套标签（颜色自定）：

| 标签 | 用途 |
| :--- | :--- |
| `needs-triage` | 新提的，待负责人分类（issue 模板默认带） |
| `bug` | 报 Bug 模板默认带 |
| `feature` | 新功能 |
| `enhancement` | 改进现有 |
| `docs` | 文档改动 |
| `priority:high` / `priority:low` | 优先级 |
| `needs-prd` | 需求大到要跑 prd-master（营队链路联动） |

---

## 四、Stale Bot（可选，自动关闭长期没人理的 issue/PR）

文件 `.github/workflows/stale.yml`（用 GitHub 官方 `actions/stale`）：

```yaml
name: Mark stale
on:
  schedule:
    - cron: '30 1 * * *'   # 每天 1:30 UTC
jobs:
  stale:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      pull-requests: write
    steps:
      - uses: actions/stale@v9
        with:
          days-before-stale: 30
          days-before-close: 7
          stale-issue-label: 'stale'
          stale-pr-label: 'stale'
          exempt-issue-labels: 'priority:high,pinned'
          stale-issue-message: '这个 issue 30 天没动静了，再不动 7 天后自动关闭。需要的话留个言。'
          stale-pr-message: '这个 PR 30 天没动静了，再不动 7 天后自动关闭。'
```

> 默认不生成，除非用户在阶段 I 明确要"自动化运维"。
