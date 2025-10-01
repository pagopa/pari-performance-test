# pari-performance-test

Repository for performance testing on the computerized list of household appliances platform.

## Project overview

- Build phase: the pipeline compiles a custom `xk6` binary (via `templates\xk6-build.yml`) only when the cache is cold, keeping runs deterministic across environments.
- Execution phase: each entry in `SCRIPTS_TO_EXECUTE` is executed via the Python helper `.devops/run_k6_script.py`, which resolves parameters, expands stages into CLI flags, and launches `./xk6 run` against the selected environment.
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
- `K6_STAGES`: object parameter converted at runtime to the env var `K6_STAGES_JSON` and mirrored as CLI `--stage <duration>:<target>` flags. Provide it in YAML form (for example `K6_STAGES:
  - duration: "3m"
    target: 1000`) and the pipeline will emit both the compact JSON string consumed by the script and the equivalent CLI stages. For local runs you can pass either `K6_STAGES_JSON='[...]'`, the legacy `K6_STAGES='[...]'`, or explicit `--stage` arguments.
- `K6_ITERATIONS`: total number of iterations to complete. When greater than zero it enables deterministic workloads in `shared-iterations` or `per-vu-iterations`; a value of `0` hands control back to duration-based execution.

## How the parameters interact

- Scenario-driven requirements: `K6_SCENARIO_TYPE` decides which knobs are honored. Iteration executors require `K6_ITERATIONS > 0`, VU executors lean on `K6_VUS`, and arrival executors demand a coherent trio of `K6_RATE`, `K6_TIME_UNIT`, and `K6_PRE_ALLOCATED_VUS`.
- Duration versus work units: `K6_DURATION` always exists as a safety net even when iterations are specified, preventing never-ending runs if a service degrades. When iterations are omitted, duration defines the full life span of the load test.
- Virtual user sizing: `K6_VUS` is the baseline, `K6_PRE_ALLOCATED_VUS` ensures enough actors are ready for arrival executors, `K6_MAX_VUS` enforces a hard ceiling, and `K6_START_VUS` shapes the initial ramp for `ramping-vus`.
- Rate governance: `K6_RATE` and `K6_TIME_UNIT` describe the theoretical load curve, while `K6_RPS` clamps the actual throughput. Tuning both allows engineers to simulate worst-case demand without risking environmental instability.
- Environment binding: `TARGET_ENV` injects environment-specific URLs and secrets via `loadEnvConfig`, so every test run aligns with the proper backend instance while still using the same script.

## Scenario catalog with numerical examples

- **manual**
  - **Goal**: run the script without relying on a predefined k6 executor to debug locally or validate basic flows before longer campaigns.
  - **Required inputs and usage**: no scenario parameters are needed. Invoke `k6 run` directly, choosing the desired VUs and duration; pipeline variables stay optional.
  - **Example**:
    - Without stages: `k6 run --vus 100 --duration 5m scripts/pdv.js` starts 100 virtual users locally for five minutes.

- **shared-iterations**
  - **Goal**: measure how quickly a pool of virtual users finishes a fixed amount of business transactions, highlighting throughput and latency regressions between builds.
  - **Required inputs and usage**: set `K6_SCENARIO_TYPE=shared-iterations`, provide `K6_ITERATIONS` plus either `K6_VUS=100` or `K6_VUS=1000`. `K6_DURATION` remains the safety window to avoid runaway executions.
  - **Example**:
    - Without stages: `K6_ITERATIONS=20000 K6_VUS=100 K6_DURATION=10m ./devops/run_k6_script.py` forces 100 VUs to finish 20k iterations inside ten minutes.

- **per-vu-iterations**
  - **Goal**: ensure every virtual user repeats the same number of iterations, revealing issues that surface after warm-up or when per-user caches are involved.
  - **Required inputs and usage**: set `K6_SCENARIO_TYPE=per-vu-iterations`, then define `K6_ITERATIONS` together with `K6_VUS=100` or `K6_VUS=1000`. Each VU executes `K6_ITERATIONS / K6_VUS`, with `K6_DURATION` still acting as a guard rail.
  - **Example**:
    - Without stages: `K6_ITERATIONS=10000 K6_VUS=100 K6_DURATION=10m ./devops/run_k6_script.py` makes every VU run 100 iterations.

- **constant-vus**
  - **Goal**: keep concurrency flat for the full duration to study steady-state resource usage or run short soak tests.
  - **Required inputs and usage**: choose `K6_SCENARIO_TYPE=constant-vus` and set `K6_VUS` to either 100 or 1000 alongside `K6_DURATION`. Optionally add `K6_RPS` to cap throughput on shared environments.
  - **Example**:
    - Without stages: `K6_VUS=1000 K6_DURATION=10m K6_RPS=5000 ./devops/run_k6_script.py` sustains 1000 concurrent users for ten minutes.

- **ramping-vus**
  - **Goal**: model controlled user growth or cooldown by changing the active VU count over time.
  - **Required inputs and usage**: set `K6_SCENARIO_TYPE=ramping-vus` and provide `K6_STAGES` (`K6_STAGES_JSON` works as well). Targets should use 0, 100, or 1000 VUs; manage limits with `K6_MAX_VUS` and `K6_START_VUS` if needed. Total duration equals the sum of stage durations.
  - **Example**:
    - With stages: `K6_STAGES='[{"duration":"3m","target":100},{"duration":"4m","target":1000},{"duration":"3m","target":0}]' K6_MAX_VUS=1000 ./devops/run_k6_script.py` ramps from idle to 1000 VUs, holds, then ramps down over ten minutes.
    - Without stages: not applicable; this executor always relies on stages. Use `constant-vus` for a flat plateau.

- **constant-arrival-rate**
  - **Goal**: keep the number of iterations per time unit constant, decoupling throughput validation from how quickly virtual users finish their work.
  - **Required inputs and usage**: configure `K6_SCENARIO_TYPE=constant-arrival-rate`, then provide `K6_RATE`, `K6_TIME_UNIT`, and size the pool with `K6_PRE_ALLOCATED_VUS` set to 100 or 1000. Use `K6_MAX_VUS=1000` when you expect k6 to scale the pool.
  - **Example**:
    - Without stages: `K6_RATE=400 K6_TIME_UNIT=1s K6_PRE_ALLOCATED_VUS=100 K6_MAX_VUS=1000 K6_DURATION=10m ./devops/run_k6_script.py` keeps roughly 400 iterations per second for ten minutes.

- **ramping-arrival-rate**
  - **Goal**: vary the request arrival rate to reproduce progressive marketing launches or sudden demand spikes while letting k6 expand the worker pool automatically.
  - **Required inputs and usage**: pick `K6_SCENARIO_TYPE=ramping-arrival-rate`, define `K6_STAGES` with arrival targets (for example 100 to 1000 req/s), set `K6_TIME_UNIT`, and dimension `K6_PRE_ALLOCATED_VUS` / `K6_MAX_VUS` using 100 or 1000 VUs.
  - **Example**:
    - With stages: `K6_STAGES='[{"duration":"2m","target":100},{"duration":"5m","target":1000},{"duration":"3m","target":1000}]' K6_TIME_UNIT=1s K6_PRE_ALLOCATED_VUS=100 K6_MAX_VUS=1000 ./devops/run_k6_script.py` ramps the arrival rate from 100 to 1000 iterations per second and sustains the peak for the final three minutes of a ten-minute test.
    - Without stages: not applicable; use `constant-arrival-rate` for a fixed arrival curve.

## Operational tips for local and CI usage

- Validate configuration locally with `TARGET_ENV=uat k6 run --vus 100 --duration 30s <script>` before scaling up in CI to ensure environment variables and secrets resolve correctly.
- Keep `K6_PRE_ALLOCATED_VUS` slightly above the expected steady-state VUs when using arrival executors; undersizing here is a common source of `insufficient VUs` warnings and unstable rates.
- Version control custom `K6_STAGES` definitions alongside your test plan so reviewers can understand the intended load shape together with the scenario type.
- Monitor published artifacts in Azure DevOps; exporting them to k6 Cloud or Grafana Loki provides longer retention and shared dashboards for trend analysis.

## Pipeline configuration playbook

- **Sustainable concurrency ceiling (1000 VUs steady for 10 minutes)**
  - Scenario: `constant-vus`
  - Parameters: `K6_VUS=1000`, `K6_DURATION=10m`, optional `K6_RPS=5000`, `TARGET_ENV=uat`
  - Outcome: validates the highest supported number of concurrent users the environment can sustain for ten minutes without severe degradation; focus on response stability under 1000 steady VUs.
- **Controlled growth of active users (ramp 100 to 1000 VUs in 10 minutes)**
  - Scenario: `ramping-vus`
  - Parameters: `K6_STAGES='[{"duration":"3m","target":100},{"duration":"4m","target":1000},{"duration":"3m","target":0}]'`, `K6_MAX_VUS=1000`, `K6_START_VUS=100`, `TARGET_ENV=uat`
  - Outcome: observes how services react as the active population climbs from 100 to 1000 users, highlighting autoscaling latency and protection rules before a controlled ramp-down.
- **Sudden spike resilience (jump to 1000 req/s backed by 1000 VUs)**
  - Scenario: `ramping-arrival-rate`
  - Parameters: `K6_STAGES='[{"duration":"1m","target":100},{"duration":"1m","target":1000},{"duration":"8m","target":1000}]'`, `K6_TIME_UNIT=1s`, `K6_PRE_ALLOCATED_VUS=1000`, `K6_MAX_VUS=1000`, `K6_RPS=5000`
  - Outcome: verifies how long the platform tolerates an abrupt demand spike sustained for eight minutes, with the worker pool capped at 1000 VUs.
- **Rapid resilience check (target: 5k req/s achieved within 5 minutes and held for 10 more)**
  - Scenario: `ramping-arrival-rate`
  - Parameters: `K6_STAGES='[{"duration":"5m","target":5000},{"duration":"10m","target":5000}]'`, `K6_TIME_UNIT=1s`, `K6_PRE_ALLOCATED_VUS=1000`, `K6_MAX_VUS=1000`, `K6_RPS=5000`
  - Outcome: the test reaches 5k req/s by minute five, then maintains that pressure for ten minutes. The RPS cap prevents overshoot while the pool remains bounded at 1000 VUs.
- **Throughput smoke test (ensure 1k requests complete in <2 minutes)**
  - Scenario: `shared-iterations`
  - Parameters: `K6_ITERATIONS=1000`, `K6_VUS=100`, `K6_DURATION=2m`
  - Outcome: 100 VUs share the 1k iterations and must finish before the 2-minute deadline, exposing regressions that slow individual iterations.
- **Soak test (sustain ~100 concurrent sessions for one hour)**
  - Scenario: `constant-vus`
  - Parameters: `K6_VUS=100`, `K6_DURATION=1h`, optional `K6_RPS=500`
  - Outcome: holds a stable level of concurrency to reveal slow memory leaks or resource degradation that emerges only with long-lived sessions.
- **Warm-up plus peak verification (step from 100 to 1000 req/s)**
  - Scenario: `ramping-arrival-rate`
  - Parameters: `K6_STAGES='[{"duration":"3m","target":100},{"duration":"2m","target":1000},{"duration":"5m","target":1000}]'`, `K6_TIME_UNIT=1s`, `K6_PRE_ALLOCATED_VUS=1000`, `K6_MAX_VUS=1000`
  - Outcome: lets services warm up at 100 req/s, then forces a sharp increase to 1000 req/s to validate autoscaling and circuit breaker behavior during sudden peaks.
