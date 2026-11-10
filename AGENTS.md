# Repository Guidance

## Project Layout

- k6 performance scripts are in `test/performance/`; shared API clients, environment loading, scenario setup, thresholds, and summary helpers are in `test/common/`.
- Environment configuration is in `config/{dev,uat,prod}.json` and is selected with `TARGET_ENV`. Keep credentials and other secrets in approved pipeline/secure configuration, never in committed files.
- Azure DevOps pipelines and their helpers are in `.devops/`. The root [README](README.md) documents the generic pipeline and `K6PERF_*` parameters; see [PDV-specific notes](test/performance/pdv/README.md) for that script.

## Scenario Conventions

- Most scripts use `K6PERF_*` and the shared `test/common/scenarioSetup.js` helpers. Preserve that configuration path when changing those scripts.
- EIE scripts use the separate legacy convention in `test/common/dynamicScenarios/` (`SCENARIO_*_ENV`, `VUS_MAX_ENV`, and related variables). Follow the neighboring EIE script rather than translating it to `K6PERF_*` as part of an unrelated change.
- These scripts run in k6, not ordinary Node.js. Preserve k6 APIs and globals such as `__ENV` and `open`; use the scenario validator below for a local, no-request check.

## Validation

There is no repository-wide package-manager test suite. The generic Azure pipeline validates scenario settings with `.devops/scripts/validate_scenario.mjs`. A small local validation can be run from the repository root in PowerShell:

```powershell
$env:TARGET_ENV = "uat"
$env:K6PERF_SCENARIO_TYPE = "constant-arrival-rate"
$env:K6PERF_RATE = "1"
$env:K6PERF_TIME_UNIT = "1s"
$env:K6PERF_DURATION = "1s"
$env:K6PERF_PRE_ALLOCATED_VUS = "10"
$env:K6PERF_MAX_VUS = "20"
node .devops/scripts/validate_scenario.mjs
```

This validates scenario configuration only; it does not execute a load test. Before running k6 against a service, confirm the target is authorized and use an appropriate load for that environment.

PDV documentation currently contains example paths that do not match the repository-root layout and references an older pipeline filename. Verify run commands against the current script and `.devops/` files before using them. Generic pipeline runs use `.devops/scripts/run_k6.py` and require the pipeline's `xk6` binary.
