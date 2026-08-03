#!/usr/bin/env python3
"""Validate stage-aware design traceability for feature and bugfix contracts."""

from __future__ import annotations

import re
import sys
from pathlib import Path


SOURCE_ID_PATTERN = r"(?:REQ-F\d{2,3}-\d{2,3}|AC-F\d{2,3}-\d{2,3}|NFR-\d{3}|REPRO-\d{3}|CUR-\d{3}|EXP-\d{3}|UNCH-\d{3}|CON-\d{3})"
SOURCE_ID_RE = re.compile(SOURCE_ID_PATTERN)
SOURCE_HEADING = re.compile(r"^###\s+(" + SOURCE_ID_PATTERN + r")\b", re.MULTILINE)
DESIGN_ID = re.compile(
    r"\b(?:PAGE-F\d{2,3}-\d{2,3}|CMP-F\d{2,3}-\d{2,3}|API-F\d{2,3}-\d{2,3}|DATA-F\d{2,3}-\d{2,3}|SEQ-F\d{2,3}-\d{2,3}|DEC-\d{3}|FIX-BUG-\d{3})\b"
)


def field(block: str, name: str) -> str | None:
    match = re.search(rf"^- {re.escape(name)}:\s*(.+?)\s*$", block, re.MULTILINE | re.IGNORECASE)
    return match.group(1).strip().strip("`") if match else None


def source_blocks(text: str) -> dict[str, str]:
    matches = list(SOURCE_HEADING.finditer(text))
    active: dict[str, str] = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.start():end]
        if not re.search(r"^- Status:\s*retired\s*$", block, re.MULTILINE | re.IGNORECASE):
            active[match.group(1)] = block
    return active


def mvp_sources(blocks: dict[str, str]) -> set[str]:
    mvp_requirements = {
        source_id
        for source_id, block in blocks.items()
        if source_id.startswith("REQ-") and "MVP" in (field(block, "Stage") or "").upper()
    }
    mvp = set(mvp_requirements)

    for source_id, block in blocks.items():
        if source_id.startswith("AC-"):
            if field(block, "Parent") in mvp_requirements:
                mvp.add(source_id)

    for source_id, block in blocks.items():
        if not source_id.startswith("NFR-"):
            continue
        applies_to = set(SOURCE_ID_RE.findall(field(block, "Applies-to") or ""))
        if not applies_to or applies_to & mvp:
            mvp.add(source_id)

    return mvp


def stage_classification_errors(blocks: dict[str, str]) -> list[str]:
    errors: list[str] = []
    requirements = {source_id for source_id in blocks if source_id.startswith("REQ-")}

    for source_id, block in blocks.items():
        if source_id.startswith("REQ-") and not field(block, "Stage"):
            errors.append(f"{source_id} 缺少 Stage，无法判断 MVP/后续阶段")
        elif source_id.startswith("AC-"):
            parent = field(block, "Parent")
            if parent not in requirements:
                errors.append(f"{source_id} 的 Parent 缺失或不是 active REQ: {parent or '-'}")

    return errors


def trace_rows(text: str) -> dict[str, list[str]]:
    rows: dict[str, list[str]] = {}
    for line in text.splitlines():
        if not line.startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) != 7 or not SOURCE_ID_RE.fullmatch(cells[0]):
            continue
        rows[cells[0]] = cells
    return rows


def main() -> int:
    if len(sys.argv) != 3:
        print("用法: py check_traceability.py <requirements.md|bugfix.md> <设计追溯矩阵.md>")
        return 2

    source_path, trace_path = map(Path, sys.argv[1:])
    missing_files = [str(path) for path in (source_path, trace_path) if not path.is_file()]
    if missing_files:
        print("❌ 文件不存在: " + ", ".join(missing_files))
        return 2

    blocks = source_blocks(source_path.read_text(encoding="utf-8"))
    sources = set(blocks)
    is_feature = any(source.startswith(("REQ-", "AC-", "NFR-")) for source in sources)
    mvp = mvp_sources(blocks) if is_feature else set(sources)
    rows = trace_rows(trace_path.read_text(encoding="utf-8"))
    errors: list[str] = []
    if is_feature:
        errors.extend(stage_classification_errors(blocks))

    for source in sorted(sources):
        if source not in rows:
            errors.append(f"缺少 source 行: {source}")
            continue
        cells = rows[source]
        if not DESIGN_ID.search(cells[2]):
            errors.append(f"{source} 缺少合法 Design ID")
        for index, label in ((3, "Artifact"), (4, "Error/Invariant"), (5, "Verification Surface")):
            if not cells[index] or re.search(r"\b(?:TBD|TODO|missing|none)\b|待定|缺失", cells[index], re.IGNORECASE):
                errors.append(f"{source} 的 {label} 未完成")
        status = cells[6].strip().strip("`").lower()
        if source in mvp:
            if status not in {"covered", "preserved"}:
                label = "MVP source" if is_feature else "Bugfix source"
                errors.append(f"{label} {source} 状态必须为 covered/preserved: {cells[6]}")
        elif status not in {"covered", "preserved", "planned"}:
            errors.append(f"后续阶段 source {source} 状态必须为 planned/covered/preserved: {cells[6]}")
        if status == "planned":
            artifact = cells[3]
            if not any(name in artifact for name in ("页面清单.md", "设计决策蓝图.md", "技术方案.md")):
                errors.append(f"后续阶段 source {source} 的 planned Artifact 必须指向页面清单/蓝图/技术方案骨架")
            if re.search(r"(?:^|[;/\s])pages[/\\].+\.(?:md|html)\b", artifact, re.IGNORECASE):
                errors.append(f"后续阶段 source {source} 为 planned，不得伪造尚未生成的页面文件")

    extra = sorted(set(rows) - sources)
    if extra:
        errors.append("矩阵包含未定义或 retired source: " + ", ".join(extra))

    if errors:
        print(f"❌ 设计追溯校验失败（{len(errors)}）")
        for error in errors:
            print(f"  - {error}")
        return 2

    if is_feature:
        future = sources - mvp
        print(
            "✅ 设计追溯校验通过："
            f"{len(mvp)} 个 MVP source 施工级覆盖 / {len(future)} 个后续 source 已规划"
        )
    else:
        print(f"✅ 设计追溯校验通过：{len(sources)} 个 Bugfix source 全覆盖")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
