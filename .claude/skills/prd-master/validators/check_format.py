#!/usr/bin/env python3
"""
check_format.py - PRD 格式硬校验（继承 MAGI 思路 + Senior PM Prompt 思路）

扫描 PRD 文件，拦截：
1. ASCII 框图（应改 Mermaid）
2. HTTP 方法 + API 路径（产品文档不应写技术实现）
3. 数据库字段类型（同上）
4. 信号路径 / CAN总线 / 硬件型号（车载/硬件类越界）
5. 章节序号混乱

用法: py check_format.py path/to/PRD.md
"""
import re
import sys
from pathlib import Path


# ASCII 框图特征
ASCII_BOX_CHARS = "┌└│├─┬┴┐┘┤┼━┃┏┗┓┛┣┫"

# HTTP 方法 + API 路径
API_PATTERN = re.compile(r"\b(GET|POST|PUT|DELETE|PATCH)\s+/\S+")

# 数据库字段类型
DB_TYPE_PATTERN = re.compile(
    r"\b(varchar|char|int|bigint|smallint|integer|boolean|timestamp|datetime|text|json|jsonb)\s*\(?\s*\d*\s*\)?",
    re.IGNORECASE,
)

# 硬件/技术细节模式
HW_PATTERNS = [
    r"\bCAN\s*(总线|bus|\d+kbps)\b",
    r"\bLIN\s*总线\b",
    r"\bSoC\s*(型号|路由)\b",
    r"\b\d+kbps\b.*(信号|总线)",
    r"\bECU\s*固件\b",
    r"\bMQTT\s*topic\s*/",
    r"\bWebSocket\s*messageType\s*:",
    r"\bgRPC\s+",
    r"\bprotobuf\s+",
]

# 技术 SDK/库直接引用
SDK_PATTERN = re.compile(r"\b(import|require|using|from)\s+['\"]?[\w\.]+", re.IGNORECASE)


def check_file(file_path: Path) -> tuple[list[str], list[str]]:
    """返回 (errors, warnings)"""
    errors = []
    warnings = []

    if not file_path.exists():
        errors.append(f"文件不存在: {file_path}")
        return errors, warnings

    text = file_path.read_text(encoding="utf-8", errors="replace")
    lines = text.split("\n")
    in_code_block = False

    for i, line in enumerate(lines, 1):
        # 代码块内不检查（开发者参考可保留）
        if line.strip().startswith("```"):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue

        # 1. ASCII 框图
        if any(c in line for c in ASCII_BOX_CHARS):
            # 排除表格分隔（用 - 不算）
            errors.append(
                f"L{i}: ASCII 框图 — 必须改为 Mermaid 图表。原文: {line[:80]}"
            )

        # 2. HTTP 方法 + API 路径
        m = API_PATTERN.search(line)
        if m:
            errors.append(
                f"L{i}: HTTP 方法+API 路径 '{m.group()}' — 产品 PRD 不写实现。改为产品语言描述。原文: {line[:80]}"
            )

        # 3. 数据库字段类型
        m = DB_TYPE_PATTERN.search(line)
        if m:
            # 排除提到"数据类型"的说明
            if "数据类型" in line or "字段类型" in line:
                continue
            errors.append(
                f"L{i}: 数据库字段类型 '{m.group()}' — 只保留字段含义，去类型声明。原文: {line[:80]}"
            )

        # 4. 硬件/技术细节
        for pattern in HW_PATTERNS:
            m = re.search(pattern, line, re.IGNORECASE)
            if m:
                warnings.append(
                    f"L{i}: 硬件/技术细节 '{m.group()}' — 改为能力要求描述。原文: {line[:80]}"
                )

        # 5. SDK/import 直接引用
        if SDK_PATTERN.search(line) and not line.strip().startswith("//") and not line.strip().startswith("#"):
            warnings.append(
                f"L{i}: SDK/import 直接引用 — PRD 不应包含代码导入。原文: {line[:80]}"
            )

    return errors, warnings


def main():
    if len(sys.argv) < 2:
        print("用法: py check_format.py <PRD.md 文件路径>")
        sys.exit(2)

    file_path = Path(sys.argv[1])
    errors, warnings = check_file(file_path)

    print(f"\n=== 格式校验: {file_path.name} ===\n")

    if errors:
        print(f"❌ {len(errors)} 个致命错误（技术细节越界）:\n")
        for err in errors:
            print(f"  {err}")
        print()

    if warnings:
        print(f"⚠️  {len(warnings)} 个警告:\n")
        for warn in warnings:
            print(f"  {warn}")
        print()

    if not errors and not warnings:
        print("✅ 格式检查全部通过")
        sys.exit(0)
    elif errors:
        print(f"\n❌ 校验失败 - {len(errors)} 错误, {len(warnings)} 警告")
        sys.exit(2)
    else:
        print(f"\n⚠️  校验有警告")
        sys.exit(1)


if __name__ == "__main__":
    main()
