#!/usr/bin/env python3
"""Validate the compact TDD acceptance contract and its upstream coverage."""

from __future__ import annotations

import hashlib
import re
import struct
import sys
from pathlib import Path


SOURCE_ID_PATTERN = r"(?:REQ-F\d{2,3}-\d{2,3}|AC-F\d{2,3}-\d{2,3}|NFR-\d{3}|REPRO-\d{3}|CUR-\d{3}|EXP-\d{3}|UNCH-\d{3}|CON-\d{3})"
SOURCE_ID_RE = re.compile(SOURCE_ID_PATTERN)
SOURCE_HEADING_RE = re.compile(r"^###\s+(" + SOURCE_ID_PATTERN + r")\b", re.MULTILINE)
DESIGN_ID_PATTERN = r"(?:PAGE-F\d{2,3}-\d{2,3}|CMP-F\d{2,3}-\d{2,3}|API-F\d{2,3}-\d{2,3}|DATA-F\d{2,3}-\d{2,3}|SEQ-F\d{2,3}-\d{2,3}|DEC-\d{3}|FIX-BUG-\d{3})"
DESIGN_ID_RE = re.compile(DESIGN_ID_PATTERN)
PAGE_ID_RE = re.compile(r"PAGE-F\d{2,3}-\d{2,3}")
PAGE_ARTIFACT_RE = re.compile(
    r"(?:output/)?pages/[^\s;|`]+?\.(?:md|html)", re.IGNORECASE
)
TEST_ID_RE = re.compile(
    r"(?:SMOKE|FLOW|RULE|DESIGN)-\d{2,3}|BUG-(?:REPRO|FIX|REG|RULE)-\d{2,3}"
)
PLACEHOLDER_RE = re.compile(r"\{\{|\b(?:TBD|TODO|missing)\b|待定|缺失|占位", re.IGNORECASE)
FIDELITY_ANCHORS = ("结构", "组件", "内容", "交互", "视觉", "原生适配")
VISUAL_EVIDENCE_KEYS = ("baseline", "actual", "reviewer", "review", "blocking")
REQUIRED_SECTIONS = (
    "## 0. 契约元信息",
    "## 1. 完成定义",
    "## 2. 冒烟门禁",
    "## 3. 功能与流程验收",
    "## 4. 设计落地验收",
    "## 5. 风险触发验收",
    "## 6. 本期不阻塞项",
)


def field(block: str, name: str) -> str | None:
    match = re.search(rf"^- {re.escape(name)}:\s*(.+?)\s*$", block, re.MULTILINE | re.IGNORECASE)
    return match.group(1).strip().strip("`") if match else None


def source_blocks(text: str) -> dict[str, str]:
    matches = list(SOURCE_HEADING_RE.finditer(text))
    blocks: dict[str, str] = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.start():end]
        if not re.search(r"^- Status:\s*retired\s*$", block, re.MULTILINE | re.IGNORECASE):
            blocks[match.group(1)] = block
    return blocks


def required_sources(text: str, work_type: str) -> set[str]:
    blocks = source_blocks(text)
    if work_type == "bugfix":
        return set(blocks)

    mvp_requirements = {
        source_id
        for source_id, block in blocks.items()
        if source_id.startswith("REQ-") and "MVP" in (field(block, "Stage") or "").upper()
    }
    required = set(mvp_requirements)

    for source_id, block in blocks.items():
        if source_id.startswith("AC-"):
            parent = field(block, "Parent")
            priority = (field(block, "Priority") or "").upper()
            if parent in mvp_requirements and priority in {"P0", "P1"}:
                required.add(source_id)
        elif source_id.startswith("NFR-"):
            applies_to = set(SOURCE_ID_RE.findall(field(block, "Applies-to") or ""))
            if not applies_to or applies_to & mvp_requirements:
                required.add(source_id)

    return required


def table_cells(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def acceptance_rows(text: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for line in text.splitlines():
        if not line.startswith("|"):
            continue
        cells = table_cells(line)
        if len(cells) == 6 and TEST_ID_RE.fullmatch(cells[0].strip("`")):
            cells[0] = cells[0].strip("`")
            rows.append(cells)
    return rows


def result_rows(text: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for line in text.splitlines():
        if not line.startswith("|"):
            continue
        cells = table_cells(line)
        if len(cells) == 4 and TEST_ID_RE.fullmatch(cells[0].strip("`")):
            cells[0] = cells[0].strip("`")
            rows.append(cells)
    return rows


def structured_fields(value: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for part in re.split(r"[;；]", value.strip().strip("`")):
        key, separator, detail = part.partition("=")
        if separator:
            fields[key.strip()] = detail.strip().strip("`")
    return fields


def mvp_page_specs(page_list_text: str) -> dict[str, tuple[str, str, str]]:
    pages: dict[str, tuple[str, str, str]] = {}
    for line in page_list_text.splitlines():
        if not line.startswith("|"):
            continue
        cells = table_cells(line)
        if len(cells) >= 5 and PAGE_ID_RE.fullmatch(cells[0]) and "MVP" in cells[2].upper():
            pages[cells[0]] = (cells[2], cells[3], cells[4])
    return pages


def artifact_paths(value: str) -> list[Path]:
    paths: list[Path] = []
    for raw_path in PAGE_ARTIFACT_RE.findall(value):
        normalized = raw_path.removeprefix("output/")
        path = Path(normalized)
        if path.is_absolute() or ".." in path.parts or not path.parts or path.parts[0] != "pages":
            continue
        paths.append(path)
    return paths


def page_identity_score(path: Path, page_id: str, page_name: str) -> int:
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return 0

    if path.suffix.lower() == ".html":
        for meta_tag in re.findall(r"<meta\b[^>]*>", text, re.IGNORECASE):
            name = re.search(r'name=["\']([^"\']+)', meta_tag, re.IGNORECASE)
            content = re.search(r'content=["\']([^"\']+)', meta_tag, re.IGNORECASE)
            if (
                name
                and content
                and name.group(1).strip().lower() == "page-id"
                and content.group(1).strip() == page_id
            ):
                return 100
        title = re.search(r"<title[^>]*>(.*?)</title>", text, re.IGNORECASE | re.DOTALL)
        if title and page_name and page_name in re.sub(r"<[^>]+>", "", title.group(1)):
            return 60
    else:
        page_id_row = re.search(
            rf"^\|\s*页面\s*ID\s*\|\s*`?{re.escape(page_id)}`?\s*\|",
            text,
            re.MULTILINE | re.IGNORECASE,
        )
        if page_id_row:
            return 100
        heading = re.search(r"^#\s+.*$", text, re.MULTILINE)
        if heading and page_name and page_name in heading.group(0):
            return 60

    if page_name and page_name in path.stem:
        return 40
    if page_name and page_name in text:
        return 10
    return 0


def select_page_artifact(
    output: Path,
    explicit_paths: list[Path],
    suffix: str,
    page_id: str,
    page_name: str,
) -> tuple[Path | None, str | None]:
    pages_root = output / "pages"
    candidates = {
        output / relative
        for relative in explicit_paths
        if relative.suffix.lower() == suffix and (output / relative).is_file()
    }
    if pages_root.is_dir():
        candidates.update(path for path in pages_root.rglob(f"*{suffix}") if path.is_file())

    scored = [(page_identity_score(path, page_id, page_name), path) for path in candidates]
    scored = [(score, path) for score, path in scored if score > 0]
    if not scored:
        return None, f"{page_id} 找不到内容可确认的 {suffix} 产物"

    best_score = max(score for score, _ in scored)
    best = sorted(path for score, path in scored if score == best_score)
    if len(best) != 1:
        choices = ", ".join(str(path.relative_to(output)) for path in best)
        return None, f"{page_id} 的 {suffix} 内容匹配不唯一: {choices}"
    return best[0], None


def canonical_page_stem(stage: str, module: str, page_name: str) -> str:
    stage_match = re.search(r"阶段\s*([0-9一二三四五六七八九十]+)", stage)
    normalized_stage = f"阶段{stage_match.group(1)}" if stage_match else stage.split("(", 1)[0].strip()
    normalized_module = re.sub(r"[\\/]", "_", module).strip()
    return f"{normalized_stage}_{normalized_module}_{page_name}".strip("_")


def invalid_detail(value: str, allow_dash: bool = False) -> bool:
    stripped = value.strip().strip("`")
    if not stripped or PLACEHOLDER_RE.search(stripped):
        return True
    return stripped == "-" and not allow_dash


def sha256(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def visual_artifact_path(output: Path, raw_path: str) -> tuple[Path | None, str | None]:
    normalized = raw_path.strip().strip("`\"'").removeprefix("output/")
    relative = Path(normalized)
    if (
        relative.is_absolute()
        or ".." in relative.parts
        or len(relative.parts) < 3
        or relative.parts[:2] != ("tests", "visual")
        or relative.suffix.lower() != ".png"
    ):
        return None, f"视觉证据必须是 output/tests/visual/ 下的相对 PNG 路径: {raw_path}"
    return output / relative, None


def png_dimensions(path: Path) -> tuple[int, int] | None:
    try:
        data = path.read_bytes()
    except OSError:
        return None
    if (
        len(data) < 45
        or data[:8] != b"\x89PNG\r\n\x1a\n"
        or data[12:16] != b"IHDR"
        or not data.endswith(b"\x00\x00\x00\x00IEND\xaeB`\x82")
    ):
        return None
    width, height = struct.unpack(">II", data[16:24])
    return (width, height) if width > 0 and height > 0 else None


def validate_design_result(
    output: Path,
    test_id: str,
    design_cell: str,
    action: str,
    evidence: str,
) -> list[str]:
    errors: list[str] = []
    if (
        "baseline" not in action.lower()
        or "actual" not in action.lower()
        or not any(verb in action for verb in ("看图", "查看"))
    ):
        errors.append(f"{test_id} 的实际验证动作没有证明验收官查看了 baseline+actual")
    page_ids = sorted(set(PAGE_ID_RE.findall(design_cell)))
    page_id = page_ids[0] if len(page_ids) == 1 else None
    fields = structured_fields(evidence)
    missing = [key for key in VISUAL_EVIDENCE_KEYS if invalid_detail(fields.get(key, ""))]
    if missing:
        errors.append(f"{test_id} 缺少视觉证据字段: {', '.join(missing)}")
        return errors

    if fields["reviewer"].lower() != "independent-visual":
        errors.append(f"{test_id} 必须由 independent-visual 独立看图验收，不能自我签字")
    if fields["review"].lower() != "pass":
        errors.append(f"{test_id} 的独立视觉复核未通过: {fields['review']}")
    if fields["blocking"] != "0":
        errors.append(f"{test_id} 仍有阻塞视觉差异: {fields['blocking']}")

    resolved: dict[str, tuple[Path, tuple[int, int]]] = {}
    for key in ("baseline", "actual"):
        path, path_error = visual_artifact_path(output, fields[key])
        if path_error:
            errors.append(f"{test_id}: {path_error}")
            continue
        assert path is not None
        if not path.is_file():
            errors.append(f"{test_id} 的 {key} 截图不存在: {path}")
            continue
        dimensions = png_dimensions(path)
        if dimensions is None:
            errors.append(f"{test_id} 的 {key} 不是有效 PNG: {path}")
            continue
        if page_id and page_id not in path.name:
            errors.append(f"{test_id} 的 {key} 文件名必须包含 {page_id}: {path.name}")
        resolved[key] = (path, dimensions)

    if "baseline" in resolved and "actual" in resolved:
        baseline_path, baseline_size = resolved["baseline"]
        actual_path, actual_size = resolved["actual"]
        if baseline_path == actual_path:
            errors.append(f"{test_id} 的 baseline 与 actual 不能指向同一文件")
        if baseline_size != actual_size:
            errors.append(
                f"{test_id} 的原型/成品截图尺寸不同: {baseline_size} != {actual_size}"
            )
    return errors


def validate_result_ledger(
    output: Path,
    result_path: Path,
    contract_path: Path,
    contract_rows: list[list[str]],
) -> list[str]:
    if not result_path.is_file():
        return []

    text = result_path.read_text(encoding="utf-8")
    errors: list[str] = []
    if field(text, "contract_sha256") != sha256(contract_path):
        errors.append("TDD验收结果的 contract_sha256 与当前契约不一致，旧通过状态全部失效")
    if invalid_detail(field(text, "run_started_at") or ""):
        errors.append("TDD验收结果缺少有效 run_started_at")

    rows = result_rows(text)
    if not rows:
        errors.append("TDD验收结果没有合法结果行")
        return errors

    contract_ids = [row[0] for row in contract_rows]
    contract_by_id = {row[0]: row for row in contract_rows}
    ledger_ids = [row[0] for row in rows]
    duplicates = sorted({test_id for test_id in ledger_ids if ledger_ids.count(test_id) > 1})
    if duplicates:
        errors.append("TDD验收结果 ID 重复: " + ", ".join(duplicates))

    missing = sorted(set(contract_ids) - set(ledger_ids))
    extra = sorted(set(ledger_ids) - set(contract_ids))
    if missing:
        errors.append("TDD验收结果漏项: " + ", ".join(missing))
    if extra:
        errors.append("TDD验收结果包含契约外 ID: " + ", ".join(extra))

    for test_id, status_cell, action, evidence in rows:
        status = status_cell.strip().strip("`").lower()
        if status not in {"pending", "pass", "fail"}:
            errors.append(f"{test_id} 的状态非法: {status_cell}")
        elif status != "pass":
            errors.append(f"{test_id} 尚未通过: {status}")
        if invalid_detail(action):
            errors.append(f"{test_id} 缺少本轮实际验证动作")
        if invalid_detail(evidence):
            errors.append(f"{test_id} 缺少本轮验证证据")
        if test_id.startswith("DESIGN-") and test_id in contract_by_id:
            errors.extend(
                validate_design_result(
                    output,
                    test_id,
                    contract_by_id[test_id][2],
                    action,
                    evidence,
                )
            )

    return errors


def main() -> int:
    args = sys.argv[1:]
    validate_results = bool(args and args[0] == "--result")
    if validate_results:
        args = args[1:]
    if len(args) != 1:
        print("用法: py check_delivery_contract.py [--result] <项目/output>")
        return 2

    output = Path(args[0])
    contract_path = output / "tests" / "TDD验收契约.md"
    if not contract_path.is_file():
        print(f"❌ 文件不存在: {contract_path}")
        return 2

    contract = contract_path.read_text(encoding="utf-8")
    errors: list[str] = []
    warnings: list[str] = []

    for section in REQUIRED_SECTIONS:
        if section not in contract:
            errors.append(f"契约缺少章节: {section}")

    source_contract = field(contract, "source_contract")
    work_type = field(contract, "work_type")
    if source_contract not in {"requirements.md", "bugfix.md"}:
        errors.append("source_contract 必须为 requirements.md|bugfix.md")
    if work_type not in {"feature", "bugfix"}:
        errors.append("work_type 必须为 feature|bugfix")
    if (source_contract == "requirements.md") != (work_type == "feature"):
        errors.append("work_type 与 source_contract 不一致")

    source_path = output / source_contract if source_contract else output / "requirements.md"
    design_trace_path = output / "设计追溯矩阵.md"
    for path in (source_path, design_trace_path):
        if not path.is_file():
            errors.append(f"文件不存在: {path}")
    if errors:
        print(f"❌ 精简 TDD 契约校验失败（{len(errors)}）")
        for error in errors:
            print(f"  - {error}")
        return 2

    source_text = source_path.read_text(encoding="utf-8")
    all_sources = set(source_blocks(source_text))
    required = required_sources(source_text, work_type or "feature")
    design_trace = design_trace_path.read_text(encoding="utf-8")
    known_design_ids = set(DESIGN_ID_RE.findall(design_trace))

    page_specs: dict[str, tuple[str, str, str]] = {}
    if work_type == "feature":
        page_list_path = output / "页面清单.md"
        if not page_list_path.is_file():
            errors.append(f"文件不存在: {page_list_path}")
        else:
            page_specs = mvp_page_specs(page_list_path.read_text(encoding="utf-8"))
            known_design_ids.update(page_specs)

    rows = acceptance_rows(contract)
    if not rows:
        errors.append("契约没有合法验收行")

    ids = [row[0] for row in rows]
    duplicates = sorted({test_id for test_id in ids if ids.count(test_id) > 1})
    if duplicates:
        errors.append("验收 ID 重复: " + ", ".join(duplicates))

    covered_sources: set[str] = set()
    covered_pages: set[str] = set()
    resolved_pages: set[str] = set()
    for row in rows:
        test_id, source_cell, design_cell, scenario, expected, method = row
        row_sources = set(SOURCE_ID_RE.findall(source_cell))
        row_design_ids = set(DESIGN_ID_RE.findall(design_cell))
        covered_sources.update(row_sources)
        if test_id.startswith("DESIGN-"):
            row_pages = set(PAGE_ID_RE.findall(design_cell))
            covered_pages.update(row_pages)
            if len(row_pages) != 1:
                errors.append(f"{test_id} 必须且只能对应一个 PAGE ID")
            anchor_fields = structured_fields(expected)
            missing_anchors = [
                anchor
                for anchor in FIDELITY_ANCHORS
                if invalid_detail(anchor_fields.get(anchor, ""))
            ]
            if missing_anchors:
                errors.append(
                    f"{test_id} 的通过标准缺少具体视觉锚点: {', '.join(missing_anchors)}"
                )
            if "截图" not in method or "独立" not in method:
                errors.append(f"{test_id} 的验证方式必须包含同状态截图对和独立视觉复核")
            explicit_paths = artifact_paths(design_cell)
            for page_id in sorted(row_pages - resolved_pages):
                if page_id not in page_specs:
                    continue
                stage, module, page_name = page_specs[page_id]
                md_path, md_error = select_page_artifact(
                    output, explicit_paths, ".md", page_id, page_name
                )
                html_path, html_error = select_page_artifact(
                    output, explicit_paths, ".html", page_id, page_name
                )
                if md_error:
                    errors.append(f"{test_id}: {md_error}")
                if html_error:
                    errors.append(f"{test_id}: {html_error}")
                if md_path is None or html_path is None:
                    continue

                resolved_pages.add(page_id)
                md_relative = md_path.relative_to(output)
                html_relative = html_path.relative_to(output)
                if md_relative not in explicit_paths or html_relative not in explicit_paths:
                    warnings.append(
                        f"{test_id} 未准确记录 {page_id} 的实际 MD/HTML 路径；"
                        f"已按内容唯一匹配为 {md_relative} + {html_relative}"
                    )

                canonical_stem = canonical_page_stem(stage, module, page_name)
                canonical_pair = (
                    md_relative.parent == Path("pages")
                    and html_relative.parent == Path("pages")
                    and md_relative.stem == html_relative.stem == canonical_stem
                )
                if not canonical_pair:
                    warnings.append(
                        f"{page_id} 页面产物命名/目录不规范，但内容身份唯一，继续使用实际路径："
                        f"{md_relative} + {html_relative}"
                    )

        for source_id in row_sources - all_sources:
            errors.append(f"{test_id} 引用未知 Source ID: {source_id}")
        for design_id in row_design_ids - known_design_ids:
            errors.append(f"{test_id} 引用未出现在设计产物中的 Design ID: {design_id}")

        if not test_id.startswith("SMOKE-") and not row_sources and "design-derived" not in source_cell:
            errors.append(f"{test_id} 缺少 Source ID 或 design-derived 来源")
        if test_id.startswith("DESIGN-") and not PAGE_ID_RE.search(design_cell):
            errors.append(f"{test_id} 缺少 PAGE ID")
        for label, value in (("场景与操作", scenario), ("可观察通过标准", expected), ("验证方式", method)):
            if invalid_detail(value):
                errors.append(f"{test_id} 的{label}为空或仍是占位内容")
        if invalid_detail(design_cell, allow_dash=test_id.startswith("SMOKE-")):
            errors.append(f"{test_id} 的 Design IDs/产物为空或仍是占位内容")

    if not any(test_id.startswith("SMOKE-") for test_id in ids):
        errors.append("缺少 SMOKE 冒烟门禁")
    if work_type == "feature" and not any(test_id.startswith("FLOW-") for test_id in ids):
        errors.append("Feature 缺少 FLOW 核心用户旅程")
    if work_type == "bugfix":
        for prefix, label in (("BUG-REPRO-", "稳定复现"), ("BUG-FIX-", "修复结果"), ("BUG-REG-", "关键回归")):
            if not any(test_id.startswith(prefix) for test_id in ids):
                errors.append(f"Bugfix 缺少{label}验收")

    for source_id in sorted(required - covered_sources):
        errors.append(f"required Source 未被验收覆盖: {source_id}")
    for page_id in sorted(set(page_specs) - covered_pages):
        errors.append(f"MVP 页面未进入 DESIGN 验收: {page_id}")

    behavior_count = sum(
        test_id.startswith(("FLOW-", "RULE-", "BUG-")) for test_id in ids
    )
    if behavior_count > 25:
        warnings.append(f"行为/风险验收共 {behavior_count} 条，超过默认 25 条；请确认已完成合并去重审查")

    result_path = output / "tests" / "TDD验收结果.md"
    if validate_results:
        if not result_path.is_file():
            errors.append(f"文件不存在: {result_path}")
        else:
            errors.extend(validate_result_ledger(output, result_path, contract_path, rows))

    if errors:
        print(f"❌ 精简 TDD 契约校验失败（{len(errors)}）")
        for error in errors:
            print(f"  - {error}")
        for warning in warnings:
            print(f"  ⚠️ {warning}")
        return 2

    for warning in warnings:
        print(f"⚠️ {warning}")
    result_summary = " / execution ledger all pass" if validate_results else ""
    print(
        "✅ 精简 TDD 契约校验通过："
        f"{len(required)} required source / {len(page_specs)} MVP pages / {len(rows)} acceptance rows"
        f"{result_summary}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
