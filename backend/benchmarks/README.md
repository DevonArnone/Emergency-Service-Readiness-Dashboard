# Priority Pipeline Benchmark

This harness measures the full authenticated path from HTTP acceptance through PostgreSQL outbox, Kafka, Redis, and the operations WebSocket. It never treats a simulation or a mock transport as resume evidence.

Run the stack once with `PIPELINE_PROFILE=baseline` and save a baseline result, then restart it with `PIPELINE_PROFILE=optimized` and save the optimized result. Both runs use the same workload and container resource profile.

The comparison gates the 200 ms p95 delivery target and 60% priority backlog reduction target. The current backlog metric counts accepted priority events that have not reached the WebSocket; it is intentionally not labeled Kafka consumer offset lag. A consumer-lag resume claim remains prohibited until broker offset sampling is added and passes.
