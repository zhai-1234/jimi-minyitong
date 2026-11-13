#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""基米民易通 RAG 评测脚本（仅依赖 Python 标准库）。

对标注好的测试集逐题调用 Dify 对话接口，计算：
  - 关键词要点召回率（答案是否覆盖应有的政策要点）
  - 引用来源命中率（检索结果是否命中应引用政策文档）
  - 拒答正确率（超纲问题是否正确拒答/引导）
  - 延迟（平均 / P95）与 token 消耗

输出：results/<label>/results.csv、summary.json、report.md

用法：
  # 演示模式（不调用 Dify，使用 mock/responses.json 中的模拟回答）
  python run_eval.py --mode mock --label demo

  # 真实评测
  set DIFY_API_KEY=app-xxx
  set DIFY_API_BASE=http://your-dify-host/v1
  python run_eval.py --mode real --label baseline
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 超纲问题的“正确拒答”标志词：出现任意一个即视为正确引导
REFUSAL_MARKERS = [
    "无法", "不能", "抱歉", "不好意思", "超出", "不属于", "不在",
    "仅能", "只能", "建议", "咨询", "民政", "12345", "社会救助", "救助政策"
]

CATEGORY_NAMES = {
    "single_policy": "单政策查询",
    "multi_policy": "多政策交叉",
    "colloquial": "口语化表述",
    "cantonese": "粤语问法",
    "out_of_scope": "超纲/闲聊",
    "edge_case": "边界情形",
}


def normalize(text):
    """统一大小写并去掉空白，避免格式差异影响关键词匹配。"""
    return re.sub(r"\s+", "", text or "").lower()


def load_dataset(path, limit=None):
    items = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            items.append(json.loads(line))
            if limit and len(items) >= limit:
                break
    return items


def load_mock(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def call_dify(question, cfg):
    """以 blocking 模式调用 Dify 对话接口，返回答案、引用来源与 token 用量。"""
    payload = {
        "inputs": {},
        "query": question,
        "response_mode": "blocking",
        "conversation_id": "",
        "user": cfg["user"],
    }
    req = urllib.request.Request(
        cfg["api_base"].rstrip("/") + "/chat-messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + cfg["api_key"],
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=cfg["timeout"]) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    metadata = data.get("metadata") or {}
    usage = metadata.get("usage") or {}
    return {
        "answer": data.get("answer") or "",
        "sources": metadata.get("retriever_resources") or [],
        "tokens": usage.get("total_tokens"),
    }


def score(item, result):
    """按标注计算单题指标。"""
    answer_norm = normalize(result["answer"])

    keyword_groups = item.get("expected_keywords") or []
    if keyword_groups:
        matched_groups = sum(
            1 for group in keyword_groups
            if any(normalize(kw) in answer_norm for kw in group)
        )
        keyword_recall = matched_groups / len(keyword_groups)
    else:
        keyword_recall = None

    doc_names = [normalize(s.get("document_name", "")) for s in result["sources"]]
    expected_sources = [normalize(s) for s in (item.get("expected_sources") or [])]
    matched_sources = [
        src for src in expected_sources
        if any(src in doc for doc in doc_names)
    ]
    if expected_sources and doc_names:
        source_hit = 1 if matched_sources else 0
        source_coverage = len(matched_sources) / len(expected_sources)
    else:
        # 接口未回传引用来源（如检索位于迭代子图内）时，来源指标不可用
        source_hit = None
        source_coverage = None

    # 代理指标：答案文本中是否提及应引用的政策文档
    source_text_hit = (
        (1 if any(src in answer_norm for src in expected_sources) else 0)
        if expected_sources else None
    )

    if item.get("should_refuse"):
        refusal_correct = 1 if any(m in answer_norm for m in REFUSAL_MARKERS) else 0
    else:
        refusal_correct = None

    return {
        "keyword_recall": keyword_recall,
        "source_hit": source_hit,
        "source_coverage": source_coverage,
        "source_text_hit": source_text_hit,
        "refusal_correct": refusal_correct,
    }


def mean_or_none(values):
    values = [v for v in values if v is not None]
    return round(sum(values) / len(values), 4) if values else None


def percentile(values, p):
    values = sorted(v for v in values if v is not None)
    if not values:
        return None
    idx = max(0, min(len(values) - 1, int(round(p / 100 * len(values) + 0.5)) - 1))
    return values[idx]


def evaluate(items, cfg):
    """逐题执行并计算指标；mock 模式下只评测 mock 文件中存在的题目。"""
    records = []
    mock = load_mock(cfg["mock_path"]) if cfg["mode"] == "mock" else None

    def run_one(item):
        if cfg["mode"] == "mock":
            entry = mock.get(item["id"])
            if entry is None:
                return None
            start = time.time()
            result = {
                "answer": entry.get("answer", ""),
                "sources": entry.get("sources", []),
                "tokens": entry.get("tokens"),
            }
            latency_ms = entry.get("latency_ms", int((time.time() - start) * 1000))
            error = ""
        else:
            start = time.time()
            try:
                result = call_dify(item["question"], cfg)
                error = ""
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError) as e:
                result = {"answer": "", "sources": [], "tokens": None}
                error = str(e)
            latency_ms = int((time.time() - start) * 1000)

        metrics = score(item, result)
        return {
            "id": item["id"],
            "category": item["category"],
            "question": item["question"],
            "answer": result["answer"],
            "error": error,
            "latency_ms": latency_ms,
            "tokens": result["tokens"] or None,
            "sources": [s.get("document_name", "") for s in result["sources"]],
            **metrics,
        }

    workers = cfg["workers"] if cfg["mode"] == "real" else 1
    if workers > 1:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            for record in pool.map(run_one, items):
                if record:
                    records.append(record)
    else:
        for item in items:
            record = run_one(item)
            if record:
                records.append(record)
    return records, len(items) - len(records)


def summarize(records):
    def block(rows):
        errors = sum(1 for r in rows if r["error"])
        return {
            "题目数": len(rows),
            "关键要点召回率": mean_or_none(r["keyword_recall"] for r in rows),
            "来源命中率": mean_or_none(r["source_hit"] for r in rows),
            "来源覆盖率": mean_or_none(r["source_coverage"] for r in rows),
            "来源提及率(代理)": mean_or_none(r["source_text_hit"] for r in rows),
            "拒答正确率": mean_or_none(r["refusal_correct"] for r in rows),
            "平均延迟ms": mean_or_none(r["latency_ms"] for r in rows),
            "P95延迟ms": percentile([r["latency_ms"] for r in rows], 95),
            "平均tokens": mean_or_none(r["tokens"] for r in rows),
            "调用失败数": errors,
        }

    categories = {}
    for r in records:
        categories.setdefault(r["category"], []).append(r)
    return {
        "overall": block(records),
        "by_category": {k: block(v) for k, v in sorted(categories.items())},
    }


def fmt(value, suffix=""):
    if value is None:
        return "-"
    if isinstance(value, float):
        return f"{value:.1%}" if 0 <= value <= 1 else f"{value:.1f}{suffix}"
    return f"{value}{suffix}"


def pct(value):
    return "-" if value is None else f"{value:.1%}"


def render_report(label, cfg, records, skipped, summary):
    lines = [f"# RAG 评测报告：{label}", ""]
    mode_note = "演示模式（mock，数据为模拟回答）" if cfg["mode"] == "mock" else "真实调用 Dify"
    lines += [
        f"- 评测时间：{time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"- 评测模式：{mode_note}",
        f"- 测试集：`{os.path.relpath(cfg['dataset'], BASE_DIR)}`"
        f"（共 {len(records) + skipped} 题，参与评测 {len(records)} 题，跳过 {skipped} 题）",
        f"- 接口：{cfg['api_base']}",
        "",
        "## 总览",
        "",
        "| 指标 | 数值 |",
        "| --- | --- |",
    ]
    overall = summary["overall"]
    labels = [
        ("关键要点召回率", pct(overall["关键要点召回率"])),
        ("来源命中率", pct(overall["来源命中率"])),
        ("来源覆盖率", pct(overall["来源覆盖率"])),
        ("来源提及率（代理指标）", pct(overall.get("来源提及率(代理)"))),
        ("拒答正确率", pct(overall["拒答正确率"])),
        ("平均延迟", fmt(overall["平均延迟ms"], " ms")),
        ("P95 延迟", fmt(overall["P95延迟ms"], " ms")),
        ("平均 token", fmt(overall["平均tokens"])),
        ("调用失败数", str(overall["调用失败数"])),
    ]
    for name, value in labels:
        lines.append(f"| {name} | {value} |")
    if overall["来源命中率"] is None:
        lines += [
            "",
            "> 注：本次运行中接口未回传引用来源（检索节点位于迭代子图内时 Dify 不传播 "
            "`retriever_resources`），因此「来源命中率/覆盖率」不可用；"
            "「来源提及率（代理指标）」改为在答案文本中匹配应引用政策文档名，仅供参考。",
        ]

    lines += ["", "## 分类指标", "",
              "| 类别 | 题数 | 要点召回率 | 来源命中率 | 来源提及率(代理) | 拒答正确率 | 平均延迟 | P95 延迟 |",
              "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    for name, block in summary["by_category"].items():
        lines.append(
            f"| {CATEGORY_NAMES.get(name, name)} | {block['题目数']} | {pct(block['关键要点召回率'])} | "
            f"{pct(block['来源命中率'])} | {pct(block.get('来源提及率(代理)'))} | "
            f"{pct(block['拒答正确率'])} | "
            f"{fmt(block['平均延迟ms'], ' ms')} | {fmt(block['P95延迟ms'], ' ms')} |"
        )

    failures = [
        r for r in records
        if r["error"]
        or (r["refusal_correct"] == 0)
        or (r["keyword_recall"] is not None and r["keyword_recall"] < 0.6)
    ]
    lines += ["", f"## 待改进样例（{len(failures)} 条）", ""]
    if not failures:
        lines.append("本次评测未发现明显失败样例。")
    for r in failures[:15]:
        reason = []
        if r["error"]:
            reason.append("调用失败：" + r["error"])
        if r["refusal_correct"] == 0:
            reason.append("超纲问题未正确拒答")
        if r["keyword_recall"] is not None and r["keyword_recall"] < 0.6:
            reason.append(f"要点召回 {pct(r['keyword_recall'])}")
        snippet = re.sub(r"\s+", " ", r["answer"])[:120]
        lines += [
            f"### {r['id']}（{CATEGORY_NAMES.get(r['category'], r['category'])}）{'；'.join(reason)}",
            f"- 问题：{r['question']}",
            f"- 回答摘录：{snippet or '（空）'}",
            "",
        ]

    lines += [
        "## 指标说明",
        "",
        "- **关键要点召回率**：答案覆盖标注要点组的比例（任一同义词命中即算该组命中）。",
        "- **来源命中率**：回答引用来源中是否命中至少一个应引用政策文档。",
        "- **来源覆盖率**：应引用文档被检索到的比例。",
        "- **拒答正确率**：超纲问题是否给出拒答或引导至民政部门/12345。",
        "",
        "> 规则匹配存在局限，建议结合人工抽检；同一测试集上对比不同检索配置，"
        "指标的相对变化比绝对值更有参考意义。",
    ]
    return "\n".join(lines) + "\n"


def write_outputs(out_dir, records, summary, report):
    os.makedirs(out_dir, exist_ok=True)
    csv_path = os.path.join(out_dir, "results.csv")
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "id", "category", "question", "keyword_recall", "source_hit",
            "source_coverage", "source_text_hit", "refusal_correct", "latency_ms",
            "tokens", "error", "sources", "answer",
        ])
        for r in records:
            writer.writerow([
                r["id"], r["category"], r["question"],
                "" if r["keyword_recall"] is None else round(r["keyword_recall"], 4),
                "" if r["source_hit"] is None else r["source_hit"],
                "" if r["source_coverage"] is None else round(r["source_coverage"], 4),
                "" if r["source_text_hit"] is None else r["source_text_hit"],
                "" if r["refusal_correct"] is None else r["refusal_correct"],
                r["latency_ms"],
                "" if r["tokens"] is None else r["tokens"],
                r["error"],
                "|".join(r["sources"]),
                r["answer"],
            ])
    with open(os.path.join(out_dir, "summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    with open(os.path.join(out_dir, "report.md"), "w", encoding="utf-8") as f:
        f.write(report)
    return csv_path


def main():
    parser = argparse.ArgumentParser(description="基米民易通 RAG 评测")
    parser.add_argument("--mode", choices=["real", "mock"], default="mock")
    parser.add_argument("--dataset", default=os.path.join(BASE_DIR, "dataset", "questions.jsonl"))
    parser.add_argument("--mock", default=os.path.join(BASE_DIR, "mock", "responses.json"))
    parser.add_argument("--out", default=os.path.join(BASE_DIR, "results"))
    parser.add_argument("--label", default=time.strftime("run-%Y%m%d-%H%M%S"))
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--timeout", type=int, default=120)
    args = parser.parse_args()

    cfg = {
        "mode": args.mode,
        "dataset": args.dataset,
        "mock_path": args.mock,
        "api_base": os.environ.get("DIFY_API_BASE", "http://localhost/v1"),
        "api_key": os.environ.get("DIFY_API_KEY", ""),
        "user": os.environ.get("DIFY_USER", "eval-runner"),
        "workers": max(1, args.workers),
        "timeout": args.timeout,
    }
    if cfg["mode"] == "real" and not cfg["api_key"]:
        print("真实评测需要先设置环境变量 DIFY_API_KEY", file=sys.stderr)
        return 2

    items = load_dataset(cfg["dataset"], args.limit)
    records, skipped = evaluate(items, cfg)
    if not records:
        print("没有可评测的题目（mock 文件中没有匹配的 id？）", file=sys.stderr)
        return 1

    summary = summarize(records)
    report = render_report(args.label, cfg, records, skipped, summary)
    out_dir = os.path.join(args.out, args.label)
    csv_path = write_outputs(out_dir, records, summary, report)

    overall = summary["overall"]
    print(f"评测完成：{len(records)} 题（跳过 {skipped} 题）")
    print(f"要点召回率 {pct(overall['关键要点召回率'])} | "
          f"来源命中率 {pct(overall['来源命中率'])} | "
          f"拒答正确率 {pct(overall['拒答正确率'])} | "
          f"平均延迟 {fmt(overall['平均延迟ms'], ' ms')}")
    print("明细：", csv_path)
    print("报告：", os.path.join(out_dir, "report.md"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
