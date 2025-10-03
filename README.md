# pari-performance-test - Guida alla pipeline k6

Repository dedicato ai test di performance della piattaforma "computerized list of household appliances".

Questa guida descrive come utilizzare la pipeline Azure DevOps definita in `.devops/k6-performance-generic.yml`. Tutte le variabili e gli esempi fanno riferimento a quella pipeline e allo script di orchestrazione `.devops/scripts/run_k6.py`.

## Panoramica del progetto

- **Build**: la pipeline compila il binario personalizzato `xk6` (template `templates/xk6-build.yml`) solo quando la cache è assente, così i run successivi riutilizzano l'eseguibile e i risultati restano confrontabili tra ambienti.
- **Esecuzione**: ogni percorso elencato nella variabile `SCRIPTS_TO_EXECUTE` viene lanciato tramite `python3 .devops/scripts/run_k6.py`, che convalida i parametri, prepara le variabili di ambiente e costruisce la chiamata `./xk6 run` coerente con lo scenario selezionato.
- **Risultati**: la cartella `results/` contiene gli output aggregati e viene pubblicata come artifact a fine job per analisi successive o per estrazioni manuali.

## Flusso della pipeline di riferimento

1. Il job `xk6Build` (template `templates/xk6-build.yml`) compila `xk6` e memorizza i binari nella cache condivisa (`$(xk6CacheKey)`).
2. Il job `PerformanceTest` seleziona l'agent pool in base a `TARGET_ENV` (`dev`, `uat`, `prod`) e prepara l'ambiente di esecuzione.
3. Per ogni script elencato in `SCRIPTS_TO_EXECUTE` viene eseguito `python3 .devops/scripts/run_k6.py --script <percorso>`, alimentato dai parametri dichiarati nel file di pipeline.
4. Al termine, la directory `results/` viene pubblicata tramite `PublishPipelineArtifact@1`.

## Catalogo dei parametri (ordine come nella pipeline Azure DevOps)

> Regola generale: i valori numerici pari a 0 (`0`, `0s`, `0.0`) disattivano il parametro corrispondente. Lo script `.devops/scripts/run_k6.py` interrompe l'esecuzione quando uno scenario non riceve i requisiti minimi, prevenendo run con carichi errati.

| Parametro              | Descrizione                                                                                 | Obbligatorio per                                                                                           | Ignorato quando                                               | Note pratiche                                                                                                                             | Errori / conflitti                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `K6_SCRIPT_PATH`       | Percorso relativo allo script k6 da eseguire.                                               | Tutti gli scenari.                                                                                         | Mai.                                                          | Deve esistere nel repository; se il file non viene trovato il job fallisce.                                                              | Nessuno.                                                                                                    |
| `TARGET_ENV`           | Ambiente di destinazione (configurazione URL, credenziali, agent pool).                     | Tutti gli scenari.                                                                                         | Mai.                                                          | Valori ammessi: `dev`, `uat`, `prod`. Controlla i tag usati nei report.                                                                   | Nessuno.                                                                                                    |
| `K6_SCENARIO_TYPE`     | Executor k6 da utilizzare.                                                                  | Tutti gli scenari.                                                                                         | Mai.                                                          | Valori ammessi: `manual`, `shared-iterations`, `per-vu-iterations`, `constant-vus`, `ramping-vus`, `constant-arrival-rate`, `ramping-arrival-rate`. | Se il valore non è nella lista, lo script termina con errore.                                              |
| `K6_STAGES`            | Sequenza di rampe (lista di oggetti `{duration,target}`).                                   | `ramping-vus`, `ramping-arrival-rate`.                                                                     | Tutti gli altri scenari.                                      | Può essere impostato come array YAML nella pipeline; lo script lo converte automaticamente in JSON e in flag `--stage`.                  | Fornire `K6_STAGES` senza scenario ramping genera un avviso di ignorato.                                   |
| `K6_DURATION`          | Durata complessiva del test (flag `--duration`).                                            | `manual` (se non si usano iterazioni), `constant-vus`, `constant-arrival-rate` e come fallback per i ramping. | Ignorato se gli stage coprono l'intera timeline.              | Utile come kill switch di sicurezza anche quando non strettamente necessario.                                                           | Se mancante per uno scenario che lo richiede, lo script esce con errore.                                  |
| `K6_VUS`               | Numero di virtual user da mantenere attivi.                                                 | `manual`, `shared-iterations`, `per-vu-iterations`, `constant-vus`.                                         | Scenari a tasso di arrivo.                                   | Definisce la concorrenza base; per run locali usare valori moderati prima di crescere.                                                   | Incompatibile con `K6_ITERATIONS` negli scenari `constant-vus` (errore).                                   |
| `K6_MAX_VUS`           | Limite superiore di virtual user che k6 può allocare.                                      | `constant-arrival-rate`, `ramping-arrival-rate`.                                                            | Scenari basati su VU.                                         | Deve essere maggiore o uguale a `K6_PRE_ALLOCATED_VUS`; fornisce margine per autoscaling.                                               | Se inferiore a `K6_PRE_ALLOCATED_VUS`, lo script blocca l'esecuzione.                                      |
| `K6_PRE_ALLOCATED_VUS` | Pool iniziale di virtual user riservati.                                                    | `constant-arrival-rate`, `ramping-arrival-rate`.                                                            | Scenari VU-based e iteration-based.                           | Impostare un valore leggermente superiore al throughput atteso per evitare warning `insufficient VUs`.                                   | Se rimane 0 in uno scenario a tasso di arrivo, il job fallisce.                                            |
| `K6_START_VUS`         | Numero di virtual user da cui parte la rampa.                                              | `ramping-vus`.                                                                                              | Tutti gli altri scenari.                                      | Deve essere coerente con il primo elemento di `K6_STAGES`.                                                                               | Mancanza o valore 0 causa errore di validazione.                                                           |
| `K6_RATE`              | Iterazioni per unità di tempo.                                                              | `constant-arrival-rate`.                                                                                   | VU-based e iteration-based; negli scenari ramping-arrival-rate prevalgono i target degli stage. | Usare insieme a `K6_TIME_UNIT`; lasciare 0 quando le rampe definiscono interamente il carico.                                           | Valori >0 in scenari non a tasso di arrivo vengono ignorati.                                               |
| `K6_TIME_UNIT`         | Unità di tempo per interpretare `K6_RATE` o gli stage a tasso di arrivo.                    | `constant-arrival-rate`, `ramping-arrival-rate`.                                                            | Scenari VU-based e iteration-based.                           | Valori tipici: `1s`, `500ms`.                                                                                                            | Se omesso in scenari a tasso di arrivo, il job fallisce.                                                   |
| `K6_RPS`               | Limite globale alle richieste al secondo.                                                   | Nessuno (opzionale).                                                                                        | Mai (0 equivale a illimitato).                               | Agisce come safety net per proteggere ambienti condivisi.                                                                                | Se impostato troppo basso può troncare il test prima del previsto.                                       |
| `K6_ITERATIONS`        | Numero totale di iterazioni da completare.                                                  | `shared-iterations`, `per-vu-iterations`, e opzionalmente `manual`.                                         | `constant-vus`, `ramping-vus`, `constant-arrival-rate`, `ramping-arrival-rate`. | In `per-vu-iterations` ogni VU esegue `K6_ITERATIONS / K6_VUS`.                                                                            | Valori >0 in scenari non supportati generano un errore.                                                   |

### Regole di esclusione e precedenza

- **Scenari a iterazioni** (`shared-iterations`, `per-vu-iterations`): richiedono `K6_ITERATIONS` e `K6_VUS`; ignorano `K6_RATE`, `K6_TIME_UNIT` e `K6_STAGES`.
- **Scenari basati sui VU** (`manual`, `constant-vus`, `ramping-vus`): utilizzano `K6_VUS`; nelle rampe sono obbligatori `K6_START_VUS` e `K6_STAGES`. `K6_MAX_VUS` e `K6_PRE_ALLOCATED_VUS` vengono rimossi.
- **Scenari a tasso di arrivo** (`constant-arrival-rate`, `ramping-arrival-rate`): richiedono `K6_PRE_ALLOCATED_VUS` e `K6_MAX_VUS`, ignorano `K6_VUS`.
- `K6_RPS` è indipendente e applicabile a qualunque scenario.

## Catalogo degli scenari con esempi numerici

- **manual**
  - **Obiettivo**: eseguire rapidamente uno script senza affidarsi a un executor k6 predefinito, utile per debug locale o verifiche preliminari.
  - **Parametri minimi**: `K6_SCENARIO_TYPE=manual`, `K6_VUS>0`, più `K6_DURATION` o `K6_ITERATIONS`.
  - **Esempio**: `TARGET_ENV=uat K6_SCENARIO_TYPE=manual K6_VUS=50 K6_DURATION=2m python3 .devops/scripts/run_k6.py --script test/performance/pdv/pdvPerformance.js`.

- **shared-iterations**
  - **Obiettivo**: misurare quanto rapidamente un gruppo di VU completa un numero fisso di transazioni, evidenziando regressioni di throughput o latenza.
  - **Parametri minimi**: `K6_SCENARIO_TYPE=shared-iterations`, `K6_ITERATIONS>0`, `K6_VUS>0`; `K6_DURATION` rimane un limite di sicurezza.
  - **Esempio**: `TARGET_ENV=uat K6_SCENARIO_TYPE=shared-iterations K6_ITERATIONS=20000 K6_VUS=100 K6_DURATION=10m python3 .devops/scripts/run_k6.py --script test/performance/pdv/pdvPerformance.js`.

- **per-vu-iterations**
  - **Obiettivo**: assicurare che ogni VU ripeta lo stesso volume di iterazioni, facendo emergere problemi che compaiono dopo il warm-up o con cache per-utente.
  - **Parametri minimi**: `K6_SCENARIO_TYPE=per-vu-iterations`, `K6_ITERATIONS>0`, `K6_VUS>0`, `K6_DURATION` come guard rail.
  - **Esempio**: `TARGET_ENV=uat K6_SCENARIO_TYPE=per-vu-iterations K6_ITERATIONS=10000 K6_VUS=100 K6_DURATION=10m python3 .devops/scripts/run_k6.py --script test/performance/pdv/pdvPerformance.js`.

- **constant-vus**
  - **Obiettivo**: mantenere costante la concorrenza per osservare lo steady state dell'applicazione o eseguire soak test brevi.
  - **Parametri minimi**: `K6_SCENARIO_TYPE=constant-vus`, `K6_VUS>0`, `K6_DURATION`; `K6_RPS` opzionale come limite superiore.
  - **Esempio**: `TARGET_ENV=uat K6_SCENARIO_TYPE=constant-vus K6_VUS=1000 K6_DURATION=10m K6_RPS=5000 python3 .devops/scripts/run_k6.py --script test/performance/pdv/pdvPerformance.js`.

- **ramping-vus**
  - **Obiettivo**: modellare una crescita o una riduzione controllata del numero di VU attivi.
  - **Parametri minimi**: `K6_SCENARIO_TYPE=ramping-vus`, `K6_START_VUS>0`, `K6_STAGES` con coppie `duration`/`target`; `K6_DURATION` facoltativo.
  - **Esempio**: `TARGET_ENV=uat K6_SCENARIO_TYPE=ramping-vus K6_START_VUS=100 K6_STAGES='[{"duration":"3m","target":100},{"duration":"4m","target":1000},{"duration":"3m","target":0}]' python3 .devops/scripts/run_k6.py --script test/performance/pdv/pdvPerformance.js`.

- **constant-arrival-rate**
  - **Obiettivo**: mantenere costante il numero di iterazioni per unità di tempo, indipendentemente dal tempo che ogni VU impiega a completarle.
  - **Parametri minimi**: `K6_SCENARIO_TYPE=constant-arrival-rate`, `K6_RATE>0`, `K6_TIME_UNIT`, `K6_PRE_ALLOCATED_VUS>0`, `K6_MAX_VUS>=K6_PRE_ALLOCATED_VUS`, `K6_DURATION`.
  - **Esempio**: `TARGET_ENV=uat K6_SCENARIO_TYPE=constant-arrival-rate K6_RATE=400 K6_TIME_UNIT=1s K6_PRE_ALLOCATED_VUS=100 K6_MAX_VUS=1000 K6_DURATION=10m python3 .devops/scripts/run_k6.py --script test/performance/pdv/pdvPerformance.js`.

- **ramping-arrival-rate**
  - **Obiettivo**: variare il tasso di arrivo per simulare lanci progressivi o picchi improvvisi, consentendo a k6 di espandere il pool.
  - **Parametri minimi**: `K6_SCENARIO_TYPE=ramping-arrival-rate`, `K6_STAGES` con target di arrivo, `K6_TIME_UNIT`, `K6_PRE_ALLOCATED_VUS>0`, `K6_MAX_VUS>0`.
  - **Esempio**: `TARGET_ENV=uat K6_SCENARIO_TYPE=ramping-arrival-rate K6_STAGES='[{"duration":"2m","target":100},{"duration":"5m","target":1000},{"duration":"3m","target":1000}]' K6_TIME_UNIT=1s K6_PRE_ALLOCATED_VUS=100 K6_MAX_VUS=1000 python3 .devops/scripts/run_k6.py --script test/performance/pdv/pdvPerformance.js`.

## Playbook di configurazione della pipeline

- **Piatto stabile a 1000 VU per 10 minuti**
  - Scenario: `constant-vus`
  - Parametri consigliati: `K6_VUS=1000`, `K6_DURATION=10m`, `K6_RPS=5000` (opzionale), `TARGET_ENV=uat`
  - Risultato atteso: verifica che l'ambiente sostenga 1000 utenti virtuali simultanei per tutta la durata, mantenendo latenza e errori entro le soglie definite.

- **Rampa controllata 100 -> 1000 VU in 10 minuti**
  - Scenario: `ramping-vus`
  - Parametri consigliati: `K6_START_VUS=100`, `TARGET_ENV=uat`; lasciare `K6_DURATION` disattivato (0s) così la durata totale coincide con la somma degli stage
  - `K6_STAGES`:
    ```yaml
    - duration: 3m
      target: 100
    - duration: 4m
      target: 1000
    - duration: 3m
      target: 0
    ```
  - Risultato atteso: osserva come il sistema scala mentre la concorrenza cresce fino a 1000 VU e poi torna a zero in modo controllato.

- **Spike improvviso a 1000 richieste/s sostenuto per 8 minuti**
  - Scenario: `ramping-arrival-rate`
  - Parametri consigliati: `K6_TIME_UNIT=1s`, `K6_PRE_ALLOCATED_VUS=1000`, `K6_MAX_VUS=1000`, `K6_RPS=5000`, `TARGET_ENV=uat`
  - `K6_STAGES`:
    ```yaml
    - duration: 1m
      target: 100
    - duration: 1m
      target: 1000
    - duration: 8m
      target: 1000
    ```
  - Risultato atteso: valida la resilienza del sistema quando il carico passa da 100 a 1000 richieste al secondo in modo repentino e rimane al picco.

- **Plateau costante a 1000 richieste/s per 15 minuti**
  - Scenario: `constant-arrival-rate`
  - Parametri consigliati: `K6_RATE=1000`, `K6_TIME_UNIT=1s`, `K6_PRE_ALLOCATED_VUS=900`, `K6_MAX_VUS=1200`, `K6_DURATION=15m`, `TARGET_ENV=uat`
  - Risultato atteso: conferma che l'infrastruttura mantiene 1000 iterazioni al secondo con sufficiente margine di VU per assorbire code e ritardi temporanei.

- **Smoke test di throughput (1000 iterazioni entro 2 minuti)**
  - Scenario: `shared-iterations`
  - Parametri consigliati: `K6_ITERATIONS=1000`, `K6_VUS=100`, `K6_DURATION=2m`, `TARGET_ENV=uat`
  - Risultato atteso: 100 VU completano le 1000 iterazioni entro 120 secondi; se il tempo aumenta l'espansione a 1000 VU potrebbe non essere sostenibile.

- **Stress progressivo oltre la soglia (1000 -> 1200 richieste/s)**
  - Scenario: `ramping-arrival-rate`
  - Parametri consigliati: `K6_TIME_UNIT=1s`, `K6_PRE_ALLOCATED_VUS=1000`, `K6_MAX_VUS=1300`, `TARGET_ENV=uat`
  - `K6_STAGES`:
    ```yaml
    - duration: 4m
      target: 600
    - duration: 4m
      target: 1000
    - duration: 4m
      target: 1200
    ```
  - Risultato atteso: individua il punto in cui il sistema inizia a degradare oltre la soglia di riferimento (1000 richieste/s), fornendo indicazioni sui trigger per meccanismi di autoscaling o throttling.

---
