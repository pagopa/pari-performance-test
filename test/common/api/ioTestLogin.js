import http from 'k6/http'
import { getBaseUrl, DEV, UAT } from '../envUrl.js'
import { logResult } from '../dynamicScenarios/utils.js'

const REGISTERED_ENVS = [DEV, UAT]
const baseUrl = getBaseUrl(REGISTERED_ENVS, 'io')

export const IDPAY_ONBOARDING_API_NAMES = {
    testLogin: 'io/test-login',
}

export function getTestLogin(fiscalCode) {
    const apiName = IDPAY_ONBOARDING_API_NAMES.testLogin
    const url = `https://api-app.io.pagopa.it/test-login`

    const payload = JSON.stringify({
        username: fiscalCode,
        password: 'placeholder',
    })

    const headers = {
        'Content-Type': 'application/json',
        'loginType': 'LEGACY'
    }

    const res = http.post(url, payload, {
        headers,
        tags: { apiName },
    })

    logResult(apiName, res)
    return res
}
