import http from 'k6/http';
import { check } from 'k6';
import { logResult } from '../dynamicScenarios/utils.js';

/**
 * API endpoint definitions for Wallet service.
 * @readonly
 * @enum {string}
 */
const WalletEndpoints = {
  GET_WALLET: '/wallet',
  GET_WALLET_DETAIL: '/wallet/{initiativeId}'
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
 * Special case: 404 with WALLET_USER_NOT_ONBOARDED is considered OK.
 * @param {string} name - Logical API name (used for tags and logging).
 * @param {Response} res - HTTP response object.
 * @param {number[]} [expectedStatuses=[200,201,202]] - Acceptable HTTP statuses.
 * @returns {Response}
 */
function validateAndLogResponse(name, res, expectedStatuses = [200, 201, 202]) {
  logResult(name, res);

  // ✅ Determina se la risposta è OK
  let ok = expectedStatuses.includes(res.status);

  // ✅ Caso speciale: 404 con WALLET_USER_NOT_ONBOARDED
  if (res.status === 404) {
    try {
      const body = res?.body ? (res?.json?.() ?? JSON.parse(res.body)) : null;
      if (body?.code === 'WALLET_USER_NOT_ONBOARDED') {
        ok = true;
      }
    } catch {
      // ignora errori di parsing
    }
  }

  // 🔎 Log di errore solo se non è ok
  if (!ok) {
    const preview =
      typeof res.body === 'string'
        ? res.body.slice(0, 300)
        : JSON.stringify(res.body).slice(0, 300);
    console.error(
      `[${name}] Unexpected status ${res.status}. Expected: ${expectedStatuses.join(
        ','
      )}. Body: ${preview}`
    );
  }

  // 🔍 Check K6
  check(res, {
    [`${name} responded successfully`]: () => ok,
  });

  return res;
}


/**
 * Retrieves wallet summary.
 * @param {string} baseUrl - Base API URL.
 * @param {string} token - Bearer authorization token.
 * @param {string} [locale='it-IT'] - Language preference.
 * @param {number[]} [expectedStatuses=[200]] - Acceptable statuses (override if necessario).
 * @returns {Response}
 */
export function getWallet(baseUrl, token, locale = 'it-IT', expectedStatuses = [200]) {
  const apiName = 'getWallet';
  const url = `${baseUrl}${WalletEndpoints.GET_WALLET}`;
  const headers = buildHeaders(token, locale);

  const params = {
      headers,
      responseType: 'text',
      tags: {
        apiName,
        expected_response: expectedStatuses.includes(404) ? 'true' : 'false',
      },
    };

  const res = http.get(url, params);
  return validateAndLogResponse(apiName, res, expectedStatuses);
}

/**
 * Retrieves detailed information for a specific initiative wallet.
 * @param {string} baseUrl - Base API URL.
 * @param {string} token - Bearer authorization token.
 * @param {string} initiativeId - Initiative identifier.
 * @param {string} [locale='it-IT'] - Language preference.
 * @param {number[]} [expectedStatuses=[200,404]] - Acceptable statuses (404 è spesso atteso: WALLET_NOT_FOUND).
 * @returns {Response}
 */
export function getWalletDetail(
  baseUrl,
  token,
  initiativeId,
  locale = 'it-IT',
  expectedStatuses = [200, 404]
) {
  const apiName = 'getWalletDetail';
  const url = `${baseUrl}${WalletEndpoints.GET_WALLET_DETAIL.replace('{initiativeId}', initiativeId)}`;
  const headers = buildHeaders(token, locale);

  const params = {
    headers,
    responseType: 'text',
    tags: {
      apiName,
      expected_response: expectedStatuses.includes(404) ? 'true' : 'false',
    },
  };

  const res = http.get(url, params);
  return validateAndLogResponse(apiName, res, expectedStatuses);
}