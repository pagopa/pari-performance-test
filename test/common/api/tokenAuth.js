import http from 'k6/http'
import { logResult } from '../dynamicScenarios/utils.js'
import { DEV, UAT, getBaseUrl } from '../envUrl.js'
import { getOrgId } from '../utils.js'

export const REGISTER_AUTH_API_NAMES = {
  authToken: 'register/token/test',
}

export const KEYCLOAK_AUTH_API_NAMES = {
  authToken: 'protocol/openid-connect/token',
}

export const IO_AUTH_API_NAMES = {
  authToken: 'rtd/mock-io/login',
}

const REGISTERED_ENVS = [DEV, UAT]
const keycloakBaseUrl = getBaseUrl(REGISTERED_ENVS).keycloakBaseUrl
const innerBaseUrl =  getBaseUrl(REGISTERED_ENVS).baseUrl
const orgId = getOrgId(REGISTERED_ENVS)

export function getTokenKeycloak(email, password) {
  const apiName = KEYCLOAK_AUTH_API_NAMES.authToken
  const url = keycloakBaseUrl

  const payload =
    `client_id=frontend` +
    `&username=${encodeURIComponent(email)}` +
    `&password=${encodeURIComponent(password)}` +
    `&grant_type=password`

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  const res = http.post(url, payload, { headers, tags: { apiName } })
  if (res.status !== 200) {
    console.error(`[ERROR] Token not received. Status: ${res.status}, Body: ${res.body}`)
  }

  logResult(apiName, res)
  return { tokenKeycloakResponse: res }
}

export function getTokenIO(cf = '') {
  const apiName = IO_AUTH_API_NAMES.authToken
  const urlBase = 'https://api-io.dev.cstar.pagopa.it/rtd/mock-io/login'
  const url = cf ? `${urlBase}?fiscalCode=${encodeURIComponent(cf)}` : urlBase

  const params = {
    headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Trace': 'true' },
    tags: { apiName },
  }

  const res = http.post(url, null, params)

  if (res.status !== 200) {
    console.error(`[getIOToken] Token request failed. status=${res.status}`)
  }
  logResult(apiName, res)
  return { tokenIOResponse: res }
}

export function getTokenRegister() {
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
