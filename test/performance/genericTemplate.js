import { check, group } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

import { loadEnvConfig } from '../../common/loadEnv.js';
import { prepareScenario } from '../../common/scenarioSetup.js';
import { toTrimmedString } from '../../common/basicUtils.js';

/**
 *  Ambiente da dove vengono prese le variabili di ENV (dev | uat | prod).
 *  Tale file viene caricato nel keyVault in ogni ambiente, qui è presente uno locale .env
 */
const targetEnv = (__ENV.TARGET_ENV || 'dev').trim().toLowerCase();

/**
 *  Recupero delle variabili di ambiente dal file.
 */
const envConfig = loadEnvConfig(targetEnv);

/**
 *  Settaggio dell'API URL dal file di env o config
 */
const baseUrl = toTrimmedString(__ENV.APIM_URL, envConfig.apimUrl || '');
if (!baseUrl) {
  throw new Error(`Missing APIM_URL for environment: ${targetEnv}`);
}

/**
 *  Lo scenario è la metodologia di test, di base lo scenario viene definito nello script di lancio o nella pipeline stesssa (K6PERF_SCENARIO_TYPE)
 *  export delle options può essere modificato secondo l'esigenze di test.
 */
const { scenarioConfig, logScenario } = prepareScenario({ env: __ENV });

export const options = {
  discardResponseBodies: true,
  scenarios: {
    testNameScenario: scenarioConfig,
  },
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% delle richieste < 500ms
  },
};

/**
 *  Genera i report a fine test.
 *  Generates summary reports (stdout + HTML).
 *  @param {Object} data - k6 summary metrics.
 *  @returns {Object} Report outputs.
 */
export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [`report-${Date.now()}.html`]: htmlReport(data),
  };
}

/**
 *  Setup function for scenario logging.
 */
export function setup() {
  logScenario();
}

/**
 *  Sezione per l'aggiunta di costanti specifiche per il caso di test.
 *  Potrebbe essere utile, come nel caso sotto, aggiungere tali costanti all'env
 *  per poter cambiare a runtime nell'esecuzione del test tali parametri
 */
const testConstant = __ENV.TEST_CONSTANT || 'default_test_constant_value';

/**
 *  Sezione per il richiamo di eventuali Utils esterne
 */

/**
 *  Funzione dove viene effettuala la logica per il test con conseguente richiamo dello specifico Client
 */
export default function () {

  // Grouped metrics for clear visualization in k6 reports.
  group('Test API → specific what this test doing', () => {
    const res = testNameScenario(baseUrl, testConstant);

    check(res, {
      '✅ Response status is 200': (r) => r.status === 200,
      '📦 Response body is not empty': (r) => !!r.body && r.body.length > 0,
    });
  });
}

/**
 *  Script di lancio per l'esecuzione in locale del test
 */

// ./k6 run -e K6PERF_SCENARIO_TYPE="constant-arrival-rate" -e K6PERF_TIME_UNIT="1s" -e K6PERF_PRE_ALLOCATED_VUS="10" -e K6PERF_MAX_VUS="20" -e K6PERF_RATE="1" -e K6PERF_DURATION="1s" -e TARGET_ENV="uat" -e TEST_CONSTANT="default_test_constant_value" .\test\performance\idpay\getInitiativeDetail.js