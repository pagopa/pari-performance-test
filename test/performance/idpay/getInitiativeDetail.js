import { check, group } from 'k6';
import { Counter } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

import { fetchInitiativeDetail } from '../../common/api/onboardingClient.js';
import { getMockLogin } from '../../common/api/mockIOLogin.js';
import { loadEnvConfig } from '../../common/loadEnv.js';
import { prepareScenario } from '../../common/scenarioSetup.js';
import { loadCsvArray } from '../../common/loadCsvArray.js';
import { toTrimmedString } from '../../common/basicUtils.js';

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
    fetchInitiativeDetail: scenarioConfig,
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

/** Setup */
export function setup() {
  logScenario();
}

/** Counters */
const fetchDetailOk_Counter = new Counter('_fetchInitiativeDetail_ok');
const fetchDetailKo_Counter = new Counter('_fetchInitiativeDetail_ko');
const mockLoginCounter = new Counter('_mock_login_succeeded');

/** Parametri */
const INITIATIVE_ID = __ENV.INITIATIVE_ID || '68de7fc681ce9e35a476e985';

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

  // Group per report k6 chiaro
  group('Onboarding API → Retrieve Initiative by Initiative ID', () => {
    // Il client ritorna { res, ok, isOk } e gestisce anche 400/404 attesi
    const { res, ok: overallOk } = fetchInitiativeDetail(baseUrl, token, INITIATIVE_ID);

    (overallOk ? fetchDetailOk_Counter : fetchDetailKo_Counter).add(1);

    check(res, {
      '✅ Response status is 200': (r) => r && r.status === 200,
      '📦 Response body is not empty': (r) => r && !!r.body && r.body.length > 0,
    });
  });
}

// ./k6 run -e K6PERF_SCENARIO_TYPE="constant-arrival-rate" -e K6PERF_TIME_UNIT="1s" -e K6PERF_PRE_ALLOCATED_VUS="10" -e K6PERF_MAX_VUS="20" -e K6PERF_RATE="1" -e K6PERF_DURATION="1s" -e TARGET_ENV="uat" -e FISCAL_CODE_FILE="../../../assets/fc_list_100k.csv" -e INITIATIVE_ID="68de7fc681ce9e35a476e985" .\test\performance\idpay\getInitiativeDetail.js