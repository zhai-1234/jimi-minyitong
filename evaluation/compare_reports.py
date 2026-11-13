#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""对比两次评测结果，生成 Markdown 对比表（用于基线 vs 优化后）。

用法：
  python compare_reports.py results/baseline/summary.json results/improved/summary.json \
      --baseline-name 单轮检索 --improved-name 迭代检索 --out results/comparison.md
"""

import argparse
import json
import os


METRICS = [
    ("关键要点召回率", "higher"),
    ("来源命中率", "higher"),
    ("来源覆盖率", "higher"),
    ("拒答正确率", "higher"),
    ("平均延迟ms", "lower"),
    ("P95延迟ms", "lower"),
    ("平均tokens", "lower"),
]


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def fmt(value, metric):
    if value is None:
        return "-"
    if isinstance(value, (int, float)) and metric.endswith("ms"):
        return f"{value:.0f} ms"
    if isinstance(value, float):
        if "率" in metric:
            return f"{value:.1%}"
        return f"{value:.1f}"
    return str(value)


def main():
    parser = argparse.ArgumentParser(description="对比两次评测结果")
    parser.add_argument("baseline")
    parser.add_argument("improved")
    parser.add_argument("--baseline-name", default="基线")
    parser.add_argument("--improved-name", default="优化后")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    base = load(args.baseline)["overall"]
    imp = load(args.improved)["overall"]

    lines = [
        f"# 评测对比：{args.baseline_name} vs {args.improved_name}",
        "",
        f"| 指标 | {args.baseline_name} | {args.improved_name} | 变化 |",
        "| --- | --- | --- | --- |",
    ]
    for metric, direction in METRICS:
        b, i = base.get(metric), imp.get(metric)
        if b is None or i is None:
            delta = "-"
        elif direction == "higher":
            delta = f"{(i - b) * 100:+.1f} pt" if "率" in metric else f"{i - b:+.1f}"
        else:
            pct = (i - b) / b * 100 if b else None
            delta = f"{pct:+.1f}%" if pct is not None else "-"
        lines.append(f"| {metric} | {fmt(b, metric)} | {fmt(i, metric)} | {delta} |")

    text = "\n".join(lines) + "\n"
    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
        print("对比报告已写入：", args.out)
    print(text)


if __name__ == "__main__":
    main()
