import http, { head } from 'k6/http';
import { check } from 'k6';
import { logResult } from '../dynamicScenarios/utils.js';

/** Payment API Endpoints */
const PAYMENT_API = {
  CREATE_BARCODE: '/payment/bar-code',
  PRODUCTS: '/merchant-op/products?size=10&status=APPROVED',
  PREVIEW_PAYMENT: '/merchant-op/transactions/bar-code/{trxCode}/preview',
  AUTH_PAYMENT: '/merchant-op/transactions/bar-code/{trxCode}/authorize',
  DELETE_PAYMENT: '/merchant-op/transactions/{trxCode}'
};

/**
 * Builds headers for HTTP requests.
 * @param {string} token - Bearer token for authorization.
 * @param {string} acceptLanguage - Language for the request (default: 'it-IT').
 * @return {Object} Headers object.
 */
function buildHeaders(token, acceptLanguage = 'it-IT') {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept-Language': acceptLanguage,
  };
}

/**
 * Replaces the {trxCode} placeholder in an endpoint with the actual transaction code.
 * @param {string} endpoint - Endpoint URL with {trxCode} placeholder.
 * @param {string} trxCode - Transaction code to replace in the URL.
 * @return {string} Endpoint with transaction code.
 */
function replaceTrxCode(endpoint, trxCode) {
  return endpoint.replace('{trxCode}', trxCode || '');
}

/**
 * Validates the response and logs the result.
 * @param {string} apiName - Name of the API call.
 * @param {Object} res - HTTP response object.
 * @param {string} expectedField - JSON field expected in the response.
 * @return {Object} Response object.
 */
function validateResponse(apiName, res, expectedField = 'trxCode') {
  logResult(apiName, res);

  check(res, {
    [`${apiName} - status is success`]: (r) =>
      [200, 201, 202].includes(r.status)
  });

  return res;
}

/**
 * Retrieves approved products from the API.
 * @param {string} baseUrl - Base URL of the API.
 * @param {string} token - Bearer token for authorization.
 * @param {string} acceptLanguage - Language for the request (default: 'it-IT').
 * @return {Object} Response object.
 */
export function getProductsApproved(baseUrl, token, acceptLanguage = 'it-IT') {
  const apiName = 'getProductsApproved';
  const url = `${baseUrl}${PAYMENT_API.PRODUCTS}`;
  const headers = buildHeaders(token, acceptLanguage);

  const res = http.get(url, {
    headers,
    tags: { apiName },
    responseType: 'text',
  });

  return validateResponse(apiName, res, 'content');
}

/**
 * Creates a new barcode for payment.
 * @param {string} baseUrl - Base URL of the API.
 * @param {string} token - Bearer token for authorization.
 * @param {Object} payload - Payload for the request.
 * @param {string} acceptLanguage - Language for the request (default: 'it-IT').
 * @return {Object} Response object.
 */
export function createBarCode(baseUrl, token, payload, acceptLanguage = 'it-IT') {
  const apiName = 'createBarCode';
  const url = `${baseUrl}${PAYMENT_API.CREATE_BARCODE}`;
  const headers = buildHeaders(token, acceptLanguage);

  const res = http.post(url, JSON.stringify(payload), {
    headers,
    tags: { apiName },
    responseType: 'text',
  });
  return validateResponse(apiName, res);
}

/**
 * Previews a payment before authorization.
 * @param {string} baseUrl - Base URL of the API.
 * @param {string} token - Bearer token for authorization.
 * @param {Object} payload - Payload containing transaction info.
 * @param {string} acceptLanguage - Language for the request (default: 'it-IT').
 * @return {Object} Response object.
 */
export function previewPayment(baseUrl, token, payload, acceptLanguage = 'it-IT') {
  const apiName = 'previewPayment';
  const url = `${baseUrl}${replaceTrxCode(PAYMENT_API.PREVIEW_PAYMENT, payload.discountCode)}`;
  const headers = buildHeaders(token, acceptLanguage);

  const res = http.put(url, JSON.stringify(payload), {
    headers,
    tags: { apiName },
    responseType: 'text',
  });

  return validateResponse(apiName, res);
}

/**
 * Authorizes a payment.
 * @param {string} baseUrl - Base URL of the API.
 * @param {string} token - Bearer token for authorization.
 * @param {Object} payload - Payload containing transaction info.
 * @param {string} acceptLanguage - Language for the request (default: 'it-IT').
 * @return {Object} Response object.
 */
export function authPayment(baseUrl, token, payload, acceptLanguage = 'it-IT') {
  const apiName = 'authPayment';
  const url = `${baseUrl}${replaceTrxCode(PAYMENT_API.AUTH_PAYMENT, payload.discountCode)}`;
  const headers = buildHeaders(token, acceptLanguage);

  const res = http.put(url, JSON.stringify(payload), {
    headers,
    tags: { apiName },
    responseType: 'text',
  });
  return validateResponse(apiName, res);
}

export function deletePayment(baseUrl, token, id, acceptLanguage = 'it-IT'){
  const apiName = 'deletePayment';
  const url = `${baseUrl}${replaceTrxCode(PAYMENT_API.DELETE_PAYMENT, id)}`;
  const headers = buildHeaders(token, acceptLanguage);

  const res = http.del(url, null, {  
    headers: headers,
    tags: { apiName },
    responseType: 'text',
  });

  return validateResponse(apiName, res);
}
