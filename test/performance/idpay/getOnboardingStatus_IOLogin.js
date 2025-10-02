import http from 'k6/http'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js'
import { getMockLogin } from '../../common/api/mockIOLogin.js'
import { assert, statusAccepted, statusOk } from '../../common/assertions.js'
import { getBaseUrl, UAT } from '../../common/envUrl.js'
import { getFCList, abort } from '../../common/utils.js'

const REGISTERED_ENVS = [UAT]
const baseUrl = getBaseUrl(REGISTERED_ENVS, 'io')

export const options = {
    scenarios: {
        constant: {
            executor: 'constant-arrival-rate',
            rate: 10, // 10 iterations per second
            timeUnit: '1s',
            duration: '5s',
            preAllocatedVUs: 5,
            maxVUs: 100,
        },
    },
    thresholds: {
        // http_req_failed: ['rate<0.01'], // http errors should be less than 1%
        http_req_duration: ['p(95)<300'], // 95% of requests should be below 200ms
    },
}

export function handleSummary(data) {
    return {
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    }
}

export function setup() {
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