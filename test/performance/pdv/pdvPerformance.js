// macOS usage examples (execute from the repository root)
//   Default CLI-driven scenario
//     TARGET_ENV=uat k6 run --vus 50 --duration 1m ./test/pdv/pdvPerformance.js
//   Custom scenario via env
//     TARGET_ENV=uat K6PERF_SCENARIO_TYPE=constant-arrival-rate K6PERF_RATE=300 K6PERF_TIME_UNIT=500ms \
//     K6PERF_VUS=200 K6PERF_PRE_ALLOCATED_VUS=150 K6PERF_MAX_VUS=300 k6 run ./test/pdv/pdvPerformance.js
import http from 'k6/http'
import { check } from 'k6'
import { randomString } from 'https://jslib.k6.io/k6-utils/1.6.0/index.js'
import { loadEnvConfig } from '../../common/loadEnv.js'
import {
    toPositiveNumber,
    toTrimmedString,
} from '../../common/basicUtils.js'
import {
    normalizeScenarioType,
    buildScenarioConfig,
} from '../../common/scenarioSetup.js'

function formatEnvValue(value) {
    if (value === undefined) {
        return 'undefined'
    }
    if (value === null) {
        return 'null'
    }
    if (typeof value === 'string') {
        return value.length === 0 ? '"" (empty string)' : `"${value}"`
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
        return String(value)
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false'
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value)
        } catch {
            return '[object]'
        }
    }
    return String(value)
}

const targetEnv = (__ENV.TARGET_ENV || 'dev').trim().toLowerCase()

const envConfig = loadEnvConfig(targetEnv)
const pdvUrl = toTrimmedString(__ENV.PDV_URL, envConfig.pdvUrl || '')

if (!pdvUrl) {
    throw new Error(`Missing PDV_URL for environment: ${targetEnv}`)
}

const scenarioTypeRaw = __ENV.K6PERF_SCENARIO_TYPE
const scenarioTypeValue = toTrimmedString(scenarioTypeRaw, undefined)
if (!scenarioTypeValue) {
    throw new Error(
        `Missing required environment variable: K6PERF_SCENARIO_TYPE (received ${formatEnvValue(
            scenarioTypeRaw
        )})`
    )
}
const scenarioType = normalizeScenarioType(scenarioTypeValue)

const scenario = buildScenarioConfig(scenarioType, {
    duration: toTrimmedString(__ENV.K6PERF_DURATION, undefined),
    iterations: toPositiveNumber(__ENV.K6PERF_ITERATIONS),
    vus: toPositiveNumber(__ENV.K6PERF_VUS),
    rate: toPositiveNumber(__ENV.K6PERF_RATE),
    timeUnit: toTrimmedString(__ENV.K6PERF_TIME_UNIT, undefined),
    preAllocatedVUs: toPositiveNumber(__ENV.K6PERF_PRE_ALLOCATED_VUS),
    maxVUs: toPositiveNumber(__ENV.K6PERF_MAX_VUS),
    startVUs: toPositiveNumber(__ENV.K6PERF_START_VUS),
    stagesRaw: __ENV.K6PERF_STAGES_JSON ?? __ENV.K6PERF_STAGES,
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
