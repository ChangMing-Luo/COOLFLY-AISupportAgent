#!/usr/bin/env python3
"""
check_consistency.py - PRD 跨章节一致性 PASS/FAIL 校验
(吸收自 senior-pm-prompt 的一致性检查块)

扫描 PRD 文件：
1. 每个 User Story (US-N) 是否有 ≥1 个 FR-N 实现
2. 每个 Business Goal 是否有 ≥1 个 Metric
3. 每个 User Goal 是否有 ≥1 个 Metric
4. Persona / Goal / User Story 的角色一致性（启发式）

用法: py check_consistency.py path/to/PRD.md

输出一段可直接附在 PRD 末尾的 PASS/FAIL 报告
"""
import re
import sys
from pathlib import Path


def extract_ids(text: str, pattern: str) -> list[str]:
    """提取所有匹配 pattern 的 ID（如 US-1, FR-2）"""
    return re.findall(pattern, text)


def extract_user_stories(text: str) -> dict[str, str]:
    """提取 US-N 及其内容（取第一次出现 + 后续 5 行作为上下文）"""
    us = {}
    lines = text.split("\n")
    pattern = re.compile(
        r"\*?\*?US[-_]?(\d+)\*?\*?[:：.]?\s*([^\n]+)", re.IGNORECASE
    )
    for i, line in enumerate(lines):
        m = pattern.search(line)
        if not m:
            continue
        us_id = f"US-{m.group(1)}"
        if us_id in us:
            continue  # 第一次出现优先
        # 取当前行 + 后续 5 行作为 US 内容上下文（捕获 FR-X 引用）
        context = "\n".join(lines[i : i + 6])
        us[us_id] = context
    return us


def extract_functional_reqs(text: str) -> dict[str, str]:
    """提取 FR-N 及其内容"""
    frs = {}
    pattern = re.compile(
        r"\*?\*?FR[-_]?(\d+)\*?\*?[:：.]?\s*([^\n]+)", re.IGNORECASE
    )
    for m in pattern.finditer(text):
        fr_id = f"FR-{m.group(1)}"
        frs[fr_id] = m.group(2).strip()
    return frs


def normalize_role(value: str) -> str:
    value = re.sub(r"<[^>]+>", "", value)
    value = re.sub(r"[*_`]", "", value)
    return re.sub(r"\s+", "", value).strip("：:，,。.;；")


def extract_role_alias_groups(text: str) -> list[set[str]]:
    section = re.search(
        r"###\s*2\.1[^\n]*(?:角色|用户)[^\n]*\n(.*?)(?=\n###\s|\n##\s|\Z)",
        text,
        re.DOTALL | re.IGNORECASE,
    )
    if not section:
        return []

    groups: list[set[str]] = []
    for line in section.group(1).splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = [normalize_role(cell) for cell in line.strip().strip("|").split("|")]
        if (
            len(cells) < 2
            or cells[0] in {"角色", "用户角色"}
            or all(re.fullmatch(r":?-+:?", cell) for cell in cells)
        ):
            continue
        aliases = {cell for cell in cells[:2] if cell and cell != "-"}
        if aliases:
            groups.append(aliases)
    return groups


def extract_user_story_role(content: str) -> str | None:
    match = re.search(
        r"作为\s*(.+?)\s*[,，]\s*我希望",
        content,
        re.IGNORECASE,
    )
    return normalize_role(match.group(1)) if match else None


def role_is_declared(role: str, groups: list[set[str]]) -> bool:
    for aliases in groups:
        for alias in aliases:
            if role == alias or (len(role) >= 2 and (role in alias or alias in role)):
                return True
    return False


def find_fr_references_in_us(us_content: str) -> list[str]:
    """在 US 内容中找引用的 FR"""
    return re.findall(r"FR[-_]?(\d+)", us_content, re.IGNORECASE)


def extract_goals_and_metrics(text: str) -> tuple[list[str], list[str], list[str]]:
    """提取业务目标、用户目标、成功指标"""
    business_goals = []
    user_goals = []
    metrics = []

    # 启发式：找"业务目标"/"商业目标"/"Business Goal" 等章节后的列表项
    bg_section = re.search(
        r"(?:业务目标|商业目标|Business Goal[s]?)[^\n]*\n(.*?)(?=\n#+\s|\Z)",
        text,
        re.DOTALL | re.IGNORECASE,
    )
    if bg_section:
        # 提取 - 或 * 开头的行
        for line in bg_section.group(1).split("\n"):
            line = line.strip()
            if line.startswith(("-", "*", "•")) and len(line) > 5:
                business_goals.append(line[1:].strip())

    ug_section = re.search(
        r"(?:用户目标|User Goal[s]?)[^\n]*\n(.*?)(?=\n#+\s|\Z)",
        text,
        re.DOTALL | re.IGNORECASE,
    )
    if ug_section:
        for line in ug_section.group(1).split("\n"):
            line = line.strip()
            if line.startswith(("-", "*", "•")) and len(line) > 5:
                user_goals.append(line[1:].strip())

    metric_section = re.search(
        r"(?:成功指标|成功度量|Success Metric[s]?|度量指标)[^\n]*\n(.*?)(?=\n#+\s|\Z)",
        text,
        re.DOTALL | re.IGNORECASE,
    )
    if metric_section:
        ms_text = metric_section.group(1)
        # 表格行
        for line in ms_text.split("\n"):
            line = line.strip()
            if "|" in line and not re.match(r"^[\s\|:\-]+$", line):
                metrics.append(line)
            elif line.startswith(("-", "*", "•")) and len(line) > 5:
                metrics.append(line[1:].strip())

    return business_goals, user_goals, metrics


def check_us_to_fr(
    user_stories: dict[str, str], functional_reqs: dict[str, str], text: str
) -> list[tuple[str, str, str]]:
    """返回 [(US-id, fr_refs, status)]"""
    results = []
    fr_ids_set = set(functional_reqs.keys())

    for us_id, us_content in user_stories.items():
        # 找 US 内容里直接引用的 FR
        fr_refs = find_fr_references_in_us(us_content)
        # 也找 FR 内容里是否提到该 US（隐式映射）
        referencing_frs = []
        for fr_id, fr_content in functional_reqs.items():
            if us_id in fr_content or us_id.replace("-", "") in fr_content:
                referencing_frs.append(fr_id.replace("FR-", ""))

        all_refs = list(set(fr_refs + referencing_frs))
        if all_refs:
            status = "PASS"
            ref_str = ", ".join(f"FR-{r}" for r in all_refs)
        else:
            status = "FAIL"
            ref_str = "(no FR implements it)"
        results.append((us_id, ref_str, status))

    return results


def check_goal_to_metric(goals: list[str], metrics: list[str]) -> list[tuple[str, str]]:
    """启发式：检查每个目标是否在 metrics 章节有相关条目"""
    results = []
    for goal in goals:
        # 提取目标的关键词
        keywords = [
            w for w in re.findall(r"[一-龥a-zA-Z]{2,}", goal) if len(w) > 1
        ][:3]
        if not keywords:
            results.append((goal, "FAIL (no keywords to match)"))
            continue
        # 看 metrics 里有没有任一关键词
        matched = False
        for metric in metrics:
            if any(kw in metric for kw in keywords):
                matched = True
                break
        status = "PASS" if matched else "FAIL"
        results.append((goal[:50], status))
    return results


def main():
    if len(sys.argv) < 2:
        print("用法: py check_consistency.py <PRD.md 文件路径>")
        sys.exit(2)

    file_path = Path(sys.argv[1])
    if not file_path.exists():
        print(f"❌ 文件不存在: {file_path}")
        sys.exit(2)

    text = file_path.read_text(encoding="utf-8", errors="replace")

    user_stories = extract_user_stories(text)
    functional_reqs = extract_functional_reqs(text)
    business_goals, user_goals, metrics = extract_goals_and_metrics(text)
    role_groups = extract_role_alias_groups(text)

    print(f"\n=== 一致性校验 PASS/FAIL: {file_path.name} ===\n")

    print(f"📊 提取统计:")
    print(f"  - User Stories: {len(user_stories)}")
    print(f"  - Functional Requirements: {len(functional_reqs)}")
    print(f"  - Business Goals: {len(business_goals)}")
    print(f"  - User Goals: {len(user_goals)}")
    print(f"  - Success Metrics: {len(metrics)}")
    print()

    fail_count = 0

    # US → FR 映射
    print("## User Stories → FR 映射")
    print()
    if user_stories:
        us_results = check_us_to_fr(user_stories, functional_reqs, text)
        for us_id, refs, status in us_results:
            marker = "✅" if status == "PASS" else "❌"
            print(f"  {marker} {us_id} → {refs} [{status}]")
            if status == "FAIL":
                fail_count += 1
    else:
        print("  ⚠️  未识别到 User Stories（请确认章节标题用了 US-N 格式）")
    print()

    # Persona / Role → User Story 一致性
    print("## 角色矩阵 → User Stories 一致性")
    print()
    if user_stories and not role_groups:
        print("  ❌ 未识别到 §2.1 用户角色矩阵 [FAIL]")
        fail_count += 1
    elif user_stories:
        for us_id, content in user_stories.items():
            role = extract_user_story_role(content)
            if not role:
                print(f"  ❌ {us_id} 没有可识别的“作为某角色，我希望” [FAIL]")
                fail_count += 1
            elif not role_is_declared(role, role_groups):
                print(f"  ❌ {us_id} 的角色“{role}”未出现在 §2.1 角色矩阵 [FAIL]")
                fail_count += 1
            else:
                print(f"  ✅ {us_id} → {role} [PASS]")
    else:
        print("  ⚠️  没有 User Stories，无法检查角色一致性")
    print()

    # Business Goals → Metrics
    print("## Business Goals → Metrics 映射")
    print()
    if business_goals:
        bg_results = check_goal_to_metric(business_goals, metrics)
        for goal, status in bg_results:
            marker = "✅" if status == "PASS" else "❌"
            print(f'  {marker} "{goal}..." → [{status}]')
            if status == "FAIL":
                fail_count += 1
    else:
        print("  ⚠️  未识别到 Business Goals 章节")
    print()

    # User Goals → Metrics
    print("## User Goals → Metrics 映射")
    print()
    if user_goals:
        ug_results = check_goal_to_metric(user_goals, metrics)
        for goal, status in ug_results:
            marker = "✅" if status == "PASS" else "❌"
            print(f'  {marker} "{goal}..." → [{status}]')
            if status == "FAIL":
                fail_count += 1
    else:
        print("  ⚠️  未识别到 User Goals 章节")
    print()

    # 总结
    if fail_count == 0:
        print("✅ 全部 PASS — PRD 一致性 OK")
        sys.exit(0)
    else:
        print(f"❌ {fail_count} 个 FAIL — 需修复后才能定稿")
        print("\n建议处理：")
        print("  - US 没有 FR → 检查是否漏写功能，或该 US 是不是真需求")
        print("  - Goal 没有 Metric → 立即追问：怎么衡量？基线？目标？时间窗？")
        sys.exit(2)


if __name__ == "__main__":
    main()
