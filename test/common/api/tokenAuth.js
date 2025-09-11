import http from 'k6/http'
import { logResult } from '../dyanamicScenarios/utils.js'
import { DEV, UAT, getBaseUrl } from '../envUrl.js'

export const REGISTER_AUTH_API_NAMES = {
  authToken: 'register/token/test',
}

const REGISTERED_ENVS = [DEV, UAT]
const innerBaseUrl = `${getBaseUrl(REGISTERED_ENVS, 'register')}`

export function getJwtToken() {
  const apiName = REGISTER_AUTH_API_NAMES.authToken
  const url = `${innerBaseUrl}/register/token/test`

  const payload = JSON.stringify({
    aud: 'idpay.register.welfare.pagopa.it',
    iss: 'https://api-io.dev.cstar.pagopa.it',
    uid: '83843864-f3c0-4def-badb-7f197471b72e',
    name: 'pippo',
    familyName: 'qwerty',
    email: 'pippo@test.email.it',
    orgId: '390cea38-f2de-4bcb-a181-d6eef99fe528',
    orgVAT: '80117082724',
    orgName: 'Ente di test IdPay',
    orgRole: 'operatore',
    orgPec: 'pec',
    orgAddress: 'address'
  })

  const headers = {
    'Content-Type': 'application/json',
    'Ocp-Apim-Trace': 'true'
  }

  const res = http.post(url, payload, { headers, tags: { apiName } })

  if (res.status !== 200) {
    console.error(`[ERROR] Token not received. Status: ${res.status}, Body: ${res.body}`)
  }

  logResult(apiName, res)
  return res
}
