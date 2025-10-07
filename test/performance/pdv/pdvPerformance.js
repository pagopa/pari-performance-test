// macOS usage examples (execute from the repository root)
//   Env-driven constant-arrival scenario
//     TARGET_ENV=uat K6PERF_SCENARIO_TYPE=constant-arrival-rate K6PERF_RATE=300 K6PERF_TIME_UNIT=500ms \
//     K6PERF_DURATION=3m K6PERF_PRE_ALLOCATED_VUS=150 K6PERF_MAX_VUS=300 k6 run ./test/performance/pdv/pdvPerformance.js
//   Manual fallback (CLI-driven)
//     TARGET_ENV=uat K6PERF_SCENARIO_TYPE=manual k6 run --vus 50 --duration 1m ./test/performance/pdv/pdvPerformance.js
import http from 'k6/http'
import { check } from 'k6'
import { randomString } from 'https://jslib.k6.io/k6-utils/1.6.0/index.js'
import { loadEnvConfig } from '../../common/loadEnv.js'
import { toTrimmedString } from '../../common/basicUtils.js'
import { prepareScenario } from '../../common/scenarioSetup.js'

const targetEnv = toTrimmedString(__ENV.TARGET_ENV, 'dev').toLowerCase()
const TOKEN_PII_ALPHABET = 'abcdefghijklmnopqrstuvwxyz01234567890'

const envConfig = loadEnvConfig(targetEnv)
const pdvUrl = toTrimmedString(__ENV.PDV_URL, envConfig.pdvUrl || '')

if (!pdvUrl) {
    throw new Error(`Missing PDV_URL for environment: ${targetEnv}`)
}

const { scenarioConfig, logScenario } = prepareScenario({ env: __ENV })

const testOptions = {
    discardResponseBodies: true,
    thresholds: {
        checks: ['rate>0.99'],
    },
}

if (scenarioConfig) {
    testOptions.scenarios = {
        pdv: scenarioConfig,
    }
}

export const options = testOptions

export function setup() {
    logScenario()
}

export default function () {
    const payload = buildTokenPayload()

    const response = http.put(
        `${pdvUrl}/tokens`,
        JSON.stringify(payload),
        {
            headers: {
                'Content-Type': 'application/json',
            },
        }
    )

    check(response, {
        'status was 200': (r) => r.status === 200,
    })
}

function buildTokenPayload() {
    return {
        pii: randomString(8, TOKEN_PII_ALPHABET),
    }
}
