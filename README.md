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

- `TARGET_ENV`: selects the folder under `services/` that provides URLs and credentials for the chosen environment (e.g., `dev`, `uat`).
- `SCENARIO_TYPE_ENV`: picks the executor (`constant-arrival-rate`, `per-vu-iterations`, `constant-vus`); defaults to `constant-arrival-rate`.
- `VUS_MAX_ENV`: upper bound on VUs allocated to the scenario; controls concurrency.
- `RATE`: desired request rate for arrival-based executors; measured in iterations per `TIME_UNIT`.
- `TIME_UNIT`: granularity for `RATE` (e.g., `1s`, `500ms`); only used by arrival-rate scenarios.
- `SCENARIO_DURATION_ENV`: wall-clock duration for the scenario (e.g., `1m`, `5m`).
- `ITERATIONS_ENV`: total iterations per VU for `per-vu-iterations`; ignored by duration-driven executors.
- `K6_VUS`, `K6_DURATION`, `K6_ITERATIONS`, `K6_RPS`: pipeline-level knobs that are forwarded to k6 CLI flags (`--vus`, `--duration`, `--iterations`, `--rps`).
