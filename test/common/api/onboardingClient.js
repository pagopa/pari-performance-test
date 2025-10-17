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

/**
 * Validates and logs HTTP responses.
 * @param {string} name - Logical API name (used for tags and logging).
 * @param {Response} res - HTTP response object.
 * @param {number[]} [expectedStatuses=[200,201,202]] - Acceptable HTTP statuses.
 * @returns {Response}
 */
function validateAndLogResponse(name, res, expectedStatuses = [200, 201, 202]) {
  logResult(name, res);

  check(res, {
    [`${name} responded successfully`]: (r) =>
      expectedStatuses.includes(r.status),
  });

  return res;
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
  const apiName = 'fetchInitiativeDetail';
  const url = `${baseUrl}${OnboardingEndpoints.INITIATIVE_DETAIL.replace('{initiativeId}', initiativeId)}`;
  const headers = buildHeaders(token, locale);

  const res = http.get(url, { headers, tags: { apiName }, responseType: 'text' });
  return validateAndLogResponse(apiName, res);
}

/**
 * Retrieves all initiatives associated with the current user.
 * @param {string} baseUrl - Base API URL.
 * @param {string} token - Bearer authorization token.
 * @param {string} [locale='it-IT'] - Language preference.
 * @returns {Response}
 */
export function fetchUserInitiatives(baseUrl, token, locale = 'it-IT') {
  const apiName = 'fetchUserInitiatives';
  const url = `${baseUrl}${OnboardingEndpoints.BY_USER}`;
  const headers = buildHeaders(token, locale);

  const res = http.get(url, { headers, tags: { apiName }, responseType: 'text' });
  return validateAndLogResponse(apiName, res);
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
  const apiName = 'fetchInitiativeByServiceId';
  const url = `${baseUrl}${OnboardingEndpoints.BY_SERVICE_ID.replace('{serviceId}', serviceId)}`;
  const headers = buildHeaders(token, locale);

  const res = http.get(url, { headers, tags: { apiName }, responseType: 'text' });
  return validateAndLogResponse(apiName, res);
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

  const res = http.put(url, JSON.stringify(payload), { headers, tags: { apiName: 'saveOnboarding' } });

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
