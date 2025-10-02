import http from 'k6/http'
import { logResult } from '../dynamicScenarios/utils.js'

export const IDPAY_ONBOARDING_API_NAMES = {
    testLogin: 'idpay/mock-io',
}

export function getMockLogin(fiscalCode) {
    const apiName = IDPAY_ONBOARDING_API_NAMES.testLogin
    const url = `https://uat01.rtd.internal.uat.cstar.pagopa.it/cstarmockbackendio/bpd/pagopa/api/v1/login?fiscalCode=${fiscalCode}`

    const headers = {
        'Content-Type': 'application/json',
    }

    const res = http.post(url, {
        headers,
        tags: { apiName },
    })

    logResult(apiName, res)
    return res
}
