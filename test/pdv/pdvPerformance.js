// macOS usage examples (execute from the repository root)
//   Default CLI-driven scenario
//     TARGET_ENV=uat k6 run --vus 50 --duration 1m ./test/pdv/pdvPerformance.js
//   Custom scenario via env
//     TARGET_ENV=uat K6_SCENARIO_TYPE=constant-arrival-rate K6_RATE=300 K6_TIME_UNIT=500ms \
//     K6_VUS=200 K6_PRE_ALLOCATED_VUS=150 K6_MAX_VUS=300 k6 run ./test/pdv/pdvPerformance.js
import http from 'k6/http'
import { check } from 'k6'
import { randomString } from 'https://jslib.k6.io/k6-utils/1.6.0/index.js'

const targetEnv = (__ENV.TARGET_ENV || 'dev').trim().toLowerCase()

const scenarioAliases = {
    manual: 'manual',
    none: 'manual',
    'shared-iterations': 'shared-iterations',
    sharediterations: 'shared-iterations',
    'per-vu-iterations': 'per-vu-iterations',
    pervuiterations: 'per-vu-iterations',
    'constant-vus': 'constant-vus',
    constantvus: 'constant-vus',
    'ramping-vus': 'ramping-vus',
    rampingvus: 'ramping-vus',
    'constant-arrival-rate': 'constant-arrival-rate',
    constantarrivalrate: 'constant-arrival-rate',
    'ramping-arrival-rate': 'ramping-arrival-rate',
    rampingarrivalrate: 'ramping-arrival-rate',
}

function normalizeScenarioType(value) {
    const canonical = (value || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/_+/g, '-')
    return scenarioAliases[canonical] || (canonical ? canonical : 'constant-arrival-rate')
}

function loadEnvConfig(env) {
    const path = `../../config/${env}.json`
    try {
        const raw = open(path)
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed.pdvUrl !== 'string') {
            throw new Error(`config file ${path} missing pdvUrl property`)
        }
        return parsed
    } catch (err) {
        throw new Error(`Unable to load config for TARGET_ENV=${env}: ${err.message}`)
    }
}

function toPositiveNumber(value) {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function toNonNegativeNumber(value) {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function toTrimmedString(value, fallback) {
    const trimmed = (value || '').toString().trim()
    return trimmed || fallback
}

function parseStages(raw, fallbackDuration, fallbackTarget) {
    const value = (raw || '').toString().trim()
    if (!value) {
        return fallbackTarget === undefined
            ? []
            : [
                  {
                      duration: fallbackDuration,
                      target: fallbackTarget,
                  },
              ]
    }

    let parsed
    try {
        parsed = JSON.parse(value)
    } catch (err) {
        throw new Error(
            `K6_STAGES must be a JSON array of { duration, target } objects: ${err.message}`
        )
    }

    if (!Array.isArray(parsed)) {
        throw new Error('K6_STAGES must be a JSON array of { duration, target } objects')
    }

    const stages = parsed.map((stage, index) => {
        if (!stage || typeof stage !== 'object') {
            throw new Error(`K6_STAGES[${index}] must be an object with duration and target fields`)
        }
        const duration = toTrimmedString(stage.duration, '')
        const target = toNonNegativeNumber(stage.target)
        if (!duration) {
            throw new Error(`K6_STAGES[${index}] is missing a valid duration`)
        }
        if (target === undefined) {
            throw new Error(`K6_STAGES[${index}] is missing a numeric target >= 0`)
        }
        return { duration, target }
    })

    if (stages.length > 0) {
        return stages
    }

    return fallbackTarget === undefined
        ? []
        : [
              {
                  duration: fallbackDuration,
                  target: fallbackTarget,
              },
          ]
}

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
const stageDefinitions = parseStages(__ENV.K6_STAGES, k6Duration, k6Vus)
const arrivalStageDefinitions = parseStages(
    __ENV.K6_STAGES,
    k6Duration,
    k6Rate
)

function buildScenario() {
    switch (scenarioType) {
        case 'manual':
            return undefined
        case 'shared-iterations':
            return {
                executor: 'shared-iterations',
                vus: Math.max(k6Vus, 1),
                iterations: Math.max(k6Iterations, 1),
                maxDuration: k6Duration,
            }
        case 'per-vu-iterations':
            return {
                executor: 'per-vu-iterations',
                vus: Math.max(k6Vus, 1),
                iterations: Math.max(k6Iterations, 1),
                maxDuration: k6Duration,
            }
        case 'constant-vus':
            return {
                executor: 'constant-vus',
                vus: Math.max(k6Vus, 1),
                duration: k6Duration,
            }
        case 'ramping-vus':
            return {
                executor: 'ramping-vus',
                startVUs: Math.max(k6StartVus, 1),
                gracefulRampDown: '30s',
                stages: stageDefinitions,
            }
        case 'ramping-arrival-rate':
            return {
                executor: 'ramping-arrival-rate',
                timeUnit: k6TimeUnit,
                preAllocatedVUs: Math.max(k6PreAllocatedVus, 1),
                maxVUs: Math.max(k6MaxVus, k6PreAllocatedVus, 1),
                stages: arrivalStageDefinitions,
            }
        case 'constant-arrival-rate':
        default:
            return {
                executor: 'constant-arrival-rate',
                rate: Math.max(k6Rate, 1),
                timeUnit: k6TimeUnit,
                duration: k6Duration,
                preAllocatedVUs: Math.max(k6PreAllocatedVus, 1),
                maxVUs: Math.max(k6MaxVus, k6PreAllocatedVus, 1),
            }
    }
}

const scenario = buildScenario()

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
