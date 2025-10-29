import { check, group } from 'k6';
import { Counter } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

import { fetchUserInitiatives } from '../../common/api/onboardingClient.js';
import { getMockLogin } from '../../common/api/mockIOLogin.js';
import { loadEnvConfig } from '../../common/loadEnv.js';
import { prepareScenario } from '../../common/scenarioSetup.js';
import { toTrimmedString } from '../../common/basicUtils.js';
import { loadCsvArray } from '../../common/loadCsvArray.js';

// --- CONFIGURAZIONE AMBIENTE ---
const targetEnv = (__ENV.TARGET_ENV || 'dev').trim().toLowerCase();
const envConfig = loadEnvConfig(targetEnv);
const baseUrl = toTrimmedString(__ENV.APIM_URL, envConfig.apimUrl || '');

if (!baseUrl) {
  throw new Error(`Missing APIM_URL for environment: ${targetEnv}`);
}

const { scenarioConfig, logScenario } = prepareScenario({ env: __ENV });

export const options = {
  discardResponseBodies: true,
  scenarios: {
    fetchUserInitiatives: scenarioConfig,
  },
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% delle richieste < 500ms
  },
};

// --- REPORT ---
export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [`report-${Date.now()}.html`]: htmlReport(data),
  };
}

export function setup() {
  logScenario();
}

// --- COUNTERS ---
const fetchUserInitiativesOk_Counter = new Counter('_fetchUserInitiatives_ok');
const fetchUserInitiativesKo_Counter = new Counter('_fetchUserInitiatives_ko');
const mockLoginCounter = new Counter('_mock_login_succeeded');

// --- CARICAMENTO CSV ---
const csvFile = __ENV.FISCAL_CODE_FILE || '../../../assets/fc_list_100k.csv';
const fiscalCodes = loadCsvArray('fiscalCodes', csvFile);

// --- TEST PRINCIPALE ---
export default function () {
  if (!fiscalCodes || fiscalCodes.length === 0) {
    throw new Error(`La lista dei codici fiscali è vuota. File letto: ${csvFile}`);
  }

  // Seleziona un codice fiscale casuale
  const fiscalCode = fiscalCodes[Math.floor(Math.random() * fiscalCodes.length)];

  // Login mock
  const { token, ok } = getMockLogin(fiscalCode);
  if (!ok || !token) {
    return;
  }

  mockLoginCounter.add(1);

  group('Onboarding API → Retrieve Initiatives by User', () => {
    const { res, ok: isOk } = fetchUserInitiatives(baseUrl, token);

    if (isOk) {
      fetchUserInitiativesOk_Counter.add(1);
    } else {
      fetchUserInitiativesKo_Counter.add(1);
    }

    check(res, {
      '✅ fetchUserInitiatives status 200': (r) => r.status === 200,
      '📦 fetchUserInitiatives body not empty': (r) => !!r.body && r.body.length > 0,
    });
  });
}

// ESEMPIO DI ESECUZIONE:
// ./k6 run -e K6PERF_SCENARIO_TYPE="constant-arrival-rate" -e K6PERF_TIME_UNIT="1s" -e K6PERF_PRE_ALLOCATED_VUS="10" -e K6PERF_MAX_VUS="20" -e K6PERF_RATE="1" -e K6PERF_DURATION="1s" -e TARGET_ENV="uat" -e FISCAL_CODE_FILE="../../../assets/fc_list_100k.csv" .\test\performance\idpay\getInitiativesUser.js