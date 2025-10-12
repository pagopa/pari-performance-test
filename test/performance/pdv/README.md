# PDV Performance Script

The script (`pdvPerformance.js`) runs a load test against the PDV `/tokens`
endpoint using [k6](https://k6.io/). Each iteration performs a `PUT` request with a
random payload to measure throughput and behaviour under stress.

## Prerequisites

- k6 installed locally, or an Azure DevOps pipeline configured with the `xk6`
  binary.
- Environment configuration files inside the `config/` folder (`dev.json`,
  `uat.json`, `prod.json`) exposing a `pdvUrl` property.

## Key environment variables

- `TARGET_ENV`: selects the `config/<env>.json` file used to resolve `pdvUrl`.
- `PDV_URL`: optional override for the URL loaded from the config file.
- `K6PERF_SCENARIO_TYPE`: chooses the executor (`manual`, `shared-iterations`,
  `per-vu-iterations`, `constant-vus`, `ramping-vus`, `constant-arrival-rate`,
  `ramping-arrival-rate`).
- `K6PERF_VUS`, `K6PERF_DURATION`, `K6PERF_ITERATIONS`, `K6PERF_RPS`: governano gli scenari VU/iterazioni e vengono letti direttamente dallo script k6.
- `K6PERF_RATE`, `K6PERF_TIME_UNIT`: parameters for arrival-based executors
  (`rate`, `timeUnit`).
- `K6PERF_PRE_ALLOCATED_VUS`, `K6PERF_MAX_VUS`, `K6PERF_START_VUS`: tune VU allocation for
  ramping and arrival-rate scenarios.
- `K6PERF_STAGES`: stage definition for ramping executors (JSON array, for example
  `[{"duration":"30s","target":100}]`). When omitted, ramping-arrival-rate scenarios require explicit values; altri executor ignorano la variabile.

## How it works

1. Run commands from the repository root.
2. Export the desired environment variables (inline or via the shell).
3. Execute the script with `k6 run` or trigger the pipeline.

The script resolves `pdvUrl`, builds the requested scenario, and executes it. When
`K6PERF_SCENARIO_TYPE=manual`, the script does not define scenarios; configure k6 via CLI flags or rely on the built-in defaults.

## Usage examples

### 1. Manual smoke test (CLI-driven)

```bash
TARGET_ENV=uat \
K6PERF_SCENARIO_TYPE=manual \
k6 run --vus 5 --duration 30s pdvPerformance.js
```

Uses only CLI flags for VUs and duration; the script does not inject a scenario.

### 2. `constant-arrival-rate` scenario

```bash
TARGET_ENV=uat \
K6PERF_SCENARIO_TYPE=constant-arrival-rate \
K6PERF_RATE=150 \
K6PERF_TIME_UNIT=1s \
K6PERF_DURATION=2m \
K6PERF_PRE_ALLOCATED_VUS=80 \
K6PERF_MAX_VUS=160 \
k6 run pdvPerformance.js
```

Creates a constant arrival rate of 150 iterations per second with automatic VU
allocation.

### 3. `ramping-vus` with explicit stages

```bash
TARGET_ENV=uat \
K6PERF_SCENARIO_TYPE=ramping-vus \
K6PERF_START_VUS=20 \
K6PERF_STAGES='[{"duration":"1m","target":100},{"duration":"2m","target":200},{"duration":"1m","target":50}]' \
k6 run pdvPerformance.js
```

Gradually increases the active VUs following the provided stage configuration.

### 4. `ramping-arrival-rate` with fallback stage

```bash
TARGET_ENV=uat \
K6PERF_SCENARIO_TYPE=ramping-arrival-rate \
K6PERF_RATE=200 K6PERF_TIME_UNIT=1s \
K6PERF_PRE_ALLOCATED_VUS=150 \
K6PERF_MAX_VUS=300 \
K6PERF_STAGES='[{"duration":"1m","target":100},{"duration":"1m","target":200},{"duration":"1m","target":300}]' \
k6 run pdvPerformance.js
```

Stages definiscono il numero di iterazioni target per ciascun intervallo; l'helper traduce il JSON in configurazione k6 senza usare flag CLI.

## Azure DevOps pipeline

The `.devops/performance_generic.yaml` pipeline exposes matching parameters
(`K6PERF_*`) e li esporta come variabili d'ambiente; gli script k6 applicano la configurazione senza flag CLI aggiuntivi.

## Output and thresholds

The script checks that every response returns HTTP 200; the default threshold
enforces `checks > 0.99`. When run in the pipeline, artifacts are published to the
`results` folder for later inspection.

## Troubleshooting

- **`Missing PDV_URL`**: make sure `config/<env>.json` contains a valid `pdvUrl`,
  or export `PDV_URL` manually.
- **`K6PERF_STAGES` parsing error**: provide a JSON array with `duration` and
  `target`. Double-check quoting/escaping in your shell.
- **Insufficient throughput**: bump `K6PERF_VUS`/`K6PERF_RATE` and confirm the target
  environment can sustain the increased load.
