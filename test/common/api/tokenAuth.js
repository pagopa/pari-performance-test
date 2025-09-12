import http from 'k6/http'
import { logResult } from '../dynamicScenarios/utils.js'
import { DEV, UAT, getBaseUrl } from '../envUrl.js'

export const EIE_AUTH_API_NAMES = {
  authToken: 'register/token/test',
}

const REGISTERED_ENVS = [DEV, UAT]
const innerBaseUrl = `${getBaseUrl(REGISTERED_ENVS, 'eie')}`

export function getJwtToken() {
  const apiName = EIE_AUTH_API_NAMES.authToken
  const url = `${innerBaseUrl}/register/token/test`

  const isUat = __ENV.ENVIRONMENT === UAT

  const payload = JSON.stringify({
    aud: 'idpay.register.welfare.pagopa.it',
    iss: 'https://api-io.dev.cstar.pagopa.it',
    uid: isUat ? 'e88fe25f-ccfa-4962-8f62-f1450fd78ad0' : '72c2c5f8-1c71-4614-a4b3-95e3aee71c3d',
    name: isUat ? 'Gianantonio' : 'pippo',
    family_name: isUat ? 'Grassi' : 'qwerty',
    org_email: isUat ? 'test.rdb.dev@gmail.com' : 'pippo@test.email.it',
    org_id: isUat ? '8bd31e63-a8e8-4cbc-b06d-bc69f32c3fde' : '72c2c5f8-1c71-4614-a4b3-95e3aee71c3d',
    org_vat: isUat ? '13123784130' : '80117082724',
    org_fc: isUat ? '13123784130' : '80117082724',
    org_name: isUat ? 'Produttore di Elettrodomestici 04Luglio' : 'Ente di test IdPay',
    org_party_role: isUat ? 'OPERATOR' : 'OPERATOR',
    org_role: 'operatore',
    org_address: isUat ? 'Via Test 1, 81035 Roma (IT)' : 'address',
    org_pec: isUat ? 'test@produttore.it' : 'pec'
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
    organizationId: isUat
      ? '8bd31e63-a8e8-4cbc-b06d-bc69f32c3fde'
      : '72c2c5f8-1c71-4614-a4b3-95e3aee71c3d'
  }
}