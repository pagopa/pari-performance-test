import http from 'k6/http'
import { logResult } from '../dynamicScenarios/utils.js'
import { DEV, UAT, getBaseUrl } from '../envUrl.js'

export const REGISTER_AUTH_API_NAMES = {
  authToken: 'register/token/test',
}

const REGISTERED_ENVS = [DEV, UAT]
const innerBaseUrl = `${getBaseUrl(REGISTERED_ENVS, 'eie')}`

export function getJwtToken() {
  const apiName = REGISTER_AUTH_API_NAMES.authToken
  const url = `${innerBaseUrl}/register/token/test`

  const payload = JSON.stringify({
    aud: 'idpay.register.welfare.pagopa.it',
    iss: 'https://api-io.dev.cstar.pagopa.it',
    uid: '72c2c5f8-1c71-4614-a4b3-95e3aee71c3d',
    name: 'pippo',
    familyName: 'qwerty',
    email: 'pippo@test.email.it',
    orgId: '72c2c5f8-1c71-4614-a4b3-95e3aee71c3d',
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