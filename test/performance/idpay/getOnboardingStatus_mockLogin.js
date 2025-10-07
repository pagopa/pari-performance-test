// macOS usage examples (execute from the repository root)
//   Default CLI-driven scenario
//     TARGET_ENV=uat k6 run --vus 50 --duration 1m ./test/pdv/pdvPerformance.js
//   Custom scenario via env
//     TARGET_ENV=uat K6_SCENARIO_TYPE=constant-arrival-rate K6_RATE=300 K6_TIME_UNIT=500ms \
//     K6_VUS=200 K6_PRE_ALLOCATED_VUS=150 K6_MAX_VUS=300 k6 run ./test/pdv/pdvPerformance.js

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js'
import { check } from 'k6'
import { SharedArray } from 'k6/data'
import { getMockLogin } from '../../common/api/mockIOLogin.js'
import { getOnboardingStatus } from '../../common/api/onboardingStatus.js'
import {
    toPositiveNumber,
    toTrimmedString,
} from '../../common/basicUtils.js'
import { loadEnvConfig } from '../../common/loadEnv.js'
import {
    buildScenarioConfig,
    normalizeScenarioType,
} from '../../common/scenarioSetup.js'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'

const targetEnv = (__ENV.TARGET_ENV || 'dev').trim().toLowerCase()

const envConfig = loadEnvConfig(targetEnv)

const baseUrl = toTrimmedString(__ENV.APIM_URL, envConfig.apimUrl || '')
if (!baseUrl) {
    throw new Error(`Missing APIM_URL for environment: ${targetEnv}`)
}

// const scenarioType = normalizeScenarioType(__ENV.K6_SCENARIO_TYPE)
// const k6Duration = toTrimmedString(__ENV.K6_DURATION, '1m')
// const k6Iterations = toPositiveNumber(__ENV.K6_ITERATIONS) || 0
// const k6Vus = toPositiveNumber(__ENV.K6_VUS) || 50
// const k6Rate = toPositiveNumber(__ENV.K6_RATE) || 100
// const k6TimeUnit = toTrimmedString(__ENV.K6_TIME_UNIT, '1s')
// const k6MaxVus = toPositiveNumber(__ENV.K6_MAX_VUS) || k6Vus
// const k6PreAllocatedVus =
//     toPositiveNumber(__ENV.K6_PRE_ALLOCATED_VUS) || Math.min(k6Vus, k6MaxVus)
// const k6StartVus = Math.max(
//     1,
//     Math.min(k6MaxVus, toPositiveNumber(__ENV.K6_START_VUS) || k6Vus)
// )
// const k6StagesRaw = __ENV.K6_STAGES_JSON ?? __ENV.K6_STAGES

// const scenario = buildScenarioConfig(scenarioType, {
//     duration: k6Duration,
//     iterations: k6Iterations,
//     vus: k6Vus,
//     rate: k6Rate,
//     timeUnit: k6TimeUnit,
//     preAllocatedVUs: k6PreAllocatedVus,
//     maxVUs: k6MaxVus,
//     startVUs: k6StartVus,
//     stagesRaw: k6StagesRaw,
// })

// const testOptions = {
//     // thresholds: {
//     //     checks: ['rate>0.99'],
//     // },
// }

// if (scenario) {
//     testOptions.scenarios = {
//         default: scenario,
//     }
// }

// export const options = testOptions

export const options = {
  scenarios: {
    onboardingStatus: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 10,
      maxVUs: 30,
    },
  },
  thresholds: {
    // Esempio di soglia: meno dell'1% delle richieste deve fallire.
    http_req_failed: ['rate<0.01'],
    // Esempio di soglia: il 95% delle richieste deve completarsi in meno di 500ms.
    http_req_duration: ['p(95)<500'],
  },
};

export function handleSummary(data) {
    return {
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
        [outputHtmlSummaryFile]: htmlReport(data),
    }
}

const initiativeId = '68de7fc681ce9e35a476e985'

// Load the list of 10K CFs from a CSV file
const fiscalCodes = new SharedArray('fiscalCodes', () => {
    const csv = open('../../../assets/fc_list_10k.csv');
    console.log('loading csv file with fiscal codes')
    return csv.split('\n')
        .map(line => line.trim())
        .filter(line => line && line !== 'CF');
});

const tokenCache = new Map();

export default function () {
    const fc = fiscalCodes[Math.floor(Math.random() * fiscalCodes.length)];
    let token;
    // const token = data.tokenList[Math.floor(Math.random() * data.tokenList.length)]

    // Controlla se il token per questo CF è già in cache
    if (tokenCache.has(fc)) {
        token = tokenCache.get(fc);
    } else {
        // Se non è in cache, genera un nuovo token
        const res = getMockLogin(fc);

        // Controlla se la generazione del token ha avuto successo
        if (res.status !== 200 || !res.body) {
            console.error(`Failed to get token for fiscal code ${fc}. Status: ${res.status}`);
            // Interrompi questa iterazione se non riusciamo a ottenere il token
            return;
        }

        token = res.body;
        // Salva il nuovo token nella cache per usi futuri
        tokenCache.set(fc, token);
    }

    const res = getOnboardingStatus(baseUrl, initiativeId, token, [200, 404]);

    check(res, {
        'is OK': (r) => r.status === 200 || r.status === 404,
        'body is not empty': (r) => r.body && r.body.length > 0,
        'body is a json': (r) => {
            try {
                JSON.parse(r.body)
                return true
            } catch (e) {
                console.error(`Failed to parse JSON for token [...${token.slice(-10)}]: ${r.body}`)
                return false
            }
        },
    })
}

// K6_SCENARIO_TYPE=constant-arrival-rate K6_TIME_UNIT=1s TARGET_ENV=uat K6_VUS=2 K6_DURATION=10s K6_RATE=10 K6_PRE_ALLOCATED_VUS=1 python3 .devops/scripts/run_k6.py --script  test/performance/idpay/getOnboardingStatus_mockLogin.js
