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
 * @param {string} [locale='it-IT'] - Language preference.
 * @returns {Response}
 */
export function getWallet(baseUrl, token, locale = 'it-IT') {
  const apiName = 'getWallet';
  const url = `${baseUrl}${WalletEndpoints.GET_WALLET}`;
  const headers = buildHeaders(token, locale);

  const res = http.get(url, { headers, tags: { apiName }, responseType: 'text' });
  return validateAndLogResponse(apiName, res);
}

/**
 * Retrieves detailed information for a specific initiative.
 * @param {string} baseUrl - Base API URL.
 * @param {string} token - Bearer authorization token.
 * @param {string} initiativeId - Initiative identifier.
 * @param {string} [locale='it-IT'] - Language preference.
 * @returns {Response}
 */
export function getWalletDetail(baseUrl, token, initiativeId, locale = 'it-IT') {
  const apiName = 'getWalletDetail';
  const url = `${baseUrl}${WalletEndpoints.GET_WALLET_DETAIL.replace('{initiativeId}', initiativeId)}`;
  const headers = buildHeaders(token, locale);

  const res = http.get(url, { headers, tags: { apiName }, responseType: 'text' });
  return validateAndLogResponse(apiName, res);
}