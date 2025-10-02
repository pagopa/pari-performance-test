// macOS usage examples (execute from the repository root)
//   Default CLI-driven scenario
//     TARGET_ENV=uat k6 run --vus 50 --duration 1m ./test/pdv/pdvPerformance.js
//   Custom scenario via env
//     TARGET_ENV=uat K6_SCENARIO_TYPE=constant-arrival-rate K6_RATE=300 K6_TIME_UNIT=500ms \
//     K6_VUS=200 K6_PRE_ALLOCATED_VUS=150 K6_MAX_VUS=300 k6 run ./test/pdv/pdvPerformance.js

import http from 'k6/http'
import { check } from 'k6'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js'
import { getMockLogin } from '../../common/api/mockIOLogin.js'
import {
    toPositiveNumber,
    toTrimmedString,
} from '../../common/basicUtils.js'
import { loadEnvConfig } from '../../common/loadEnv.js'
import {
    buildScenarioConfig,
    normalizeScenarioType,
} from '../../common/scenarioSetup.js'
import { abort, getFCList } from '../../common/utils.js'

const targetEnv = (__ENV.TARGET_ENV || 'dev').trim().toLowerCase()

const envConfig = loadEnvConfig(targetEnv)

const baseUrl = toTrimmedString(__ENV.APIM_URL, envConfig.apimUrl || '')
if (!baseUrl) {
    throw new Error(`Missing APIM_URL for environment: ${targetEnv}`)
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

export function handleSummary(data) {
    return {
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    }
}

const initiativeId = '68dd003ccce8c534d1da22bc'

export function setup() {
    const tokenList = []
    const fcList = getFCList()
    for (const fc of fcList) {
        const res = getMockLogin(fc)

        if (res.status !== 200) {
            abort(`Failed to get token for fiscal code ${fc}. Status: ${res.status}`)
        }

        if (res.body) {
            tokenList.push(res.body)
        } else {
            abort(
                `Failed to get token for fiscal code ${fc}. No token in response body.`
            )
        }
    }
    return { tokenList }
}

export default function (data) {
    const token = data.tokenList[Math.floor(Math.random() * data.tokenList.length)]

    const url = `${baseUrl}/onboarding/${initiativeId}/status`

    const headers = {
        'X-Api-Version': 'v1',
        Accept: 'application/json',
        'Accept-Language': 'it-IT',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    }

    const res = http.get(url, { headers })

    check(res, {
        'is 404': (r) => r.status === 404,
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

// TARGET_ENV=uat K6_VUS=10 K6_DURATION=30s K6_RATE=10 python3 .devops/scripts/run_k6.py --script  test/performance/idpay/getOnboardingStatus_mockLogin.js