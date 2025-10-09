// macOS usage examples (execute from the repository root)
//   Default CLI-driven scenario
//     TARGET_ENV=uat k6 run --vus 50 --duration 1m ./test/pdv/pdvPerformance.js
//   Custom scenario via env
//     TARGET_ENV=uat K6PERF_K6PERF_TYPE=constant-arrival-rate K6PERF_RATE=300 K6PERF_TIME_UNIT=500ms \
//     K6PERF_VUS=200 K6PERF_PRE_ALLOCATED_VUS=150 K6PERF_MAX_VUS=300 k6 run ./test/pdv/pdvPerformance.js

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'
import { check } from 'k6'
import { SharedArray } from 'k6/data'
import { Counter } from 'k6/metrics'
import { getMockLogin } from '../../common/api/mockIOLogin.js'
import { getOnboardingStatus } from '../../common/api/onboardingClient.js'
import {
    toTrimmedString
} from '../../common/basicUtils.js'
import { loadEnvConfig } from '../../common/loadEnv.js'
import { prepareScenario } from '../../common/scenarioSetup.js'

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
        [`report-${new Date().getTime()}.html`]: htmlReport(data),
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

const status200Counter = new Counter('user_onboarded');
const status404Counter = new Counter('user_not_onboarded');
const mockLoginCounter = new Counter('mock_login_succeeded');

const tokenCache = new Map();

export function setup() {
    logScenario()
}

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

        check(res, {
            'mock login status 200': (r) => r.status === 200,
            'mock login body is not empty': (r) => r.body && r.body.length > 0
        });

        // Controlla se la generazione del token ha avuto successo
        if (res.status !== 200 || !res.body) {
            console.error(`Failed to get token for fiscal code ${fc}. Status: ${res.status}`);
            // Interrompi questa iterazione se non riusciamo a ottenere il token
            return;
        }
        mockLoginCounter.add(1);

        token = res.body;
        // Salva il nuovo token nella cache per usi futuri
        tokenCache.set(fc, token);
    }

    const res = getOnboardingStatus(baseUrl, initiativeId, token);

    if (res.status === 200) {
        status200Counter.add(1);
    } else if (res.status === 404) {
        status404Counter.add(1);
    }

    check(res, {
        'is 200 or 404': (r) => r.status === 200 || r.status === 404,
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

// K6PERF_SCENARIO_TYPE=constant-arrival-rate K6PERF_TIME_UNIT=1s TARGET_ENV=uat K6PERF_MAX_VUS=20 K6PERF_DURATION=10s K6PERF_RATE=50 K6PERF_PRE_ALLOCATED_VUS=5 ./xk6 run test/performance/idpay/getOnboardingStatus_mockLogin.js
