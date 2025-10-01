# pari-performance-test

Repository for performance testing on the computerized list of household appliances platform.

## Project overview

- Build phase: the pipeline compiles a custom `xk6` binary (via `templates\xk6-build.yml`) only when the cache is cold, keeping runs deterministic across environments.
- Execution phase: each entry in `SCRIPTS_TO_EXECUTE` is executed sequentially against the selected environment using the executor requested through `K6_SCENARIO_TYPE`.
- Results: artifacts generated under `results/` are published at the end of the job for downstream analysis or manual inspection.

## k6 concepts defined in `.devops/performance_generic.yaml`

- `K6_SCRIPT_PATH`: relative path of the k6 script to execute. Use it to switch between suites (for example PDV vs. checkout) without editing the pipeline template.
- `TARGET_ENV`: environment identifier injected into the script and used for tag enrichment. It drives configuration resolution inside `loadEnvConfig` (URLs, credentials, rate limits, etc.).
- `K6_SCENARIO_TYPE`: selects the k6 executor (manual, iterations based, VU based, or arrival rate). The executor determines how load is generated and which of the remaining parameters become mandatory.
- `K6_DURATION`: wall-clock time the scenario is allowed to run. Iteration executors interpret it as `maxDuration`, whereas VU and arrival executors use it as the primary scheduling window.
- `K6_VUS`: baseline number of virtual users to bootstrap. It feeds into executors directly (`--vus`) and serves as default when other limits (`K6_MAX_VUS`, `K6_PRE_ALLOCATED_VUS`) are unset.
- `K6_RATE`: target arrival rate expressed in requests per `K6_TIME_UNIT`. For example, setting `K6_RATE=200` and `K6_TIME_UNIT=1s` in the pipeline schedules ~200 iterations every second. Arrival executors try to respect this tempo regardless of how quickly virtual users finish their work.
- `K6_TIME_UNIT`: scheduling window associated with `K6_RATE` (for example `1s` or `500ms`). Shorter units create burstier profiles; longer windows smooth the arrival pattern.
- `K6_PRE_ALLOCATED_VUS`: number of virtual users pre-warmed by k6 before ramping up traffic. Arrival executors require this to be high enough to sustain the requested rate without late allocations.
- `K6_MAX_VUS`: upper bound of virtual users k6 may spin up beyond the baseline `K6_VUS`. With arrival-rate executors, k6 automatically increases VUs when needed to keep up with `K6_RATE`. Setting this to `0` means “do not go above `K6_VUS`”.
- `K6_START_VUS`: starting point for `ramping-vus`. A low value softens the ramp, while matching `K6_VUS` removes any warm-up.
- `K6_RPS`: global requests-per-second guard rail applied via the CLI. Even if the scenario attempts a higher throughput, k6 throttles actual HTTP requests to the specified cap. Use it to protect shared environments or mimic upstream throttling rules.
- `K6_STAGES` (pipeline object parameter turned environment variable): optional JSON array of `{ duration, target }` objects consumed by `buildScenarioConfig`. Supply it in the pipeline as YAML (for example `K6_STAGES:
  - duration: "3m"
    target: 1000`) or override it via CLI to control complex ramps beyond the defaults derived from `K6_DURATION`.
- `K6_ITERATIONS`: total number of iterations to complete. When greater than zero it enables deterministic workloads in `shared-iterations` or `per-vu-iterations`; a value of `0` hands control back to duration-based execution.

## How the parameters interact

- Scenario-driven requirements: `K6_SCENARIO_TYPE` decides which knobs are honored. Iteration executors require `K6_ITERATIONS > 0`, VU executors lean on `K6_VUS`, and arrival executors demand a coherent trio of `K6_RATE`, `K6_TIME_UNIT`, and `K6_PRE_ALLOCATED_VUS`.
- Duration versus work units: `K6_DURATION` always exists as a safety net even when iterations are specified, preventing never-ending runs if a service degrades. When iterations are omitted, duration defines the full life span of the load test.
- Virtual user sizing: `K6_VUS` is the baseline, `K6_PRE_ALLOCATED_VUS` ensures enough actors are ready for arrival executors, `K6_MAX_VUS` enforces a hard ceiling, and `K6_START_VUS` shapes the initial ramp for `ramping-vus`.
- Rate governance: `K6_RATE` and `K6_TIME_UNIT` describe the theoretical load curve, while `K6_RPS` clamps the actual throughput. Tuning both allows engineers to simulate worst-case demand without risking environmental instability.
- Environment binding: `TARGET_ENV` injects environment-specific URLs and secrets via `loadEnvConfig`, so every test run aligns with the proper backend instance while still using the same script.

## Scenario catalog with numerical examples

- `manual`: no executor is defined. Example: run `k6 run --vus 5 --duration 1m` locally to smoke-test authentication without involving the pipeline. Useful when engineers need full manual control.
- `shared-iterations`: a VU pool cooperates to complete `K6_ITERATIONS` within `K6_DURATION`. Example: `K6_ITERATIONS=10_000`, `K6_VUS=20`, `K6_DURATION=5m` forces the team to finish 10k requests in under five minutes, revealing per-request latency variance.
- `per-vu-iterations`: each VU executes the same number of iterations. Example: `K6_VUS=50`, `K6_ITERATIONS=500` means every user performs 10 iterations. Ideal to uncover caching regressions where later iterations behave differently from the first.
- `constant-vus`: keeps a flat number of VUs throughout the duration. Example: `K6_VUS=100`, `K6_DURATION=30m` sustains 100 concurrent actors for half an hour, surfacing memory leaks or slow resource accumulation.
- `ramping-vus`: adjusts the VU count according to `K6_STAGES`. Example stages: `[{"duration":"5m","target":50},{"duration":"10m","target":200},{"duration":"5m","target":0}]`. This ramps from idle to 50 users in 5 minutes, pushes up to 200 users for ten minutes, then cools down gracefully.
- `constant-arrival-rate`: generates a fixed request rate using the pipeline parameters `K6_RATE`, `K6_TIME_UNIT`, `K6_PRE_ALLOCATED_VUS`, and `K6_MAX_VUS`. Example: set `K6_RATE=300`, `K6_TIME_UNIT=1s`, `K6_PRE_ALLOCATED_VUS=150`, `K6_MAX_VUS=300` to push ~300 requests every second while k6 scales VUs within those bounds.
- `ramping-arrival-rate`: stages the arrival rate itself. Example: configure `K6_RATE` via `K6_STAGES='[{"duration":"3m","target":100},{"duration":"2m","target":500},{"duration":"10m","target":500}]'` together with `K6_TIME_UNIT=1s`, `K6_PRE_ALLOCATED_VUS=200`, `K6_MAX_VUS=600` to grow from 100 req/s to 500 req/s over five minutes, then hold 500 req/s for ten more.

## Operational tips for local and CI usage

- Validate configuration locally with `TARGET_ENV=uat k6 run --vus 10 --duration 30s <script>` before scaling up in CI to ensure environment variables and secrets resolve correctly.
- Keep `K6_PRE_ALLOCATED_VUS` slightly above the expected steady-state VUs when using arrival executors; undersizing here is a common source of `insufficient VUs` warnings and unstable rates.
- Version control custom `K6_STAGES` definitions alongside your test plan so reviewers can understand the intended load shape together with the scenario type.
- Monitor published artifacts in Azure DevOps; exporting them to k6 Cloud or Grafana Loki provides longer retention and shared dashboards for trend analysis.

## Pipeline configuration playbook

- **Rapid resilience check (target: 5k req/s achieved within 5 minutes and held for 10 more)**
  - Scenario: `ramping-arrival-rate`
  - Parameters: `K6_STAGES='[{"duration":"5m","target":5000},{"duration":"10m","target":5000}]'`, `K6_TIME_UNIT=1s`, `K6_PRE_ALLOCATED_VUS=2500`, `K6_MAX_VUS=6000`, `K6_RPS=5000`
  - Outcome: the test reaches 5k req/s by minute five, then maintains that pressure for ten minutes. The RPS cap prevents overshoot but still validates steady-state capacity at 5k req/s.
- **Throughput smoke test (ensure 1k requests complete in <2 minutes)**
  - Scenario: `shared-iterations`
  - Parameters: `K6_ITERATIONS=1000`, `K6_VUS=25`, `K6_DURATION=2m`
  - Outcome: 25 VUs share the 1k iterations and must finish before the 2-minute deadline, highlighting any regression that slows processing times.
- **Soak test (sustain ~200 concurrent sessions for one hour)**
  - Scenario: `constant-vus`
  - Parameters: `K6_VUS=200`, `K6_DURATION=1h`, optional `K6_RPS=800`
  - Outcome: holds a stable level of concurrency, revealing slow memory leaks or performance degradation that only appears under long-lived sessions while the optional RPS cap protects shared dependencies.
- **Warm-up plus peak verification (step from 100 to 1k req/s)**
  - Scenario: `ramping-arrival-rate`
  - Parameters: `K6_STAGES='[{"duration":"3m","target":100},{"duration":"2m","target":1000},{"duration":"5m","target":1000}]'`, `K6_TIME_UNIT=1s`, `K6_PRE_ALLOCATED_VUS=300`, `K6_MAX_VUS=1200`
  - Outcome: allows services to warm up at 100 req/s, then sharply increases to 1k req/s to validate autoscaling and circuit breaker behaviour during sudden peaks.
