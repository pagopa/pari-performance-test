import { check, group } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { SharedArray } from 'k6/data';

import { saveOnboarding } from '../../common/api/onboardingClient.js';
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

/** Scenario configuration and logger. */
const { scenarioConfig, logScenario } = prepareScenario({ env: __ENV });

export const options = {
  discardResponseBodies: true,
  scenarios: {
    saveOnboarding: scenarioConfig,
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

const INITIATIVE_ID = '68de7fc681ce9e35a476e985';

 // Prepare payload for saveOnboarding
  const payload = {
    initiativeId: INITIATIVE_ID,
    confirmedTos: true,
    pdndAccept: true,
    selfDeclarationList: [
      { "_type": "multi_consent", "code": "isee", "value": "3" },
      { "_type": "boolean", "code": "1", "accepted": true },
    ]
  };

  const fiscalCodes = new SharedArray('fiscalCodes', () => {
    const csv = open('../../../assets/fc_list_10k.csv');
    return csv
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line !== 'CF');
  });

/**
 * Main test entry point — retrieves initiative detail by Initiative ID.
 */
export default function () {
  const fiscalCode = fiscalCodes[Math.floor(Math.random() * fiscalCodes.length)];

  // Get a mock IO token for the selected user.
  const tokenIO = getMockLogin(fiscalCode).body;

  // Grouped metrics for clear visualization in k6 reports.
  group('Onboarding API → Save Onboarding', () => {
    const res = saveOnboarding(baseUrl, tokenIO, payload);

    check(res, {
      '✅ Response status is 202': (r) => r.status === 202
    });
  });
}
