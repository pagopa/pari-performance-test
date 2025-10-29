import { check, group } from 'k6';
import { Counter } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

import { fetchInitiativeByServiceId } from '../../common/api/onboardingClient.js';
import { getMockLogin } from '../../common/api/mockIOLogin.js';
import { loadEnvConfig } from '../../common/loadEnv.js';
import { prepareScenario } from '../../common/scenarioSetup.js';
import { toTrimmedString } from '../../common/basicUtils.js';
import { loadCsvArray } from '../../common/loadCsvArray.js';

/** Target environment (dev | uat | prod). */
const targetEnv = (__ENV.TARGET_ENV || 'dev').trim().toLowerCase();

/** Environment configuration. */
const envConfig = loadEnvConfig(targetEnv);

/** Base API URL (from env or config). */
const baseUrl = toTrimmedString(__ENV.APIM_URL, envConfig.apimUrl || '');
if (!baseUrl) {
  throw new Error(`Missing APIM_URL for environment: ${targetEnv}`);
}

/** Scenario configuration and logger. */
const { scenarioConfig, logScenario } = prepareScenario({ env: __ENV });

export const options = {
  discardResponseBodies: true,
  scenarios: {
    fetchInitiativeByServiceId: scenarioConfig,
  },
  thresholds: {
    // 95% delle richieste < 500ms
    http_req_duration: ['p(95)<500'],
  },
};

/** REPORT */
export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [`report-${Date.now()}.html`]: htmlReport(data),
  };
}

export function setup() {
  logScenario();
}

/** Counters */
const fetchByServiceOk_Counter = new Counter('_fetchInitiativeByServiceId_ok');
const fetchByServiceKo_Counter = new Counter('_fetchInitiativeByServiceId_ko');
const mockLoginCounter = new Counter('_mock_login_succeeded');

/** Parametri */
const SERVICE_ID = __ENV.SERVICE_ID || '01K6JJB7W6B6F1W31EHDS9JP3Z';

/** CSV */
const csvFile = __ENV.FISCAL_CODE_FILE || '../../../assets/fc_list_100k.csv';
const fiscalCodes = loadCsvArray('fiscalCodes', csvFile);

/** Main */
export default function () {
  if (!fiscalCodes || fiscalCodes.length === 0) {
    throw new Error(`La lista dei codici fiscali è vuota. File letto: ${csvFile}`);
  }

  // Pick a random fiscal code.
  const fiscalCode = fiscalCodes[Math.floor(Math.random() * fiscalCodes.length)];

  // Mock IO login
  const { token, ok } = getMockLogin(fiscalCode);
  if (!ok || !token) {
    // Iterazione “bruciata”: non inquina le metriche
    return;
  }
  mockLoginCounter.add(1);

  group('Onboarding API → Retrieve Initiative by Service ID', () => {
    // Il client ritorna { res, ok, isOk }
    const { res, ok: overallOk } = fetchInitiativeByServiceId(baseUrl, token, SERVICE_ID);

    (overallOk ? fetchByServiceOk_Counter : fetchByServiceKo_Counter).add(1);

    check(res, {
      '✅ Response status is 200': (r) => r && r.status === 200,
      '📦 Response body is not empty': (r) => r && !!r.body && r.body.length > 0,
    });
  });
}

// ./k6 run -e K6PERF_SCENARIO_TYPE="constant-arrival-rate" -e K6PERF_TIME_UNIT="1s" -e K6PERF_PRE_ALLOCATED_VUS="10" -e K6PERF_MAX_VUS="20" -e K6PERF_RATE="1" -e K6PERF_DURATION="1s" -e TARGET_ENV="uat" -e FISCAL_CODE_FILE="../../../assets/fc_list_100k.csv" .\test\performance\idpay\getInitiativeService.js