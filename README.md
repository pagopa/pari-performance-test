# eie-performance-test
Repository for performance test on computerized list of household appliances

## k6 quick reference

### Core concepts

- Virtual users (VUs) represent the active workers that execute script logic in parallel (`--vus <n>`).
- Iterations are the number of times a VU runs the `default` function; some executors stop after a fixed count while others run for a duration (`--iterations <n>` or executor settings).
- Arrival rate controllers (e.g., `constant-arrival-rate`) schedule requests per time unit, decoupling throughput from the number of VUs (`--vus` + `--duration` or env `RATE`/`TIME_UNIT`).
- Scenarios let you define one or more executors with independent pacing (`--scenario name=executor=...` or the `scenarios` block in code).
- Thresholds define pass/fail criteria (latency, error rate) that make the test self-validating (`--threshold "metric<condition>"`).

### Common environment variables

- `TARGET_ENV`: selects the JSON file under `config/` that provides URLs for the chosen environment (e.g., `config/dev.json`).
- `PDV_URL`: optional override for the API base URL; falls back to the value in `config/<env>.json`.
- `K6_SCENARIO_TYPE`: selects the executor (`manual`, `shared-iterations`, `per-vu-iterations`, `constant-vus`, `ramping-vus`, `constant-arrival-rate`, `ramping-arrival-rate`).
- `K6_VUS`, `K6_DURATION`, `K6_ITERATIONS`, `K6_RPS`: pipeline-driven knobs that are also passed to k6 CLI flags (`--vus`, `--duration`, `--iterations`, `--rps`).
- `K6_RATE`, `K6_TIME_UNIT`: control arrival-rate executors (`rate`, `timeUnit`).
- `K6_PRE_ALLOCATED_VUS`, `K6_MAX_VUS`, `K6_START_VUS`: fine-tune VU allocation for `constant-arrival-rate`, `ramping-arrival-rate`, e `ramping-vus`.
- `K6_STAGES`: optional stage definition as JSON array (es. `[{"duration":"30s","target":100}]`) usata dagli executors ramping.

### Running locally on macOS

```
TARGET_ENV=uat \
K6_SCENARIO_TYPE=constant-arrival-rate \
K6_RATE=300 K6_TIME_UNIT=1s \
k6 run --vus 50 --duration 1m ./test/pdv/pdvPerformance.js
```

Override any variable inline to experiment with different load shapes:

```
TARGET_ENV=uat \
K6_SCENARIO_TYPE=ramping-vus \
K6_VUS=200 K6_START_VUS=50 K6_MAX_VUS=250 \
K6_STAGES='[{"duration":"30s","target":100},{"duration":"1m","target":200},{"duration":"30s","target":0}]' \
k6 run --vus 50 --duration 1m ./test/pdv/pdvPerformance.js
```
