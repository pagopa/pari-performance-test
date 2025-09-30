// macOS usage examples (execute from the repository root):
//   Basic smoke (just pick the env and default constant-arrival scenario)
//     TARGET_ENV=uat SCENARIO_TYPE_ENV=constant-arrival-rate k6 run ./test/pdv/pdvPerformance.js
//   Full control (override VUs, rate, pacing, duration, iterations)
//     TARGET_ENV=uat SCENARIO_TYPE_ENV=per-vu-iterations VUS_MAX_ENV=200 RATE=300 TIME_UNIT=500ms SCENARIO_DURATION_ENV=1m ITERATIONS_ENV=5 k6 run ./test/pdv/pdvPerformance.js
import http from 'k6/http'
import { check } from 'k6'
import { randomString } from 'https://jslib.k6.io/k6-utils/1.6.0/index.js'

const targetEnv = (__ENV.TARGET_ENV || 'dev').trim().toLowerCase()
const scenarioType = (__ENV.SCENARIO_TYPE_ENV || 'constant-arrival-rate').trim()

const serviceConfig = JSON.parse(open(`../../services/${targetEnv}.json`))
const pdvUrl = (serviceConfig.pdvUrl || '').trim()

if (!pdvUrl) {
    throw new Error(`Missing pdvUrl for environment: ${targetEnv}`)
}

const vus = Number(__ENV.VUS_MAX_ENV || 50)
const rate = Number(__ENV.RATE || 100)
const timeUnit = (__ENV.TIME_UNIT || '1s').trim()
const duration = (__ENV.SCENARIO_DURATION_ENV || '1m').trim()
const iterations = Number(__ENV.ITERATIONS_ENV || 1)

function buildScenario() {
    switch (scenarioType) {
        case 'constant-vus':
            return {
                executor: 'constant-vus',
                vus,
                duration,
            }
        case 'per-vu-iterations':
            return {
                executor: 'per-vu-iterations',
                vus,
                iterations: Math.max(iterations, 1),
                maxDuration: duration,
            }
        default:
            return {
                executor: 'constant-arrival-rate',
                rate,
                timeUnit,
                duration,
                preAllocatedVUs: Math.max(vus, 1),
                maxVUs: Math.max(vus, rate),
            }
    }
}

export const options = {
    discardResponseBodies: true,
    scenarios: {
        pdv: buildScenario(),
    },
    thresholds: {
        checks: ['rate>0.99'],
    },
}

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
