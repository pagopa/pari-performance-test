
// macOS usage examples (execute from the repository root)
//   Default CLI-driven scenario
//     TARGET_ENV=uat k6 run --vus 50 --duration 1m ./test/pdv/pdvPerformance.js
//   Custom scenario via env
//     TARGET_ENV=uat K6_SCENARIO_TYPE=constant-arrival-rate K6_RATE=300 K6_TIME_UNIT=500ms \
//     K6_VUS=200 K6_PRE_ALLOCATED_VUS=150 K6_MAX_VUS=300 k6 run ./test/pdv/pdvPerformance.js

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'
import http from 'k6/http'
import { assert, statusOk } from '../../common/assertions.js'
import {
    toTrimmedString
} from '../../common/basicUtils.js'
import { loadEnvConfig } from '../../common/loadEnv.js'
import { prepareScenario } from '../../common/scenarioSetup.js'
import { abort, getFCList } from '../../common/utils.js'
import { getTestLogin } from '../../common/api/ioTestLogin.js'

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

export function setup() {
    logScenario()

    const tokenList = []
    const fcList = getFCList()
    for (const fc of fcList) {
        const res = getTestLogin(fc)

        if (res.status !== 200) {
            abort(`Failed to get token for fiscal code. Status: ${res.status}`)
        }

        if (res.json() && res.json().token) {
            tokenList.push(res.json().token)
        } else {
            abort(`Failed to get token for fiscal code. No token in response body.`)
        }
    }
    return { tokenList }
}

export default function (data) {
    const apiName = 'idpay/status'
    const token = data.tokenList[Math.floor(Math.random() * data.tokenList.length)]

    const headers = {
        Authorization: `Bearer ${token}`,
    }

    const res = http.get(`${baseUrl}/onboarding/68da608cecbf240ccd4bd71a/status`, {
        headers,
        tags: { apiName },
    })

    // NOTE: logResult is not defined, let's comment it out for now
    // logResult(apiName, res)

    // assert the status is not 5xx
    assert(res, [statusOk()])
}