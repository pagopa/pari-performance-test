import { htmlReport, textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';
import { getMockLogin } from '../../common/api/mockIOLogin.js';
import { saveOnboarding } from '../../common/api/onboardingClient.js';
import { getOnboardingStatus } from '../../common/api/onboardingStatus.js';
import {
  toPositiveNumber,
  toTrimmedString,
} from '../../common/basicUtils.js';
import { loadEnvConfig } from '../../common/loadEnv.js';
import {
  buildScenarioConfig,
  normalizeScenarioType,
} from '../../common/scenarioSetup.js';

// Load the list of 10M CFs from a CSV file
const fiscalCodes = new SharedArray('fiscalCodes', () => {
  const csv = open('../../../assets/fc_list_10M.csv');
  return csv.split('\n')
    .map(line => line.trim())
    .filter(line => line && line !== 'CF');
});

const scenarioType = normalizeScenarioType(__ENV.K6_SCENARIO_TYPE)
const k6Duration = toTrimmedString(__ENV.K6_DURATION, '1m')
const k6Iterations = toPositiveNumber(__ENV.K6_ITERATIONS) || 0
const k6Vus = toPositiveNumber(__ENV.K6_VUS) || 50
const k6Rate = toPositiveNumber(__ENV.K6_RATE) || 100
const k6TimeUnit = toTrimmedString(__ENV.K6_TIME_UNIT, '1s')
const k6MaxVus = toPositiveNumber(__ENV.K6_MAX_VUS) || k6Vus
const k6PreAllocatedVus =
  toPositiveNumber(__ENV.K6_PRE_ALLOCATED_VUS) || Math.min(k6Vus, k6MaxVus)
const k6StartVus = Math.max(
  1,
  Math.min(k6MaxVus, toPositiveNumber(__ENV.K6_START_VUS) || k6Vus)
)
const k6StagesRaw = __ENV.K6_STAGES_JSON ?? __ENV.K6_STAGES

const scenario = buildScenarioConfig(scenarioType, {
  duration: k6Duration,
  iterations: k6Iterations,
  vus: k6Vus,
  rate: k6Rate,
  timeUnit: k6TimeUnit,
  preAllocatedVUs: k6PreAllocatedVus,
  maxVUs: k6MaxVus,
  startVUs: k6StartVus,
  stagesRaw: k6StagesRaw,
})

const testOptions = {
  thresholds: {
    checks: ['rate>0.99'],
  },
}

if (scenario) {
  testOptions.scenarios = {
    pdv: scenario,
  }
}

export const options = testOptions

const targetEnv = (__ENV.TARGET_ENV || 'dev').trim().toLowerCase()
const envConfig = loadEnvConfig(targetEnv)

const baseUrl = toTrimmedString(__ENV.APIM_URL, envConfig.apimUrl || '')
if (!baseUrl) {
  throw new Error(`Missing APIM_URL for environment: ${targetEnv}`)
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true })
  };
}

const initiativeId = '68de7fc681ce9e35a476e985'
const startIndex = 1000000;

export default function () {

  // Get a unique fiscal code for this iteration
  // const index = startIndex + __ITER;
  // Aggiungiamo l'indice usato alla nostra metrica custom
  // Questo è un modo a prova di race condition per vedere cosa è successo
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
