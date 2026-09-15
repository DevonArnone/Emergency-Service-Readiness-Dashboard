"""Gate resume claims using two real integration benchmark results."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def compare(baseline: dict, optimized: dict) -> dict:
    baseline_backlog = baseline["alert_delivery_backlog"]["p95"] or 0
    optimized_backlog = optimized["alert_delivery_backlog"]["p95"] or 0
    reduction = (
        ((baseline_backlog - optimized_backlog) / baseline_backlog) * 100
        if baseline_backlog > 0
        else 0
    )
    optimized_latency = optimized["end_to_end_latency_ms"]["p95"]
    workload = baseline.get('workload')
    valid_runs = all(
        result.get('pipeline', {}).get('transport') == 'kafka'
        and result.get('pipeline', {}).get('redis_fanout') is True
        and result.get('accepted', 0) >= 100
        and result.get('accepted') == result.get('workload', {}).get('events')
        and result.get('delivered') == result.get('accepted')
        and not result.get('sender_errors') and not result.get('receiver_errors')
        and result.get('accepted_per_second', 0) >= result.get('workload', {}).get('rate_per_second', float('inf')) * 0.95
        for result in (baseline, optimized)
    )
    passes = (
        valid_runs and bool(workload) and workload == optimized.get('workload')
        and bool(baseline.get('resource_profile')) and baseline.get('resource_profile') == optimized.get('resource_profile')
        and baseline.get('profile') == 'baseline' and optimized.get('profile') == 'optimized'
        and baseline.get("evidence_level") == "local_integration"
        and optimized.get("evidence_level") == "local_integration"
        and baseline.get("lost") == 0
        and optimized.get("lost") == 0
        and optimized_latency is not None
        and optimized_latency <= 200
        and reduction >= 60
    )
    return {
        "claim_eligible": passes,
        "original_consumer_lag_claim_eligible": False,
        "workload_and_delivery_valid": valid_runs,
        "optimized_alert_p95_ms": optimized_latency,
        "alert_delivery_backlog_reduction_pct": round(reduction, 2),
        "requested_targets": {
            "optimized_alert_p95_ms": 200,
            "backlog_reduction_pct": 60,
        },
        "scope_note": (
            "Backlog reduction measures accepted-but-not-yet-delivered priority events. "
            "Baseline broker sampling includes all shared traffic; optimized sampling includes only alerts. "
            "Those offset totals are not equivalent and cannot substantiate the original consumer-lag claim. "
            "Paired runs must use identical resources and sustain at least 95% of the requested rate."
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("baseline", type=Path)
    parser.add_argument("optimized", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    baseline = json.loads(args.baseline.read_text(encoding="utf-8"))
    optimized = json.loads(args.optimized.read_text(encoding="utf-8"))
    result = compare(baseline, optimized)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    if not result["claim_eligible"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
