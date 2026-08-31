"""Measure authenticated HTTP -> outbox -> Kafka -> Redis -> WebSocket delivery."""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import time
import uuid
from collections import defaultdict
from pathlib import Path

import httpx
import websockets


def percentile(values: list[float], percentile_value: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, math.ceil((percentile_value / 100) * len(ordered)) - 1)
    return round(ordered[index], 3)


async def service_token(identity_url: str) -> str:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{identity_url.rstrip('/')}/realms/aegis/protocol/openid-connect/token",
            data={
                "grant_type": "client_credentials",
                "client_id": "aegis-benchmark",
                "client_secret": "aegis-benchmark-local-only",
            },
        )
        response.raise_for_status()
        return response.json()["access_token"]


async def run(args: argparse.Namespace) -> dict:
    token = await service_token(args.identity_url)
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(base_url=args.api_url, headers=headers, timeout=15) as client:
        status_response = await client.get("/api/v1/pipeline/status")
        status_response.raise_for_status()
        pipeline = status_response.json()
        if pipeline["profile"] != args.profile:
            raise RuntimeError(
                f"Stack profile is {pipeline['profile']!r}; restart it with PIPELINE_PROFILE={args.profile}"
            )
        ticket_response = await client.post("/api/v1/realtime-tickets")
        ticket_response.raise_for_status()
        ticket = ticket_response.json()["ticket"]

        accepted: dict[str, tuple[int, str]] = {}
        delivered: dict[str, int] = {}
        accepted_by_class = defaultdict(int)
        delivered_by_class = defaultdict(int)
        backlog_samples: list[int] = []
        sender_errors: list[str] = []
        finished = asyncio.Event()

        async def receive_events() -> None:
            socket_url = f"{args.ws_url.rstrip('/')}?ticket={ticket}"
            async with websockets.connect(socket_url, max_size=2**20) as socket:
                while not finished.is_set():
                    try:
                        raw = await asyncio.wait_for(socket.recv(), timeout=0.25)
                    except asyncio.TimeoutError:
                        continue
                    message = json.loads(raw)
                    if message.get("type") != "operations.event":
                        continue
                    payload = message.get("payload", {})
                    event_id = payload.get("event_id")
                    if event_id not in accepted or event_id in delivered:
                        continue
                    delivered[event_id] = time.perf_counter_ns()
                    topic_class = payload.get("topic_class", "bulk")
                    delivered_by_class[topic_class] += 1

        async def sample_backlog() -> None:
            while not finished.is_set():
                backlog_samples.append(
                    accepted_by_class["alert"] - delivered_by_class["alert"]
                )
                await asyncio.sleep(0.05)

        async def send_one(index: int) -> None:
            is_alert = index % max(1, round(1 / args.alert_ratio)) == 0
            event_id = f"bench-{args.profile}-{uuid.uuid4()}"
            topic_class = "alert" if is_alert else "bulk"
            priority = "HIGH" if is_alert else "BULK"
            sent_at = time.perf_counter_ns()
            body = {
                "event_id": event_id,
                "source": "pipeline-benchmark",
                "event_type": "benchmark.alert" if is_alert else "benchmark.telemetry",
                "priority": priority,
                "topic_class": topic_class,
                "aggregate_type": "incident" if is_alert else "unit",
                "aggregate_id": f"stream-{index % args.concurrent_streams}",
                "payload": {
                    "benchmark_profile": args.profile,
                    "sequence": index,
                    "synthetic": True,
                },
            }
            try:
                response = await client.post("/api/v1/ingest/events", json=body)
                response.raise_for_status()
                accepted[event_id] = (sent_at, topic_class)
                accepted_by_class[topic_class] += 1
            except Exception as exc:
                sender_errors.append(f"{event_id}: {exc}")

        receiver = asyncio.create_task(receive_events())
        sampler = asyncio.create_task(sample_backlog())
        await asyncio.sleep(0.5)
        started_at = time.perf_counter()
        pending = set()
        for index in range(args.events):
            target_time = started_at + (index / args.rate)
            delay = target_time - time.perf_counter()
            if delay > 0:
                await asyncio.sleep(delay)
            task = asyncio.create_task(send_one(index))
            pending.add(task)
            task.add_done_callback(pending.discard)
            if len(pending) >= args.max_in_flight:
                await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
        if pending:
            await asyncio.gather(*pending)

        deadline = time.monotonic() + args.drain_timeout
        while len(delivered) < len(accepted) and time.monotonic() < deadline:
            await asyncio.sleep(0.1)
        finished.set()
        await asyncio.gather(receiver, sampler, return_exceptions=True)

    alert_latencies_ms = [
        (delivered[event_id] - sent_ns) / 1_000_000
        for event_id, (sent_ns, topic_class) in accepted.items()
        if event_id in delivered and topic_class == "alert"
    ]
    elapsed = max(time.perf_counter() - started_at, 0.001)
    result = {
        "profile": args.profile,
        "evidence_level": "local_integration",
        "workload": {
            "events": args.events,
            "rate_per_second": args.rate,
            "alert_ratio": args.alert_ratio,
            "concurrent_streams": args.concurrent_streams,
        },
        "pipeline": pipeline,
        "accepted": len(accepted),
        "delivered": len(delivered),
        "lost": len(accepted) - len(delivered),
        "sender_errors": sender_errors[:20],
        "throughput_per_second": round(len(delivered) / elapsed, 2),
        "end_to_end_latency_ms": {
            "p50": percentile(alert_latencies_ms, 50),
            "p95": percentile(alert_latencies_ms, 95),
            "p99": percentile(alert_latencies_ms, 99),
            "max": round(max(alert_latencies_ms), 3) if alert_latencies_ms else None,
        },
        "alert_delivery_backlog": {
            "p95": percentile([float(value) for value in backlog_samples], 95),
            "peak": max(backlog_samples, default=0),
            "note": "End-to-end undelivered alert count; not Kafka offset lag.",
        },
        "claim_eligible": False,
        "claim_gate_note": "Run compare_results.py with baseline and optimized results.",
    }
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", choices=["baseline", "optimized"], required=True)
    parser.add_argument("--events", type=int, default=5000)
    parser.add_argument("--rate", type=float, default=500)
    parser.add_argument("--alert-ratio", type=float, default=0.10)
    parser.add_argument("--concurrent-streams", type=int, default=40)
    parser.add_argument("--max-in-flight", type=int, default=200)
    parser.add_argument("--drain-timeout", type=float, default=45)
    parser.add_argument("--api-url", default="http://localhost:8000")
    parser.add_argument("--identity-url", default="http://localhost:8080")
    parser.add_argument("--ws-url", default="ws://localhost:8000/ws/operations")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = asyncio.run(run(args))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    if result["lost"] or result["sender_errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
