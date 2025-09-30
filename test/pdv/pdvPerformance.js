// macOS usage examples (execute from the repository root)
//   Default CLI-driven scenario
//     TARGET_ENV=uat k6 run --vus 50 --duration 1m ./test/pdv/pdvPerformance.js
//   Custom scenario via env
//     TARGET_ENV=uat K6_SCENARIO_TYPE=constant-arrival-rate K6_RATE=300 K6_TIME_UNIT=500ms \
//     K6_VUS=200 K6_PRE_ALLOCATED_VUS=150 K6_MAX_VUS=300 k6 run ./test/pdv/pdvPerformance.js
import http from 'k6/http'
import { check } from 'k6'
import { randomString } from 'https://jslib.k6.io/k6-utils/1.6.0/index.js'
import { loadEnvConfig } from '../common/loadEnv.js'
import {
    toPositiveNumber,
    toTrimmedString,
} from '../common/basicUtils.js'
import {
    normalizeScenarioType,
    buildScenarioConfig,
} from '../common/scenarioSetup.js'

const targetEnv = (__ENV.TARGET_ENV || 'dev').trim().toLowerCase()

const envConfig = loadEnvConfig(targetEnv)
const pdvUrl = toTrimmedString(__ENV.PDV_URL, envConfig.pdvUrl || '')

if (!pdvUrl) {
    throw new Error(`Missing PDV_URL for environment: ${targetEnv}`)
}

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

const scenario = buildScenarioConfig(scenarioType, {
    duration: k6Duration,
    iterations: k6Iterations,
    vus: k6Vus,
    rate: k6Rate,
    timeUnit: k6TimeUnit,
    preAllocatedVUs: k6PreAllocatedVus,
    maxVUs: k6MaxVus,
    startVUs: k6StartVus,
    stagesRaw: __ENV.K6_STAGES,
})

const testOptions = {
    discardResponseBodies: true,
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

export default function () {
    const payload = {
        pii: randomString(8, 'abcdefghijklmnopqrstuvwxyz01234567890'),
    }

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
