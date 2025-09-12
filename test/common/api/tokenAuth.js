import http from 'k6/http'
import { logResult } from '../dynamicScenarios/utils.js'
import { DEV, UAT, getBaseUrl } from '../envUrl.js'
import { getOrgId } from '../utils.js'

export const REGISTER_AUTH_API_NAMES = {
  authToken: 'register/token/test',
}

const REGISTERED_ENVS = [DEV, UAT]
const innerBaseUrl = `${getBaseUrl(REGISTERED_ENVS, 'eie')}`
const orgId = getOrgId(REGISTERED_ENVS, 'eie')

export function getJwtToken() {
  const apiName = REGISTER_AUTH_API_NAMES.authToken
  const url = `${innerBaseUrl}/register/token/test`

  const payload = JSON.stringify({
    aud: 'idpay.register.welfare.pagopa.it',
    iss: 'https://api-io.dev.cstar.pagopa.it',
    uid: orgId,
    name: 'pippo',
    familyName: 'qwerty',
    email: 'pippo@test.email.it',
    orgId: orgId,
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

  return {
    tokenRes: res,
    organizationId: orgId
  }
}