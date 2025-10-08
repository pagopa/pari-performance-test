import http from 'k6/http'
import { logResult } from '../dynamicScenarios/utils.js'
import { getOrgId } from '../utils.js'

const AUTH_API = {
  KEYCLOAK_TOKEN: '/auth/realms/idpay/protocol/openid-connect/token',
  IO_TOKEN: 'https://api-io.dev.cstar.pagopa.it/rtd/mock-io/login',
  REGISTER_TOKEN: '/register/token/test',
}

function buildHeaders(contentType = 'application/json') {
  return {
    'Content-Type': contentType,
    'Ocp-Apim-Trace': 'true',
  }
}

export function getTokenKeycloak(keycloakBaseUrl, email, password) {
  const apiName = 'getTokenKeycloak'
  const url = `${keycloakBaseUrl}${AUTH_API.KEYCLOAK_TOKEN}`

  const payload = [
    'client_id=frontend',
    `username=${encodeURIComponent(email)}`,
    `password=${encodeURIComponent(password)}`,
    'grant_type=password',
  ].join('&')

  const headers = buildHeaders('application/x-www-form-urlencoded')

  const res = http.post(url, payload, { headers, tags: { apiName } })
  logResult(apiName, res)

  if (res.status !== 200) {
    console.error(`[${apiName}] ❌ Token not received. Status: ${res.status}, Body: ${res.body}`)
  }

  return { tokenKeycloakResponse: res }
}

export function getTokenIO(cf = '') {
  const apiName = 'getTokenIO'
  const baseUrl = AUTH_API.IO_TOKEN
  const url = cf ? `${baseUrl}?fiscalCode=${encodeURIComponent(cf)}` : baseUrl

  const headers = buildHeaders()
  const res = http.post(url, null, { headers, tags: { apiName } })

  logResult(apiName, res)

  if (res.status !== 200) {
    console.error(`[${apiName}] ❌ Token request failed. Status: ${res.status}`)
  }

  return { tokenIOResponse: res }
}


export function getTokenRegister(innerBaseUrl) {
  const apiName = 'getTokenRegister'
  const url = `${innerBaseUrl}${AUTH_API.REGISTER_TOKEN}`

  const orgId = getOrgId() || 'unknown-org-id'
  const payload = JSON.stringify({
    aud: 'idpay.register.welfare.pagopa.it',
    iss: 'https://api-io.dev.cstar.pagopa.it',
    uid: orgId,
    name: 'Pippo',
    familyName: 'Qwerty',
    email: 'pippo@test.email.it',
    orgId,
    orgVAT: '80117082724',
    orgName: 'Ente di test IdPay',
    orgRole: 'operatore',
    orgPec: 'pec',
    orgAddress: 'address',
  })

  const headers = buildHeaders()

  const res = http.post(url, payload, { headers, tags: { apiName } })
  logResult(apiName, res)

  if (res.status !== 200) {
    console.error(`[${apiName}] ❌ Token not received. Status: ${res.status}, Body: ${res.body}`)
  }

  return {
    tokenRes: res,
    organizationId: orgId,
  }
}
