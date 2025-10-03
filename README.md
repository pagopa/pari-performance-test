# pari-performance-test — Guida in Italiano (per ingegneri IT)

Repository per test di performance sulla piattaforma "computerized list of household appliances".

## Panoramica del progetto

* **Build**: la pipeline compila un binario custom `xk6` (template `templates/xk6-build.yml`) solo quando la cache è fredda, così le esecuzioni restano deterministiche tra ambienti.
* **Esecuzione**: ogni voce in `SCRIPTS_TO_EXECUTE` viene lanciata tramite l'helper Python `.devops/run_k6_script.py`, che risolve i parametri, espande eventuali `stages` in flag CLI, e avvia `./xk6 run` contro l’ambiente selezionato.
* **Risultati**: gli artifact sotto `results/` sono pubblicati a fine job per analisi downstream o ispezione manuale.

---

## Parameter catalog (ordinato come nella pipeline AZDO)

> Regola generale: tutti i "knobs" sono **disabilitati per default** (0 o `0s`). La pipeline **fallisce** quando il parametro richiesto dallo **scenario** scelto non è stato impostato, prevenendo carichi errati.

| Parametro              | Scopo                                                                         | Obbligatorio per                                                             | Ignorato quando                                               | Note pratiche                                                                                                                                       | Conflitti / comportamento anomalo                                                              |
| ---------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `K6_SCRIPT_PATH`       | Path relativo dell’entrypoint k6.                                             | Tutti.                                                                       | Mai.                                                          | Sorgente da eseguire; è anche la base per tagging/logging nel runner.                                                                               | Nessuno.                                                                                       |
| `TARGET_ENV`           | Seleziona il blocco di configurazione (URL, credenziali) e tagga i risultati. | Tutti.                                                                       | Mai.                                                          | Pilota variabili d’ambiente e pool agent.                                                                                                           | Nessuno.                                                                                       |
| `K6_SCENARIO_TYPE`     | Sceglie l’esecutore k6.                                                       | Tutti.                                                                       | Mai.                                                          | Valori ammessi: `manual`, `shared-iterations`, `per-vu-iterations`, `constant-vus`, `ramping-vus`, `constant-arrival-rate`, `ramping-arrival-rate`. | Non va combinato con scenari diversi: un solo scenario per run.                                |
| `K6_STAGES`            | Definisce step di rampa.                                                      | `ramping-vus`, `ramping-arrival-rate`.                                       | Tutti gli altri.                                              | YAML/JSON array. Durata totale = somma stage.                                                                                                       | Con `K6_DURATION` se copre l’intero test: `K6_DURATION` diventa ridondante.                    |
| `K6_DURATION`          | Finestra tempo del test; agisce anche come `maxDuration`.                     | `manual`, `constant-vus`, `constant-arrival-rate`, fallback per `ramping-*`. | Ignorato se lo scenario copre tutta la timeline con `stages`. | Sempre utile come kill-switch.                                                                                                                      | Con `K6_STAGES` completi → può essere ignorato.                                                |
| `K6_VUS`               | Concorrenza base.                                                             | `manual`, `shared-iterations`, `per-vu-iterations`, `constant-vus`.          | Ignorato da scenari a *arrival*.                              | Controlla il numero di VU attivi.                                                                                                                   | Con `K6_PRE_ALLOCATED_VUS`/`K6_MAX_VUS`: questi ultimi hanno priorità negli scenari *arrival*. |
| `K6_MAX_VUS`           | Tetto di VU per autoscaling.                                                  | *Arrival*.                                                                   | Altri scenari.                                                | ≥ `PRE_ALLOCATED_VUS`.                                                                                                                              | Nessuno, ma se < `PRE_ALLOCATED_VUS` il run fallisce.                                          |
| `K6_PRE_ALLOCATED_VUS` | Pool pre-warm.                                                                | *Arrival*.                                                                   | Altri scenari.                                                | Evita cold start.                                                                                                                                   | Ignorato con `K6_VUS`.                                                                         |
| `K6_START_VUS`         | Valore iniziale VU.                                                           | `ramping-vus`.                                                               | Tutti gli altri.                                              | Consistente con il primo stage.                                                                                                                     | Nessuno.                                                                                       |
| `K6_RATE`              | Throughput target.                                                            | `constant-arrival-rate`; fallback per `ramping-arrival-rate`.                | Ignorato da manual/VU-based.                                  | Usato con `K6_TIME_UNIT`.                                                                                                                           | Con `K6_ITERATIONS` non ha senso: iterazioni totali ignorano rate.                             |
| `K6_TIME_UNIT`         | Contesto per `K6_RATE`.                                                       | *Arrival*.                                                                   | Manual e VU-based.                                            | Tipico: `1s`.                                                                                                                                       | Nessuno.                                                                                       |
| `K6_RPS`               | Limite globale richieste/s.                                                   | Opzionale.                                                                   | Mai (0=illimitato).                                           | Safety-net.                                                                                                                                         | Nessuno, ma se troppo basso può troncare test.                                                 |
| `K6_ITERATIONS`        | Numero totale di iterazioni.                                                  | Iteration-based.                                                             | Ignorato da VU e *arrival*.                                   | In `per-vu-iterations`: per-VU = `ITER/VUS`.                                                                                                        | Con `K6_RATE`/`K6_TIME_UNIT` irrilevante.                                                      |

---

### Quando un parametro è ignorato: alternative

* `K6_VUS` → usato solo con iteration/VU-based. Negli scenari *arrival* si usano `K6_PRE_ALLOCATED_VUS`/`K6_MAX_VUS`.
* `K6_STAGES` → solo per ramping. Negli altri scenari si usano `K6_DURATION` e/o `K6_VUS` o `K6_RATE`.
* `K6_DURATION` → utile come stop timer, ma non richiesto se gli stages coprono tutta la timeline.
* `K6_RATE`/`K6_TIME_UNIT` → validi solo per *arrival*; con iteration/VU-based si usano `K6_ITERATIONS`/`K6_VUS`.

---

## Esclusività e precedenze

* **Iteration-based**: `K6_ITERATIONS>0`, `K6_VUS>0`; ignorano `K6_RATE`, `K6_TIME_UNIT`, `K6_STAGES`.
* **VU-based**: `K6_VUS>0`; per `ramping-vus` gli `stages` sono obbligatori.
* **Arrival-based**: `K6_PRE_ALLOCATED_VUS>0`, `K6_MAX_VUS>=PRE_ALLOCATED_VUS`; ignorano `K6_VUS`.
* `K6_RPS` è indipendente.

---

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


---
