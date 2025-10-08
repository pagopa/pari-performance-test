# pari-performance-test - Guida alla pipeline k6

Repository dedicato ai test di performance della piattaforma "computerized list of household appliances".

Questa guida descrive come utilizzare la pipeline Azure DevOps definita in `.devops/k6-performance-generic.yml`. Tutte le variabili e gli esempi fanno riferimento a quella pipeline e allo script di orchestrazione `.devops/scripts/run_k6.py`.

## Panoramica del progetto

- **Build**: la pipeline compila il binario personalizzato `xk6` (template `templates/xk6-build.yml`) solo quando la cache è assente, così i run successivi riutilizzano l'eseguibile e i risultati restano confrontabili tra ambienti.
- **Esecuzione**: ogni percorso elencato nella variabile `SCRIPTS_TO_EXECUTE` viene lanciato tramite `python3 .devops/scripts/run_k6.py`, che convalida i parametri, prepara le variabili `K6PERF_*` e avvia `./xk6 run` affidando agli script k6 la lettura della configurazione.
- **Risultati**: la cartella `results/` contiene gli output aggregati e viene pubblicata come artifact a fine job per analisi successive o per estrazioni manuali.

## Flusso della pipeline di riferimento

1. Il job `xk6Build` (template `templates/xk6-build.yml`) compila `xk6` e memorizza i binari nella cache condivisa (`$(xk6CacheKey)`).
2. Il job `PerformanceTest` seleziona l'agent pool in base a `TARGET_ENV` (`dev`, `uat`, `prod`) e prepara l'ambiente di esecuzione.
3. Per ogni script elencato in `SCRIPTS_TO_EXECUTE` viene eseguito `python3 .devops/scripts/run_k6.py --script <percorso>`, alimentato dai parametri dichiarati nel file di pipeline.
4. Al termine, la directory `results/` viene pubblicata tramite `PublishPipelineArtifact@1`.

## Catalogo dei parametri (ordine come nella pipeline Azure DevOps)

> Regola generale: i valori numerici pari a 0 (`0`, `0s`, `0.0`) disattivano il parametro corrispondente. Lo script `.devops/scripts/run_k6.py` interrompe l'esecuzione quando uno scenario non riceve i requisiti minimi, prevenendo run con carichi errati.

| Parametro              | Descrizione                                                                                 | Obbligatorio per                                                                                           | Ignorato quando                                                                                                      | Note pratiche                                                                                                                             | Errori / conflitti                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `K6_SCRIPT_PATH`       | Percorso relativo allo script k6 da eseguire.                                               | Tutti gli scenari.                                                                                         | Mai.                                                                                                                 | Deve esistere nel repository; il runner stampa il comando completo per facilitarne il debug.                                            | Percorso inesistente → il job termina con errore prima di invocare k6.                                     |
| `TARGET_ENV`           | Ambiente di destinazione (configurazione URL, credenziali, agent pool).                     | Tutti gli scenari.                                                                                         | Mai.                                                                                                                 | Valori ammessi: `dev`, `uat`, `prod`. Controlla i tag usati nei report e l'agent pool selezionato.                                      | Valori fuori elenco o variabili d'ambiente mancanti fanno fallire il run lato infrastruttura.              |
| `K6PERF_SCENARIO_TYPE`     | Executor k6 da utilizzare.                                                                  | Tutti gli scenari.                                                                                         | Mai.                                                                                                                 | Valori ammessi: `manual`, `shared-iterations`, `per-vu-iterations`, `constant-vus`, `ramping-vus`, `constant-arrival-rate`, `ramping-arrival-rate`. | Valore non ammesso → lo script si interrompe elencando tutti gli executor supportati.                     |
| `K6PERF_STAGES`            | Sequenza di rampe (lista di oggetti `{duration,target}`).                                   | `ramping-vus`, `ramping-arrival-rate`.                                                                     | Scenari diversi da quelli ramping; lo script ripulisce la variabile.                                                  | Può essere definito in YAML o JSON; la pipeline la serializza in `K6PERF_STAGES_JSON` consumata dagli script k6 tramite `__ENV`.                                                | Scenario ramping senza stage validi → errore; valori non numerici vengono scartati e la lista vuota causa stop. |
| `K6PERF_DURATION`          | Durata complessiva del test letta dagli script k6.                                          | `manual` (se non si usano iterazioni), `constant-vus`, `constant-arrival-rate`; fallback di sicurezza per i ramping. | Quando gli stage coprono l'intera timeline oppure in scenari puramente a iterazioni (`shared-iterations`, `per-vu-iterations`). | Impostarlo anche nei ramping mantiene un kill switch; `0s` equivale a parametro disattivo.                                               | Assenza del valore in scenari che lo richiedono → errore; con `constant-vus` non può coesistere con `K6PERF_ITERATIONS`. |
| `K6PERF_VUS`               | Numero di virtual user da mantenere attivi.                                                 | `manual`, `shared-iterations`, `per-vu-iterations`, `constant-vus`.                                         | `constant-arrival-rate` e `ramping-arrival-rate`; se valorizzato con questi executor viene ignorato.                  | Definisce la concorrenza base; scegliendo scenari VU/iterazione l'helper Python elimina eventuali `K6PERF_PRE_ALLOCATED_VUS`/`K6PERF_MAX_VUS` incompatibili. | `manual` richiede `K6PERF_VUS>0` e almeno uno tra `K6PERF_DURATION` e `K6PERF_ITERATIONS`; `constant-vus` con `K6PERF_ITERATIONS>0` genera errore.        |
| `K6PERF_MAX_VUS`           | Limite superiore di virtual user che k6 può allocare.                                      | `constant-arrival-rate`, `ramping-arrival-rate`.                                                            | Scenari basati su VU o iterazioni; con questi executor lo script rimuove `K6PERF_MAX_VUS` (insieme a `K6PERF_PRE_ALLOCATED_VUS`). | Fornisce margine per l'autoscaling: impostarlo ≥ `K6PERF_PRE_ALLOCATED_VUS` evita warning `insufficient VUs`.                                | Valore 0 in scenari a tasso di arrivo → errore; se < `K6PERF_PRE_ALLOCATED_VUS` il run viene interrotto.          |
| `K6PERF_PRE_ALLOCATED_VUS` | Pool iniziale di virtual user riservati.                                                    | `constant-arrival-rate`, `ramping-arrival-rate`.                                                            | Scenari VU-based o iteration-based; lo script la cancella quando `K6PERF_VUS` governa l'esecuzione.                       | Impostarlo leggermente sopra il plateau previsto stabilizza il rate e riduce cold start.                                                 | Valore 0 in scenari a tasso di arrivo → errore; se `K6PERF_MAX_VUS < K6PERF_PRE_ALLOCATED_VUS` il job fallisce.        |
| `K6PERF_START_VUS`         | Numero di virtual user da cui parte la rampa.                                              | `ramping-vus`.                                                                                              | Tutti gli altri scenari, inclusi i ramping a tasso di arrivo.                                                         | Deve essere coerente con il primo elemento di `K6PERF_STAGES`; se omesso gli stage vengono comunque convertiti ma k6 non può partire.       | `ramping-vus` con `K6PERF_START_VUS <= 0` → errore.                                                                |
| `K6PERF_RATE`              | Iterazioni per unità di tempo.                                                              | `constant-arrival-rate`.                                                                                   | Scenari VU-based o iteration-based; negli scenari `ramping-arrival-rate` sono i target degli stage a governare il rate. | Usare insieme a `K6PERF_TIME_UNIT`; lasciare 0 nei run ramping dove i target sono definiti negli stage.                                     | `constant-arrival-rate` con `K6PERF_RATE <= 0` → errore.                                                            |
| `K6PERF_TIME_UNIT`         | Unità di tempo per interpretare `K6PERF_RATE` o gli stage a tasso di arrivo.                    | `constant-arrival-rate`, `ramping-arrival-rate`.                                                            | Scenari VU-based o iteration-based; l'helper Python elimina la variabile d'ambiente.                                   | Valori tipici: `1s`, `500ms`. Per scenari ramping-arrival-rate deve essere coerente con `target` (richieste per unità).                 | Assenza in scenari a tasso di arrivo → errore.                                                                  |
| `K6PERF_RPS`               | Limite globale alle richieste al secondo.                                                   | Nessuno (opzionale).                                                                                        | Mai (con valore 0 il limite è disattivato).                                                                           | Agisce come safety net per proteggere ambienti condivisi; può essere combinato con qualsiasi scenario.                                    | Valore troppo basso può troncare il test anticipatamente ma non genera errori di validazione.                 |
| `K6PERF_ITERATIONS`        | Numero totale di iterazioni da completare.                                                  | `shared-iterations`, `per-vu-iterations`; opzionale per `manual`.                                           | `constant-vus`, `ramping-vus`, `constant-arrival-rate`, `ramping-arrival-rate`.                                       | In `per-vu-iterations` ogni VU esegue `K6PERF_ITERATIONS / K6PERF_VUS`; nel manuale permette run limitati senza durata.                         | Valore 0 in scenari a iterazioni → errore; valore >0 con scenari non supportati (eccetto `manual`) → errore.   |

### Regole di esclusione e precedenza

- **Scenari a iterazioni** (`shared-iterations`, `per-vu-iterations`): richiedono `K6PERF_ITERATIONS` e `K6PERF_VUS`; ignorano `K6PERF_RATE`, `K6PERF_TIME_UNIT` e `K6PERF_STAGES`.
- **Scenari basati sui VU** (`manual`, `constant-vus`, `ramping-vus`): utilizzano `K6PERF_VUS`; nelle rampe sono obbligatori `K6PERF_START_VUS` e `K6PERF_STAGES`. `K6PERF_MAX_VUS` e `K6PERF_PRE_ALLOCATED_VUS` vengono rimossi.
- **Scenari a tasso di arrivo** (`constant-arrival-rate`, `ramping-arrival-rate`): richiedono `K6PERF_PRE_ALLOCATED_VUS` e `K6PERF_MAX_VUS`, ignorano `K6PERF_VUS`.
- `K6PERF_RPS` è indipendente e applicabile a qualunque scenario.

## Catalogo degli scenari con esempi numerici

- **manual**
  - **Obiettivo**: eseguire rapidamente uno script senza affidarsi a un executor k6 predefinito, utile per debug locale o verifiche preliminari.
  - **Parametri minimi**: `K6PERF_SCENARIO_TYPE=manual`, `K6PERF_VUS>0`, più `K6PERF_DURATION` o `K6PERF_ITERATIONS`.
  - **Esempio**: `TARGET_ENV=uat K6PERF_SCENARIO_TYPE=manual K6PERF_VUS=50 K6PERF_DURATION=2m python3 .devops/scripts/run_k6.py --script test/performance/pdv/pdvPerformance.js`.

- **shared-iterations**
  - **Obiettivo**: misurare quanto rapidamente un gruppo di VU completa un numero fisso di transazioni, evidenziando regressioni di throughput o latenza.
  - **Parametri minimi**: `K6PERF_SCENARIO_TYPE=shared-iterations`, `K6PERF_ITERATIONS>0`, `K6PERF_VUS>0`; `K6PERF_DURATION` rimane un limite di sicurezza.
  - **Esempio**: `TARGET_ENV=uat K6PERF_SCENARIO_TYPE=shared-iterations K6PERF_ITERATIONS=20000 K6PERF_VUS=100 K6PERF_DURATION=10m python3 .devops/scripts/run_k6.py --script test/performance/pdv/pdvPerformance.js`.

- **per-vu-iterations**
  - **Obiettivo**: assicurare che ogni VU ripeta lo stesso volume di iterazioni, facendo emergere problemi che compaiono dopo il warm-up o con cache per-utente.
  - **Parametri minimi**: `K6PERF_SCENARIO_TYPE=per-vu-iterations`, `K6PERF_ITERATIONS>0`, `K6PERF_VUS>0`, `K6PERF_DURATION` come guard rail.
  - **Esempio**: `TARGET_ENV=uat K6PERF_SCENARIO_TYPE=per-vu-iterations K6PERF_ITERATIONS=10000 K6PERF_VUS=100 K6PERF_DURATION=10m python3 .devops/scripts/run_k6.py --script test/performance/pdv/pdvPerformance.js`.

- **constant-vus**
  - **Obiettivo**: mantenere costante la concorrenza per osservare lo steady state dell'applicazione o eseguire soak test brevi.
  - **Parametri minimi**: `K6PERF_SCENARIO_TYPE=constant-vus`, `K6PERF_VUS>0`, `K6PERF_DURATION`; `K6PERF_RPS` opzionale come limite superiore.
  - **Esempio**: `TARGET_ENV=uat K6PERF_SCENARIO_TYPE=constant-vus K6PERF_VUS=1000 K6PERF_DURATION=10m K6PERF_RPS=5000 python3 .devops/scripts/run_k6.py --script test/performance/pdv/pdvPerformance.js`.

- **ramping-vus**
  - **Obiettivo**: modellare una crescita o una riduzione controllata del numero di VU attivi.
  - **Parametri minimi**: `K6PERF_SCENARIO_TYPE=ramping-vus`, `K6PERF_START_VUS>0`, `K6PERF_STAGES` con coppie `duration`/`target`; `K6PERF_DURATION` facoltativo.
  - **Esempio**: `TARGET_ENV=uat K6PERF_SCENARIO_TYPE=ramping-vus K6PERF_START_VUS=100 K6PERF_STAGES='[{"duration":"3m","target":100},{"duration":"4m","target":1000},{"duration":"3m","target":0}]' python3 .devops/scripts/run_k6.py --script test/performance/pdv/pdvPerformance.js`.

- **constant-arrival-rate**
  - **Obiettivo**: mantenere costante il numero di iterazioni per unità di tempo, indipendentemente dal tempo che ogni VU impiega a completarle.
  - **Parametri minimi**: `K6PERF_SCENARIO_TYPE=constant-arrival-rate`, `K6PERF_RATE>0`, `K6PERF_TIME_UNIT`, `K6PERF_PRE_ALLOCATED_VUS>0`, `K6PERF_MAX_VUS>=K6PERF_PRE_ALLOCATED_VUS`, `K6PERF_DURATION`.
  - **Esempio**: `TARGET_ENV=uat K6PERF_SCENARIO_TYPE=constant-arrival-rate K6PERF_RATE=400 K6PERF_TIME_UNIT=1s K6PERF_PRE_ALLOCATED_VUS=100 K6PERF_MAX_VUS=1000 K6PERF_DURATION=10m python3 .devops/scripts/run_k6.py --script test/performance/pdv/pdvPerformance.js`.

- **ramping-arrival-rate**
  - **Obiettivo**: variare il tasso di arrivo per simulare lanci progressivi o picchi improvvisi, consentendo a k6 di espandere il pool.
  - **Parametri minimi**: `K6PERF_SCENARIO_TYPE=ramping-arrival-rate`, `K6PERF_STAGES` con target di arrivo, `K6PERF_TIME_UNIT`, `K6PERF_PRE_ALLOCATED_VUS>0`, `K6PERF_MAX_VUS>0`.
  - **Esempio**: `TARGET_ENV=uat K6PERF_SCENARIO_TYPE=ramping-arrival-rate K6PERF_STAGES='[{"duration":"2m","target":100},{"duration":"5m","target":1000},{"duration":"3m","target":1000}]' K6PERF_TIME_UNIT=1s K6PERF_PRE_ALLOCATED_VUS=100 K6PERF_MAX_VUS=1000 python3 .devops/scripts/run_k6.py --script test/performance/pdv/pdvPerformance.js`.

## Playbook di configurazione della pipeline

- **Piatto stabile a 1000 VU per 10 minuti**
  - Scenario: `constant-vus`
  - Parametri consigliati: `K6PERF_VUS=1000`, `K6PERF_DURATION=10m`, `K6PERF_RPS=5000` (opzionale), `TARGET_ENV=uat`
  - Risultato atteso: verifica che l'ambiente sostenga 1000 utenti virtuali simultanei per tutta la durata, mantenendo latenza e errori entro le soglie definite.

- **Rampa controllata 100 -> 1000 VU in 10 minuti**
  - Scenario: `ramping-vus`
  - Parametri consigliati: `K6PERF_START_VUS=100`, `TARGET_ENV=uat`; lasciare `K6PERF_DURATION` disattivato (0s) così la durata totale coincide con la somma degli stage
  - `K6PERF_STAGES`: `[{"duration":"3m","target":100},{"duration":"4m","target":1000},{"duration":"3m","target":0}]`
  - Risultato atteso: osserva come il sistema scala mentre la concorrenza cresce fino a 1000 VU e poi torna a zero in modo controllato.

- **Spike improvviso a 1000 richieste/s sostenuto per 8 minuti**
  - Scenario: `ramping-arrival-rate`
  - Parametri consigliati: `K6PERF_TIME_UNIT=1s`, `K6PERF_PRE_ALLOCATED_VUS=1000`, `K6PERF_MAX_VUS=1000`, `K6PERF_RPS=5000`, `TARGET_ENV=uat`
  - `K6PERF_STAGES`: `[{"duration":"1m","target":100},{"duration":"1m","target":1000},{"duration":"8m","target":1000}]`
  - Risultato atteso: valida la resilienza del sistema quando il carico passa da 100 a 1000 richieste al secondo in modo repentino e rimane al picco.

- **Plateau costante a 1000 richieste/s per 15 minuti**
  - Scenario: `constant-arrival-rate`
  - Parametri consigliati: `K6PERF_RATE=1000`, `K6PERF_TIME_UNIT=1s`, `K6PERF_PRE_ALLOCATED_VUS=900`, `K6PERF_MAX_VUS=1200`, `K6PERF_DURATION=15m`, `TARGET_ENV=uat`
  - Risultato atteso: conferma che l'infrastruttura mantiene 1000 iterazioni al secondo con sufficiente margine di VU per assorbire code e ritardi temporanei.

- **Smoke test di throughput (1000 iterazioni entro 2 minuti)**
  - Scenario: `shared-iterations`
  - Parametri consigliati: `K6PERF_ITERATIONS=1000`, `K6PERF_VUS=100`, `K6PERF_DURATION=2m`, `TARGET_ENV=uat`
  - Risultato atteso: 100 VU completano le 1000 iterazioni entro 120 secondi; se il tempo aumenta l'espansione a 1000 VU potrebbe non essere sostenibile.

- **Stress progressivo oltre la soglia (1000 -> 1200 richieste/s)**
  - Scenario: `ramping-arrival-rate`
  - Parametri consigliati: `K6PERF_TIME_UNIT=1s`, `K6PERF_PRE_ALLOCATED_VUS=1000`, `K6PERF_MAX_VUS=1300`, `TARGET_ENV=uat`
  - `K6PERF_STAGES`: `[{"duration":"4m","target":600},{"duration":"4m","target":1000},{"duration":"4m","target":1200}]`
  - Risultato atteso: individua il punto in cui il sistema inizia a degradare oltre la soglia di riferimento (1000 richieste/s), fornendo indicazioni sui trigger per meccanismi di autoscaling o throttling.

---
