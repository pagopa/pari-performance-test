import { check, group } from 'k6';
import { Counter } from 'k6/metrics'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

import { getMockLogin } from '../../common/api/mockIOLogin.js';
import { loadEnvConfig } from '../../common/loadEnv.js';
import { prepareScenario } from '../../common/scenarioSetup.js';
import { toTrimmedString } from '../../common/basicUtils.js';
import { getOnboardingUserInitiativeStatus } from '../../common/api/onboardingClient.js';
import { loadCsvArray } from '../../common/loadCsvArray.js';
import { parseExpectedStatuses } from "../../common/utils.js";

const targetEnv = (__ENV.TARGET_ENV || 'dev').trim().toLowerCase();
const envConfig = loadEnvConfig(targetEnv);
const baseUrl = toTrimmedString(__ENV.APIM_URL, envConfig.apimUrl || '');
if (!baseUrl) throw new Error(`Missing APIM_URL for environment: ${targetEnv}`);

const { scenarioConfig, logScenario } = prepareScenario({ env: __ENV });

export const options = {
  discardResponseBodies: true,
  scenarios: { getOnboardingUserInitiativeStatus: scenarioConfig },
  thresholds: { http_req_duration: ['p(95)<500'] },
};

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [`report-${Date.now()}.html`]: htmlReport(data),
  };
}

export function setup() {
  logScenario();
}

// Counters
const statusOkCounter = new Counter("_getOnboardingUserInitiativeStatus_ok");
const statusErrorCounter = new Counter("_getOnboardingUserInitiativeStatus_Ko");
const mockLoginCounter = new Counter("_mock_login_succeeded");

// 🔹 Carica i codici fiscali
const csvFile = __ENV.FISCAL_CODE_FILE || '../../../assets/fc_list_100k.csv';
const fiscalCodes = loadCsvArray('fiscalCodes', csvFile);

// 🔹 Legge gli status di risposta che si aspetta dall’ambiente o usa un default
const EXPECTED_STATUSES = parseExpectedStatuses(__ENV.EXPECTED_STATUSES, [200]);

export default function () {
  const fiscalCode = fiscalCodes[Math.floor(Math.random() * fiscalCodes.length)];

    // Get a mock IO token for the selected user.
  const { token, ok } = getMockLogin(fiscalCode);

  if (!ok || !token) {
    return;
  }
  mockLoginCounter.add(1);

  group('Onboarding API → get User Initiative Status', () => {
    const res = getOnboardingUserInitiativeStatus(baseUrl, token);

    if (EXPECTED_STATUSES.includes(res.status)) {
      statusOkCounter.add(1);
    } else {
      statusErrorCounter.add(1);
    }

    check(res, {
      "✅ Response status is expected": (r) => EXPECTED_STATUSES.includes(r.status),
      "📦 Response body is not empty": r => !!r.body && r.body.length > 0,
    });
  });
}

// ./k6 run -e K6PERF_SCENARIO_TYPE="constant-arrival-rate" -e K6PERF_TIME_UNIT="1s" -e K6PERF_PRE_ALLOCATED_VUS="10" -e K6PERF_MAX_VUS="20" -e K6PERF_RATE="1" -e K6PERF_DURATION="1s" -e TARGET_ENV="uat" -e FISCAL_CODE_FILE="../../../assets/fc_list_100k.csv" -e EXPECTED_STATUSES="200" .\test\performance\idpay\getOnboardingUserInitiativeStatus_IO.js