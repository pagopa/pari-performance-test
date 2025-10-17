import http from 'k6/http';
import { logResult } from '../dynamicScenarios/utils.js';
import { getOrgId } from '../utils.js';

/** API Endpoints */
const AUTH_API = {
  REGISTER_TOKEN: '/register/token/test'
};

/**
 * Builds headers for HTTP requests.
 * @param {string} contentType - The content type of the request.
 * @return {Object} Headers object.
 */
function buildHeaders(contentType = 'application/json') {
  return {
    'Content-Type': contentType,
    'Ocp-Apim-Trace': 'true',
  };
}

/**
 * Retrieves Keycloak token for the given user credentials.
 * @param {string} keycloakBaseUrl - The Keycloak token endpoint.
 * @param {string} email - User email.
 * @param {string} password - User password.
 * @return {string|null} Access token or null if failed.
 */
export function getTokenKeycloak(keycloakBaseUrl, email, password) {
  const apiName = 'getTokenKeycloak';

  const payload = [
    'client_id=performance-test-client',
    `username=${encodeURIComponent(email)}`,
    `password=${encodeURIComponent(password)}`,
    'grant_type=password',
  ].join('&');

  const headers = buildHeaders('application/x-www-form-urlencoded');
  
  const res = http.post(keycloakBaseUrl, payload, {
    headers,
    tags: { apiName },
    responseType: 'text',
  });

  logResult(apiName, res);

  if (res.status !== 200) {
    console.error(`[${apiName}] ❌ Token not received. Status: ${res.status}, Body: ${res.body}`);
    return null;
  }

  return res.json('access_token');
}

/**
 * Retrieves a registration token.
 * @param {string} innerBaseUrl - Base URL of the registration API.
 * @return {Object} Object containing the response and organization ID.
 */
export function getTokenRegister(innerBaseUrl) {
  const apiName = 'getTokenRegister';
  const url = `${innerBaseUrl}${AUTH_API.REGISTER_TOKEN}`;

  const orgId = getOrgId() || 'unknown-org-id';
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
  });

  const headers = buildHeaders();
  const res = http.post(url, payload, { headers, tags: { apiName } });

  logResult(apiName, res);

  if (res.status !== 200) {
    console.error(`[${apiName}] ❌ Token not received. Status: ${res.status}, Body: ${res.body}`);
  }

  return {
    tokenRes: res,
    organizationId: orgId,
  };
}
