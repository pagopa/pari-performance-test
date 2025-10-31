import http from 'k6/http';
import { check } from 'k6';
import { logResult } from '../dynamicScenarios/utils.js';

/**
 * API endpoint definitions for Onboarding service.
 * @readonly
 * @enum {string}
 */
const OnboardingEndpoints = {
  BY_USER: '/onboarding/user/initiative/status',
  BY_SERVICE_ID: '/onboarding/service/{serviceId}',
  INITIATIVE_DETAIL: '/onboarding/{initiativeId}/detail',
  SAVE_ONBOARDING: '/onboarding',
  ONBOARDING_STATUS: '/onboarding/{initiativeId}/status',
  ONBOARDING_USER_INITIATIVE_STATUS: '/onboarding/user/initiative/status',
};

/**
 * Builds default HTTP headers for the API requests.
 * @param {string} token - Bearer authorization token.
 * @param {string} [locale='it-IT'] - Preferred language for Accept-Language header.
 * @returns {Record<string, string>} Standardized header object.
 */
function buildHeaders(token, locale = 'it-IT') {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept-Language': locale,
    Accept: 'application/json',
  };
}

function parseJsonSafe(res) {
  try {
    return res?.json?.() ?? (res?.body ? JSON.parse(res.body) : null);
  } catch { return null; }
}

/**
 * Validazione generica con supporto a errori attesi per status.
 * - okStatuses: es. [200]
 * - expectedByStatus: es. { 404: ['INITIATIVE_NOT_FOUND'], 400: ['ONBOARDING_*'] }
 */
function validateAndLogResponse(name, res, okStatuses = [200], expectedByStatus = {}) {
  logResult(name, res);

  const isOk = !!res && okStatuses.includes(res.status);
  let ok = isOk;

  if (!ok && res) {
    const expectedCodes = expectedByStatus[res.status];
    if (expectedCodes && expectedCodes.length > 0) {
      const j = parseJsonSafe(res);
      if (j?.code && expectedCodes.includes(j.code)) {
        ok = true;
      }
    }
  }

  check(res, {
    [`${name} responded with pure 2xx`]: () => isOk,
    [`${name} ok (status in ${JSON.stringify(okStatuses)} or expected codes)`]: () => ok,
  });

  return { res, ok, isOk };
}

/**
 * Retrieves detailed information for a specific initiative.
 * @param {string} baseUrl - Base API URL.
 * @param {string} token - Bearer authorization token.
 * @param {string} initiativeId - Initiative identifier.
 * @param {string} [locale='it-IT'] - Language preference.
 * @returns {Response}
 */

export function fetchInitiativeDetail(baseUrl, token, initiativeId, locale = 'it-IT') {
  const name = 'fetchInitiativeDetail';
  const url = `${baseUrl}${OnboardingEndpoints.INITIATIVE_DETAIL.replace('{initiativeId}', initiativeId)}`;
  const headers = buildHeaders(token, locale);

  const params = {
    headers,
    responseType: 'text',
    tags: {
      apiName: name,
      // Può restituire 400/404 attesi
      expected_response: 'true',
    },
  };

  const res = http.get(url, params);
  // OK se 200; OK anche se 404 o 400 con i codici attesi
  return validateAndLogResponse(
    name,
    res,
    [200],
    {
      404: ['ONBOARDING_USER_NOT_ONBOARDED'],
      400: ['ONBOARDING_ALREADY_ONBOARDED', 'ONBOARDING_ON_EVALUATION'],
    }
  );
}

/**
 * Retrieves all initiatives associated with the current user.
 * @param {string} baseUrl - Base API URL.
 * @param {string} token - Bearer authorization token.
 * @param {string} [locale='it-IT'] - Language preference.
 * @returns {{res: Response, ok: boolean, isOk: boolean}}
 */
export function fetchUserInitiatives(baseUrl, token, locale = 'it-IT') {
  const name = 'fetchUserInitiatives';
  const url = `${baseUrl}${OnboardingEndpoints.BY_USER}`;
  const headers = buildHeaders(token, locale);

  const params = {
    headers,
    responseType: 'text',
    tags: {
      apiName: name,
      // Metti 'true' solo se decidi di considerare OK alcuni 4xx con code attesi
      expected_response: 'false',
    },
  };

  const res = http.get(url, params);

  // OK solo se 200.
  // Se vuoi considerare come OK anche alcuni errori attesi (es. 404 con un certo code),
  // passa il 4° argomento con la mappa degli status/codici, tipo:
  // return validateAndLogResponse(name, res, [200], { 404: ['ONBOARDING_USER_NOT_FOUND'] });
  return validateAndLogResponse(name, res, [200]);
}

/**
 * Retrieves initiative information by service ID.
 * @param {string} baseUrl - Base API URL.
 * @param {string} token - Bearer authorization token.
 * @param {string} serviceId - Service identifier.
 * @param {string} [locale='it-IT'] - Language preference.
 * @returns {Response}
 */
export function fetchInitiativeByServiceId(baseUrl, token, serviceId, locale = 'it-IT') {
  const name = 'fetchInitiativeByServiceId';
  const url = `${baseUrl}${OnboardingEndpoints.BY_SERVICE_ID.replace('{serviceId}', serviceId)}`;
  const headers = buildHeaders(token, locale);

  const params = {
    headers,
    responseType: 'text',
    tags: {
      apiName: name,
      // Potrebbe restituire 404 atteso
      expected_response: 'true',
    },
  };

  const res = http.get(url, params);
  // OK se 200, oppure 404 con INITIATIVE_NOT_FOUND
  return validateAndLogResponse(name, res, [200], { 404: ['INITIATIVE_NOT_FOUND'] });
}
/**
 * Calls the PUT /onboarding endpoint.
 * @param {string} baseUrl - The base URL for the API.
 * @param {string} token - The Authorization Bearer token.
 * @param {string} initiativeId - The initiative ID.
 * @param {Object} payload - The request body payload.
 * @param {string} acceptLanguage - The language header (e.g., 'it-IT').
 * @returns {Object} - The response from the API.
 */
export function saveOnboarding(baseUrl, token, payload, acceptLanguage = 'it-IT') {
  const url = `${baseUrl}${OnboardingEndpoints.SAVE_ONBOARDING}`;

  const headers = buildHeaders(token, acceptLanguage);

  const res = http.put(url, JSON.stringify(payload), { headers, tags: { apiName: 'saveOnboarding' }, responseType: 'text' });

  if (res.status !== 202) {
    throw new Error(`API Error: ${res.status} - ${res.body}`);
  }

  return res;
}

/**
 * Calls the onboarding status endpoint.
 * @param {string} baseUrl - The base URL for the API.
 * @param {string} initiativeId - The initiative ID.
 * @param {string} token - The Bearer token for authorization.
 * @returns {Response} - The k6 HTTP response object.
 */
export function getOnboardingStatus(baseUrl, initiativeId, token) {
    const url = `${baseUrl}${OnboardingEndpoints.ONBOARDING_STATUS.replace('{initiativeId}', initiativeId)}`;
    
    const headers = buildHeaders(token);

    const params = {
        headers
    }

    return http.get(url, params)
}

/**
 * Calls the onboarding get user initiative status endpoint.
 * @param {string} baseUrl - The base URL for the API.
 * @param {string} token - The Bearer token for authorization.
 * @returns {Response} - The k6 HTTP response object.
 */
export function getOnboardingUserInitiativeStatus(baseUrl, token) {
    const url = `${baseUrl}${OnboardingEndpoints.ONBOARDING_USER_INITIATIVE_STATUS}`;

    const headers = buildHeaders(token);

    const params = {
        headers
    }

    return http.get(url, params)
}