import { check, group } from 'k6';
import { SharedArray } from 'k6/data';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

import { fetchInitiativeByServiceId } from '../../common/api/onboardingClient.js';
import { getMockLogin } from '../../common/api/mockIOLogin.js';
import { loadEnvConfig } from '../../common/loadEnv.js';
import { prepareScenario } from '../../common/scenarioSetup.js';
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

/** Shared fiscal codes dataset (10k CF onboarded). */
const fiscalCodes = new SharedArray('fiscalCodes', () => {
  const csv = open('../../../assets/fc_list_10k.csv');
  return csv
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && line !== 'CF');
});

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

const SERVICE_ID = '01K6JJB7W6B6F1W31EHDS9JP3Z';

/**
 * Main test entry point — retrieves initiative detail by Service ID.
 */
export default function () {
  // Pick a random onboarded fiscal code.
  const fiscalCode = fiscalCodes[Math.floor(Math.random() * fiscalCodes.length)];

  // Get a mock IO token for the selected user.
  const tokenIO = getMockLogin(fiscalCode).body;

  // Grouped metrics for clear visualization in k6 reports.
  group('Onboarding API → Retrieve Initiative by Service ID', () => {
    const res = fetchInitiativeByServiceId(baseUrl, tokenIO, SERVICE_ID);

    check(res, {
      '✅ Response status is 200': (r) => r.status === 200,
      '📦 Response body is not empty': (r) => !!r.body && r.body.length > 0,
    });
  });
}
