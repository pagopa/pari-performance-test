import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

import { check } from 'k6';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';
import { getMockLogin } from '../../common/api/mockIOLogin.js';
import { getOnboardingStatus, saveOnboarding } from '../../common/api/onboardingClient.js';
import {
  toTrimmedString
} from '../../common/basicUtils.js';
import { loadEnvConfig } from '../../common/loadEnv.js';
import { prepareScenario } from '../../common/scenarioSetup.js';

// Load the list of 100K CFs from a CSV file
const fiscalCodes = new SharedArray('fiscalCodes', () => {
  const csv = open('../../../assets/fc_list_100k_2.csv');
  return csv.split('\n')
    .map(line => line.trim())
    .filter(line => line && line !== 'CF');
});

const targetEnv = (__ENV.TARGET_ENV || 'dev').trim().toLowerCase()

const envConfig = loadEnvConfig(targetEnv)

const baseUrl = toTrimmedString(__ENV.APIM_URL, envConfig.apimUrl || '')
if (!baseUrl) {
  throw new Error(`Missing APIM_URL for environment: ${targetEnv}`)
}

const { scenarioConfig, logScenario } = prepareScenario({ env: __ENV })

export const options = {
  discardResponseBodies: true,
  scenarios: {
    onboardingStatus: scenarioConfig,
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [`report-onboard-${new Date().getTime()}.html`]: htmlReport(data),
  }
}

export function setup() {
  logScenario()
}

const initiativeId = '68de7fc681ce9e35a476e985'
const startIndex = 0;

export default function () {

  // Get a unique fiscal code for this iteration
  // const index = startIndex + __ITER;
  // da rivedere
  const index = startIndex + exec.scenario.iterationInTest;
  // let index = Math.trunc((startIndex / __VU) + __ITER)
  const fiscalCode = fiscalCodes[index]
  // console.log(`VU: ${__VU}, ITER: ${__ITER}, Fiscal Code: ${fiscalCode}`)

  if (!fiscalCode) {
    console.error(`Indice ${index} fuori dai limiti. L'iterazione si ferma.`);
    return;
  }

  // Generate token using mockIOLogin
  const tokenResponse = getMockLogin(fiscalCode);
  const tokenOk = check(tokenResponse, {
    '1. getMockLogin: status is 200': (r) => r.status === 200,
  });

  if (!tokenOk) {
    return;
  }
  const token = tokenResponse.body;

  // call the onboarding status first to ensure the user is not already onboarded
  const statusResponse = getOnboardingStatus(baseUrl, initiativeId, token);
  const canOnboard = check(statusResponse, {
    '2. getOnboardingStatus: status is 404 (user not onboarded)': (r) => r.status === 404,
  });

  // Se l'utente non è in stato 404, interrompi l'iterazione in modo pulito
  if (!canOnboard) {
    return;
  }

  // Prepare payload for saveOnboarding
  const payload = {
    initiativeId: initiativeId,
    confirmedTos: true,
    pdndAccept: true,
    selfDeclarationList: [
      { "_type": "multi_consent", "code": "isee", "value": "3" },
      { "_type": "boolean", "code": "1", "accepted": true },
    ]
  };

  const response = saveOnboarding(baseUrl, token, payload);
  // console.log(`Onboarding successful for CF: ${fiscalCode}, index: ${__ITER}`);
  check(response, {
    [`3. saveOnboarding: status is 202`]: (r) => r.status === 202, // Or 200, depending on your API
  });

  // console.error(`Onboarding failed for CF: ${fiscalCode} - ${error.message}`);

}

// K6PERF_SCENARIO_TYPE=shared-iterations TARGET_ENV=uat K6PERF_VUS=1 K6PERF_ITERATIONS=1 ./xk6 run test/performance/idpay/onboardingTest.js
