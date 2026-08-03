#!/usr/bin/env python3
"""Validate feature requirements.md or bugfix.md contracts."""

from __future__ import annotations

import re
import sys
from pathlib import Path


HEADING_ID = re.compile(
    r"^###\s+((?:US-F\d{2,3}-\d{2,3}|REQ-F\d{2,3}-\d{2,3}|AC-F\d{2,3}-\d{2,3}|NFR-\d{3}|BUG-\d{3}|REPRO-\d{3}|CUR-\d{3}|EXP-\d{3}|UNCH-\d{3}|CON-\d{3}))\b",
    re.MULTILINE,
)
EXTERNAL_CONFIGURATION_SECTION = "## External capability configuration"
CAPABILITY_PREREQUISITES_SECTION = "## Capability prerequisites"
PRODUCT_CONFIGURATION_SURFACES = {"onboarding", "settings", "admin"}
CONFIGURATION_SURFACES = PRODUCT_CONFIGURATION_SURFACES | {
    "deployment-secret",
    "none",
}
CONFIGURATION_SCOPES = {"system", "tenant", "user", "project", "none"}
REQ_ID_RE = re.compile(r"REQ-F\d{2,3}-\d{2,3}")
EXTERNAL_CAPABILITY_SIGNAL_RE = re.compile(
    r"\bLLM\b|大模型|OpenAI|Anthropic|Claude|DeepSeek|Qwen|Gemini|"
    r"API[\s_-]*Key|外部\s*(?:API|服务)|第三方\s*(?:API|服务)|"
    r"支付网关|短信(?:服务|验证码|通道)|邮件(?:服务|验证码|发送通道)|地图服务|对象存储",
    re.IGNORECASE,
)
CAPABILITY_PREREQUISITE_SIGNAL_RE = re.compile(
    EXTERNAL_CAPABILITY_SIGNAL_RE.pattern
    + r"|第三方登录|OAuth|微信登录|Apple\s*登录|邮箱验证码|邮件登录链接|"
    r"App\s*Store|TestFlight|Google\s*Play|"
    r"(?:iOS|Android|安卓).{0,20}(?:发布|上架|分发)|"
    r"(?:发布|上架|分发).{0,20}(?:iOS|Android|安卓)|"
    r"推送证书|APNs|FCM|行业资质|硬件设备",
    re.IGNORECASE,
)
PREREQUISITE_STATUSES = {"ready", "committed"}
PREREQUISITE_ROW_RULES = (
    (
        "短信通道",
        re.compile(r"短信(?:验证码|服务|通道)|手机.{0,8}验证码", re.IGNORECASE),
        re.compile(r"短信|SMS", re.IGNORECASE),
    ),
    (
        "iOS 分发账号/签名",
        re.compile(
            r"App\s*Store|TestFlight|"
            r"iOS.{0,20}(?:发布|上架|分发)|"
            r"(?:发布|上架|分发).{0,20}iOS",
            re.IGNORECASE,
        ),
        re.compile(r"Apple|iOS|App\s*Store|开发者账号|签名|证书", re.IGNORECASE),
    ),
)


def blocks(text: str) -> dict[str, str]:
    matches = list(HEADING_ID.finditer(text))
    result: dict[str, str] = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        identifier = match.group(1)
        if identifier in result:
            raise ValueError(f"重复定义 ID: {identifier}")
        result[identifier] = text[match.start():end]
    return result


def external_configuration_rows(text: str) -> list[list[str]]:
    if EXTERNAL_CONFIGURATION_SECTION not in text:
        return []
    section = text.split(EXTERNAL_CONFIGURATION_SECTION, 1)[1]
    section = re.split(r"\n##\s+", section, maxsplit=1)[0]
    rows: list[list[str]] = []
    for line in section.splitlines():
        if not line.startswith("|"):
            continue
        cells = [cell.strip().strip("`") for cell in line.strip().strip("|").split("|")]
        if (
            len(cells) == 8
            and cells[0] != "Capability"
            and not all(re.fullmatch(r":?-+:?", cell) for cell in cells)
        ):
            rows.append(cells)
    return rows


def capability_prerequisite_rows(text: str) -> list[list[str]]:
    if CAPABILITY_PREREQUISITES_SECTION not in text:
        return []
    section = text.split(CAPABILITY_PREREQUISITES_SECTION, 1)[1]
    section = re.split(r"\n##\s+", section, maxsplit=1)[0]
    rows: list[list[str]] = []
    for line in section.splitlines():
        if not line.startswith("|"):
            continue
        cells = [cell.strip().strip("`") for cell in line.strip().strip("|").split("|")]
        if (
            len(cells) == 7
            and cells[0] != "Prerequisite"
            and not all(re.fullmatch(r":?-+:?", cell) for cell in cells)
        ):
            rows.append(cells)
    return rows


def without_section(text: str, heading: str) -> str:
    if heading not in text:
        return text
    before, after = text.split(heading, 1)
    following = re.search(r"\n##\s+", after)
    return before + (after[following.start():] if following else "")


def validate_external_configuration(
    text: str,
    reqs: set[str],
    errors: list[str],
) -> None:
    if EXTERNAL_CONFIGURATION_SECTION not in text:
        errors.append("缺少 External capability configuration 外部能力配置责任表")
        return

    rows = external_configuration_rows(text)
    if not rows:
        errors.append("External capability configuration 没有合法责任行")
        return

    none_rows = [row for row in rows if row[0].lower() == "none"]
    if none_rows:
        if len(rows) != 1 or none_rows[0][1:] != ["-"] * 7:
            errors.append("没有外部能力时只能保留一行 none，其他列必须为 -")
        signal_text = without_section(text, EXTERNAL_CONFIGURATION_SECTION)
        signal = EXTERNAL_CAPABILITY_SIGNAL_RE.search(signal_text)
        if signal:
            errors.append(
                f"正文出现外部能力信号“{signal.group(0)}”，配置责任不能填写 none"
            )
        return

    for capability, owner, actor, surface, scope, lifecycle, stage, requirement_cell in rows:
        label = f"外部能力 {capability}"
        for field_name, value in (
            ("Credential owner", owner),
            ("Configuration actor", actor),
            ("Surface", surface),
            ("Scope", scope),
            ("Lifecycle", lifecycle),
            ("Stage", stage),
        ):
            if not value or value == "-":
                errors.append(f"{label} 缺少 {field_name}")
        if surface not in CONFIGURATION_SURFACES:
            errors.append(
                f"{label} 的 Surface 非法: {surface}；"
                "只允许 deployment-secret/onboarding/settings/admin/none"
            )
        if scope not in CONFIGURATION_SCOPES:
            errors.append(
                f"{label} 的 Scope 非法: {scope}；"
                "只允许 system/tenant/user/project/none"
            )

        requirement_ids = set(REQ_ID_RE.findall(requirement_cell))
        for requirement_id in sorted(requirement_ids - reqs):
            errors.append(f"{label} 引用未定义需求 {requirement_id}")
        if surface in PRODUCT_CONFIGURATION_SURFACES and not requirement_ids:
            errors.append(
                f"{label} 通过 {surface} 配置，必须关联至少一个真实 REQ"
            )


def validate_capability_prerequisites(
    text: str,
    reqs: set[str],
    errors: list[str],
) -> None:
    if CAPABILITY_PREREQUISITES_SECTION not in text:
        errors.append("缺少 Capability prerequisites 方案前置能力表")
        return

    rows = capability_prerequisite_rows(text)
    if not rows:
        errors.append("Capability prerequisites 没有合法责任行")
        return

    none_rows = [row for row in rows if row[0].lower() == "none"]
    if none_rows:
        if len(rows) != 1 or none_rows[0][1:] != ["-"] * 6:
            errors.append("没有方案前置能力时只能保留一行 none，其他列必须为 -")
        signal_text = without_section(text, CAPABILITY_PREREQUISITES_SECTION)
        signal = CAPABILITY_PREREQUISITE_SIGNAL_RE.search(signal_text)
        if signal:
            errors.append(
                f"正文出现方案前置能力信号“{signal.group(0)}”，前置能力不能填写 none"
            )
        return

    for prerequisite, status, owner, evidence, fallback, stage, requirement_cell in rows:
        label = f"方案前置能力 {prerequisite}"
        if status not in PREREQUISITE_STATUSES:
            errors.append(
                f"{label} 的 Status 非法: {status}；只允许 ready/committed"
            )
        for field_name, value in (
            ("Owner", owner),
            ("Evidence or deadline", evidence),
            ("Fallback", fallback),
            ("Stage", stage),
        ):
            if not value or value == "-":
                errors.append(f"{label} 缺少 {field_name}")

        requirement_ids = set(REQ_ID_RE.findall(requirement_cell))
        if not requirement_ids:
            errors.append(f"{label} 必须关联至少一个真实 REQ")
        for requirement_id in sorted(requirement_ids - reqs):
            errors.append(f"{label} 引用未定义需求 {requirement_id}")

    signal_text = without_section(text, CAPABILITY_PREREQUISITES_SECTION)
    prerequisite_names = "\n".join(row[0] for row in rows)
    for label, signal_re, prerequisite_re in PREREQUISITE_ROW_RULES:
        if signal_re.search(signal_text) and not prerequisite_re.search(prerequisite_names):
            errors.append(f"正文依赖{label}，但方案前置能力表没有对应行")


def validate_feature(text: str, items: dict[str, str], errors: list[str]) -> None:
    stories = {key for key in items if key.startswith("US-")}
    reqs = {key for key in items if key.startswith("REQ-")}
    acs = {key for key in items if key.startswith("AC-")}
    if not stories:
        errors.append("缺少 US 用户故事定义")
    if not reqs:
        errors.append("缺少 REQ 定义")
    if not acs:
        errors.append("缺少 AC 定义")

    for story in sorted(stories):
        role = re.search(r"^- Role:\s*(.+?)\s*$", items[story], re.MULTILINE)
        if not role or not role.group(1).strip() or role.group(1).strip() == "-":
            errors.append(f"{story} 缺少有效 Role")

    for req in sorted(reqs):
        story = re.search(
            r"^- Story:\s*(US-F\d{2,3}-\d{2,3})\s*$",
            items[req],
            re.MULTILINE,
        )
        if not story:
            errors.append(f"{req} 缺少合法 Story")
        elif story.group(1) not in stories:
            errors.append(f"{req} 引用未定义用户故事 {story.group(1)}")

    referenced_reqs: set[str] = set()
    for ac in sorted(acs):
        block = items[ac]
        parent = re.search(r"^- Parent:\s*(REQ-F\d{2,3}-\d{2,3})\s*$", block, re.MULTILINE)
        if not parent:
            errors.append(f"{ac} 缺少合法 Parent")
        else:
            referenced_reqs.add(parent.group(1))
            if parent.group(1) not in reqs:
                errors.append(f"{ac} 引用未定义需求 {parent.group(1)}")
        if not re.search(r"\bWHEN\b.+\bTHE SYSTEM SHALL\b", block, re.DOTALL):
            errors.append(f"{ac} 缺少 WHEN ... THE SYSTEM SHALL ... EARS 行为")

    for req in sorted(reqs - referenced_reqs):
        errors.append(f"{req} 没有任何 AC 覆盖")
    validate_external_configuration(text, reqs, errors)
    validate_capability_prerequisites(text, reqs, errors)


def validate_bugfix(items: dict[str, str], errors: list[str]) -> None:
    for prefix in ("BUG-", "REPRO-", "CUR-", "EXP-", "UNCH-", "CON-"):
        if not any(key.startswith(prefix) for key in items):
            errors.append(f"缺少 {prefix[:-1]} 定义")
    for key, block in items.items():
        if key.startswith("EXP-") and "THE SYSTEM SHALL" not in block:
            errors.append(f"{key} 缺少 THE SYSTEM SHALL")
        if key.startswith("UNCH-") and "THE SYSTEM SHALL CONTINUE TO" not in block:
            errors.append(f"{key} 缺少 THE SYSTEM SHALL CONTINUE TO")


def main() -> int:
    if len(sys.argv) not in (2, 3):
        print("用法: py check_requirements_contract.py <requirements.md|bugfix.md> [requirements-analysis.md]")
        return 2

    contract = Path(sys.argv[1])
    if not contract.is_file():
        print(f"❌ 文件不存在: {contract}")
        return 2

    text = contract.read_text(encoding="utf-8")
    errors: list[str] = []
    try:
        items = blocks(text)
    except ValueError as exc:
        errors.append(str(exc))
        items = {}

    work_type = "bugfix" if re.search(r"work_type:\s*bugfix", text) else "feature"
    if work_type == "bugfix":
        validate_bugfix(items, errors)
    else:
        validate_feature(text, items, errors)
        if len(sys.argv) != 3:
            errors.append("Feature 契约必须同时提供 requirements-analysis.md")
        else:
            analysis = Path(sys.argv[2])
            if not analysis.is_file():
                errors.append(f"分析文件不存在: {analysis}")
            else:
                analysis_text = analysis.read_text(encoding="utf-8")
                for label in ("P0 unresolved: 0", "P1 unresolved: 0"):
                    if label not in analysis_text:
                        errors.append(f"正确性分析未清零或缺少汇总: {label}")

    if errors:
        print(f"❌ 需求契约校验失败（{len(errors)}）")
        for error in errors:
            print(f"  - {error}")
        return 2

    print(f"✅ 需求契约校验通过：{work_type}，稳定对象 {len(items)} 个")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
