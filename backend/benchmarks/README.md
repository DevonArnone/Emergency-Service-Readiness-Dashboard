# Priority Pipeline Benchmark

This harness measures the full authenticated path from HTTP acceptance through PostgreSQL outbox, Kafka, Redis, and the operations WebSocket. It never treats a simulation or a mock transport as resume evidence.

## September 15, 2026 measurements

| Profile | Offered events/s | Accepted events/s | Delivered | Alert p95 | Result file |
| --- | ---: | ---: | ---: | ---: | --- |
| Shared baseline | 500 | 183.19 | 5,000 / 5,000 | 1,091.048 ms | [baseline](results/baseline-workers4-5000.json) |
| Isolated priority | 500 | 183.01 | 5,000 / 5,000 | 1,094.147 ms | [optimized](results/optimized-workers4-5000.json) |
| Shared baseline | 100 | 100.00 | 1,000 / 1,000 | 26.607 ms | [lower-load baseline](results/baseline-workers4-1000-rate100.json) |
| Isolated priority | 100 | 100.02 | 1,000 / 1,000 | 28.953 ms | [lower-load run](results/optimized-workers4-1000-rate100.json) |

The [500-events/s comparison fails](results/comparison-workers4-5000.json). Neither profile sustained the offered rate. All accepted events arrived during these runs, but that does not prove lossless behavior during outages, arbitrary load, or disconnected clients. The short lower-load run demonstrates a local operating point, not production capacity or a latency guarantee.

Both paired runs used Docker Desktop with 10 CPUs and 8,217,448,448 bytes of memory available to its VM, four API processes, one Redpanda core with a 1 GB limit, and the checked-in Compose defaults otherwise. The host ran the load generator; no other test suite ran concurrently. These are available resources, not dedicated per-service reservations. PostgreSQL 16.15, Redis 7.4.5, Redpanda 25.2.4 and Keycloak 26.7.3 ran locally. Traffic was synthetic, with 10% alerts across 40 aggregate IDs, a maximum of 200 in-flight requests and 100 HTTP connections. Both profiles had the same service set; the baseline alert publisher was idle. The optimized topology deliberately gives alerts a separate publisher and consumer path.

Earlier September 14 files are exploratory diagnostics, not controlled comparison evidence. The original `optimized-5000.json` overlapped a backend test run and used an earlier backlog sampler. Single-process and short smoke files are retained to show the investigation rather than select only favorable measurements.

## Reproduce

From the repository root, start the local synthetic-only stack. These credentials are development fixtures; never expose this stack publicly. The authentication/write flags below allow the benchmark service account to post to the synthetic tenant.

```bash
PIPELINE_PROFILE=baseline AUTH_REQUIRED=true PUBLIC_DEMO_WRITE_ENABLED=true API_WORKERS=4 docker compose up -d --build postgres redis redpanda keycloak api outbox-worker alert-outbox-worker alert-bridge bulk-bridge shared-bridge
```

Wait for API health and Keycloak readiness. Record `docker info` resources and confirm the API process count. Run from `backend/` with the full requirements installed:

```bash
venv/bin/python -m benchmarks.pipeline_benchmark --profile baseline --events 5000 --rate 500 --resource-profile 'your verified resource description' --output benchmarks/results/baseline-new.json
```

Switch only the profile from the repository root:

```bash
PIPELINE_PROFILE=optimized AUTH_REQUIRED=true PUBLIC_DEMO_WRITE_ENABLED=true API_WORKERS=4 docker compose up -d api outbox-worker alert-outbox-worker
```

Then, from `backend/`, use exactly the same workload and resource description:

```bash
venv/bin/python -m benchmarks.pipeline_benchmark --profile optimized --events 5000 --rate 500 --resource-profile 'your verified resource description' --output benchmarks/results/optimized-new.json
venv/bin/python -m benchmarks.compare_results benchmarks/results/baseline-new.json benchmarks/results/optimized-new.json --output benchmarks/results/comparison-new.json
```

The comparison intentionally exits nonzero if the evidence gate fails. For the lower-load operating point, use `--events 1000 --rate 100` in both runs. Benchmark events remain in the durable local outbox/broker; repeated runs grow local data. Do not run against a real department tenant.

## Definitions and claim gate

- **Alert latency:** host monotonic time from starting the HTTP request to receiving that event over WebSocket, including HTTP connection wait, API processing, database commit, publisher, broker and fan-out. It excludes time waiting for the harness's in-flight admission slot. The separate accepted-rate gate catches this under-delivery of offered load.
- **Delivery backlog:** sampled accepted-but-not-yet-received alerts. Events can reach the socket before their HTTP response arrives; those are not backlog. This metric is not Kafka consumer lag.
- **Broker lag:** sum of high-water marks minus committed offsets, sampled without joining the consumer group. Baseline samples the entire shared topic; optimized samples alerts only. Comparing these different traffic totals would manufacture an apparent improvement, so the original consumer-lag claim is always gated off.
- **Comparison eligibility:** real Kafka and Redis, matching workloads and nonempty resource descriptions, all requested events accepted and delivered without sender/receiver errors, at least 95% of requested sending rate, p95 alert latency at most 200 ms, and at least 60% delivery-backlog reduction. Passing this alternative gate still would not substantiate the original Kafka-lag wording.

Performance tuning stopped at the user's September 15 direction to prioritize product UI and functionality. Any future investigation should profile API/database/load-generator time under saturation, use a separate load-generator host, repeat each operating point, and measure alert-specific time-to-consume on both paths. Do not introduce artificial bulk delays to force an improvement. Validate broker outage, restart and client recovery separately; throughput measurements are not resilience tests.
