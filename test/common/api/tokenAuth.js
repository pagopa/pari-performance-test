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
 * Retrieves Keycloak token via Resource Owner Password flow (esistente).
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
 * Retrieves Keycloak token via Client Credentials flow.
 * Legge client_id / client_secret da ENV se non passati in opts.
 *
 * Variabili d'ambiente supportate:
 *  - KC_CLIENT_ID
 *  - KC_CLIENT_SECRET
 *  - KC_SCOPE (opzionale)
 *
 * @param {string} keycloakBaseUrl - Token endpoint (es. .../protocol/openid-connect/token)
 * @param {Object} [opts]
 * @param {string} [opts.clientId=__ENV.KC_CLIENT_ID] - Keycloak client_id
 * @param {string} [opts.clientSecret=__ENV.KC_CLIENT_SECRET] - Keycloak client_secret
 * @param {string} [opts.scope=__ENV.KC_SCOPE] - Scope opzionale
 * @return {string|null} Access token o null in caso di errore
 */
export function getTokenKeycloakClientCredentials(keycloakBaseUrl, opts = {}) {
  const apiName = 'getTokenKeycloakClientCredentials';

  const clientId = opts.clientId || __ENV.KC_CLIENT_ID;
  const clientSecret = opts.clientSecret || __ENV.KC_CLIENT_SECRET;
  const scope = opts.scope || __ENV.KC_SCOPE; // opzionale

  if (!clientId || !clientSecret) {
    console.error(`[${apiName}] ❌ Missing client credentials. Provide KC_CLIENT_ID and KC_CLIENT_SECRET env vars or pass opts.clientId/opts.clientSecret.`);
    return null;
  }

  const parts = [
    'grant_type=client_credentials',
    `client_id=${encodeURIComponent(clientId)}`,
    `client_secret=${encodeURIComponent(clientSecret)}`
  ];
  if (scope) parts.push(`scope=${encodeURIComponent(scope)}`);

  const payload = parts.join('&');
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

  return res.json('access_token'); // oppure res.json() per l’oggetto completo
}

/**
 * Retrieves a registration token (esistente).
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
