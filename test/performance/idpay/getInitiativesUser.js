import { check, group } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

import { fetchUserInitiatives } from '../../common/api/onboardingClient.js';
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
    http_req_duration: ['p(95)<500'], // 95% delle richieste < 500ms
  },
};

/**
 * Generates summary reports (stdout + HTML).
 * @param {Object} data - k6 summary metrics.
 * @returns {Object} Report outputs.
 */
export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [`report-${Date.now()}.html`]: htmlReport(data),
  };
}

/**
 * Setup function for scenario logging.
 */
export function setup() {
  logScenario();
}

// 🔹 Legge il nome file CSV dall’ambiente o usa un default
const csvFile = __ENV.FISCAL_CODE_FILE || '../../../assets/fc_list_100k.csv';

// 🔹 Carica i codici fiscali
const fiscalCodes = loadCsvArray('fiscalCodes', csvFile);

/**
 * Main test entry point — retrieves initiatives by User.
 */
export default function () {
  // Pick a random onboarded fiscal code.
  const fiscalCode = fiscalCodes[Math.floor(Math.random() * fiscalCodes.length)];

  // Get a mock IO token for the selected user.
  const tokenIO = getMockLogin(fiscalCode).body;

  // Grouped metrics for clear visualization in k6 reports.
  group('Onboarding API → Retrieve Initiatives by User', () => {
    const res = fetchUserInitiatives(baseUrl, tokenIO);

    check(res, {
      '✅ Response status is 200': (r) => r.status === 200,
    });
  });
}

// ./k6 run -e K6PERF_SCENARIO_TYPE="constant-arrival-rate" -e K6PERF_TIME_UNIT="1s" -e K6PERF_PRE_ALLOCATED_VUS="10" -e K6PERF_MAX_VUS="20" -e K6PERF_RATE="1" -e K6PERF_DURATION="1s" -e TARGET_ENV="uat" -e FISCAL_CODE_FILE="../../../assets/fc_list_100k.csv" .\test\performance\idpay\getInitiativesUser.js