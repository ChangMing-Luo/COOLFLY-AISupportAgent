#!/usr/bin/env python3
"""
check_executability.py - PRD 可执行性自检

目的：验证 PRD 写完后，AI 编码助手（Claude Code / Codex / Cursor）能不能据此写代码。

做法：扫描 PRD 找以下"AI 编码助手能直接用"的关键信号：
1. 有明确的功能列表（FR-N）+ 每个 FR 描述足够详细（不是一句话）
2. 有数据模型 / Schema 描述（哪怕是字段含义级，不是 SQL 类型）
3. 有 API 契约 或 模块边界描述
4. 有验收标准（AC）能转测试
5. 有技术栈建议或限制
6. 有边界 / 异常场景描述

打分：每类 0-100 分，总分 600 分。
- 总分 >= 480 (80%)：✅ PRD 适合直接给 AI 编码助手
- 总分 360-480 (60-80%)：⚠️ 有缺失，建议补完关键部分再开工
- 总分 < 360 (60%)：❌ 还不能给 AI 写代码，需要补充开发版

用法：
  py check_executability.py path/to/PRD.md
"""
import re
import sys
from pathlib import Path


def score_fr_detail(text: str) -> tuple[int, str]:
    """检查 FR 是否详细。每个 FR 至少有 100 字描述算 5 分，最多 25 个 FR 计分。"""
    fr_blocks = re.findall(
        r"FR[-_]?\d+[:：.\s]([^\n]+(?:\n(?!FR[-_]?\d|##|\Z)[^\n]*)*)",
        text,
    )
    detailed_count = sum(1 for fr in fr_blocks if len(fr) > 100)
    total_count = len(fr_blocks)
    if total_count == 0:
        return 0, "❌ 没有发现 FR-N 格式的功能编号"
    score = min(100, int(100 * detailed_count / max(total_count, 1)))
    return (
        score,
        f"{'✅' if score >= 80 else '⚠️'} 共 {total_count} 个 FR，其中 {detailed_count} 个有 >100 字详细描述（{score}%）",
    )


def score_data_model(text: str) -> tuple[int, str]:
    """检查是否有数据模型描述。"""
    signals = {
        "ER 图（Mermaid erDiagram）": bool(re.search(r"erDiagram", text)),
        "实体描述（表格 / 字段列表）": bool(
            re.search(r"\|\s*(字段|field|属性)\s*\|", text, re.IGNORECASE)
        ),
        "关系/外键说明": bool(re.search(r"(外键|FK|关联|relation)", text, re.IGNORECASE)),
        "数据治理（时区/PII/一致性）": bool(
            re.search(r"(时区|UTC|PII|一致性)", text)
        ),
    }
    found = sum(signals.values())
    score = int(100 * found / len(signals))
    detail = ", ".join(f"{k}✓" if v else f"{k}✗" for k, v in signals.items())
    return score, f"{'✅' if score >= 75 else '⚠️'} {detail}"


def score_api_or_module(text: str) -> tuple[int, str]:
    """检查是否有 API 契约或模块边界描述。"""
    signals = {
        "模块/组件划分": bool(re.search(r"(模块|组件|module|component)", text, re.IGNORECASE)),
        "接口/契约描述": bool(re.search(r"(接口|契约|interface|contract|API)", text, re.IGNORECASE)),
        "依赖关系（外部 API / 库）": bool(
            re.search(r"(外部依赖|第三方|SDK|依赖)", text)
        ),
        "数据流/时序图": bool(re.search(r"(sequenceDiagram|flowchart)", text)),
    }
    found = sum(signals.values())
    score = int(100 * found / len(signals))
    detail = ", ".join(f"{k}✓" if v else f"{k}✗" for k, v in signals.items())
    return score, f"{'✅' if score >= 75 else '⚠️'} {detail}"


def score_acceptance(text: str) -> tuple[int, str]:
    """检查 AC 数量和详细度。"""
    ac_blocks = re.findall(r"AC[-_]?\d+", text)
    ac_table_rows = len(re.findall(r"\|\s*AC[-_]?\d+", text))
    has_test_priority = bool(re.search(r"(P0|P1|P2|主流程|异常|回归)", text))
    has_test_data = bool(re.search(r"(测试数据|fixture|mock)", text, re.IGNORECASE))

    if not ac_blocks:
        return 0, "❌ 没发现 AC-N 验收标准"

    ac_count = len(set(ac_blocks))
    score = 0
    if ac_count >= 10: score += 40
    elif ac_count >= 5: score += 25
    else: score += 10
    if ac_table_rows >= 10: score += 20
    if has_test_priority: score += 20
    if has_test_data: score += 20

    return min(score, 100), (
        f"{'✅' if score >= 75 else '⚠️'} {ac_count} 个 AC，"
        f"{'表格化' if ac_table_rows >= 10 else '未表格化'}，"
        f"{'有' if has_test_priority else '无'}优先级，"
        f"{'有' if has_test_data else '无'}测试数据"
    )


def score_tech_stack(text: str) -> tuple[int, str]:
    """检查是否有技术栈建议。"""
    signals = {
        "后端语言/框架建议": bool(
            re.search(r"(后端|backend|Python|Node|Go|Java|FastAPI|Django|Express)", text, re.IGNORECASE)
        ),
        "前端框架建议": bool(
            re.search(r"(前端|frontend|React|Vue|Svelte|Next|UI 框架)", text, re.IGNORECASE)
        ),
        "数据库建议": bool(
            re.search(r"(数据库|Postgres|MySQL|SQLite|MongoDB|Redis)", text, re.IGNORECASE)
        ),
        "核心算法库/求解器": bool(
            re.search(r"(求解器|算法库|sklearn|XGBoost|Prophet|CP-SAT|Gurobi|TensorFlow|PyTorch)", text, re.IGNORECASE)
        ),
        "部署/基础设施": bool(
            re.search(r"(部署|deploy|Docker|K8s|cron|调度)", text, re.IGNORECASE)
        ),
    }
    found = sum(signals.values())
    score = int(100 * found / len(signals))
    detail = ", ".join(f"{k}✓" if v else f"{k}✗" for k, v in signals.items())
    return score, f"{'✅' if score >= 60 else '⚠️'} {detail}"


def score_boundary_exception(text: str) -> tuple[int, str]:
    """检查边界 / 异常场景的完整性。"""
    signals = {
        "数据边界（空/超大/异常）": bool(
            re.search(r"(空数据|超大|异常数据|边界|boundary)", text, re.IGNORECASE)
        ),
        "并发冲突": bool(
            re.search(r"(并发|concurrent|乐观锁|版本号|race condition)", text, re.IGNORECASE)
        ),
        "第三方依赖失败": bool(
            re.search(r"(第三方失败|降级|fallback|超时|重试|circuit breaker)", text, re.IGNORECASE)
        ),
        "平台/设备差异": bool(
            re.search(r"(兼容|平台差异|浏览器|设备|iOS|Android)", text, re.IGNORECASE)
        ),
        "极端情况": bool(
            re.search(r"(极端|宕机|磁盘|内存|崩溃)", text, re.IGNORECASE)
        ),
    }
    found = sum(signals.values())
    score = int(100 * found / len(signals))
    detail = ", ".join(f"{k}✓" if v else f"{k}✗" for k, v in signals.items())
    return score, f"{'✅' if score >= 75 else '⚠️'} {detail}"


def main():
    if len(sys.argv) < 2:
        print("用法: py check_executability.py <PRD.md 文件路径>")
        sys.exit(2)

    file_path = Path(sys.argv[1])
    if not file_path.exists():
        print(f"❌ 文件不存在: {file_path}")
        sys.exit(2)

    text = file_path.read_text(encoding="utf-8", errors="replace")
    print(f"\n=== 可执行性自检: {file_path.name} ===\n")
    print(f"📄 PRD 总行数: {len(text.splitlines())}")
    print()

    categories = [
        ("FR 详细度", score_fr_detail),
        ("数据模型", score_data_model),
        ("API/模块边界", score_api_or_module),
        ("验收标准", score_acceptance),
        ("技术栈建议", score_tech_stack),
        ("边界/异常", score_boundary_exception),
    ]

    total = 0
    for name, fn in categories:
        score, detail = fn(text)
        total += score
        print(f"📊 [{score:3d}/100] {name}")
        print(f"     {detail}\n")

    pct = total / (100 * len(categories)) * 100
    print(f"=== 总分: {total}/600 ({pct:.0f}%) ===\n")

    if pct >= 80:
        print("✅ PRD 适合直接给 AI 编码助手开工")
        sys.exit(0)
    elif pct >= 60:
        print("⚠️  PRD 有缺失，建议补完关键部分后再开工")
        print("    优先补：得分 < 60 的类别")
        sys.exit(1)
    else:
        print("❌ PRD 还不能直接给 AI 写代码")
        print("    建议：先做 PRD-dev.md 浓缩开发版 + 补充缺失类别")
        sys.exit(2)


if __name__ == "__main__":
    main()
